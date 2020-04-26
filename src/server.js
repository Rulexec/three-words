import AsyncM from 'asyncm';
import fs from 'fs';
import _path from 'path';
import metatrain from 'hypershape-metatrain';
import { getAllWords } from './words/generate.js';
import { WordsGenerator } from './words-generator.js';
import { resolveCodePath } from './code-relative-path.js';
import { Logger } from 'hypershape-logging';
import { KeyValueStorage } from 'hypershape-level';
import { AutoComplete } from './autocomplete/autocomplete.js';
import { HrTimer } from './util/timing.js';
import { PercentileStats } from './util/percentile-stats.js';

const readJsonFromStream = metatrain.readJsonFromStream;

const dataPath = process.env.DATA_PATH || resolveCodePath('../data');
const mainDbPath = _path.join(dataPath, 'main');
const frontendPath = resolveCodePath('../web/dist');

let frontendFiles = new Map();

if (!fs.existsSync(dataPath)) {
	fs.mkdirSync(dataPath);
}

if (fs.existsSync(frontendPath)) {
	fs.readdirSync(frontendPath).forEach((path) => {
		let content;

		try {
			content = fs.readFileSync(_path.join(frontendPath, path));
		} catch (e) {
			console.warn(e);
			return;
		}

		frontendFiles.set(path, content);
	});
}

let mainLogger = new Logger();

mainLogger.info('start');

let mainDb = new KeyValueStorage({
	logger: mainLogger.fork('db'),
	path: mainDbPath,
});

let lockedPhrases = new Set();

let phrasesSpace = mainDb.space('phrase');

let wordsGenerator = new WordsGenerator({
	lockedPhrases,
	phrasesSpace,
	logger: mainLogger.fork('words'),
});

let autoCompleteStats = new PercentileStats({
	maxSeconds: 60 * 60 * 24, // 1 day

	onCalculated({ count, average, percentiles }) {
		let avg = Math.ceil(average * 100) / 100;

		let props = {
			count,
			avg,
		};

		percentiles.forEach(({ p, value }) => {
			props['p' + p] = Math.ceil(value * 100) / 100;
		});

		mainLogger.log('autoComplete', props, {
			level: Logger.LEVEL.STATS,
		});
	},
});

let autoComplete = new AutoComplete();
getAllWords().forEach((word) => {
	autoComplete.addWord(word);
});

const PORT = process.env.PORT || 9001;

let server = metatrain()
	.use(metatrain.common())
	.use(metatrain.path())
	.extend(metatrain.routing());

server.use((req, res) => {
	if (req.path === '/') {
		res.setHeader('content-type', 'text/html; charset=utf-8');
		res.end(frontendFiles.get('index.html'));
		return;
	}

	let path = req.path.replace(/^\//, '');
	let content = frontendFiles.get(path);

	if (!content) {
		error404(req, res);
		return;
	}

	let contentType = null;

	let match = /\.([^.]+)$/.exec(path);
	if (match) {
		switch (match[1]) {
			case 'js':
				contentType = 'text/javascript; charset=utf-8';
				break;
		}
	}

	if (contentType) {
		res.setHeader('content-type', contentType);
	}

	res.end(content);
});

server.post('/api/variants', (req, res) => {
	wordsGenerator
		.generateWords({ count: 20 })
		.result((words) => {
			res.setHeader('content-type', 'application/json; charset=utf-8');
			res.end(
				JSON.stringify({
					words,
				}),
			);
		})
		.run(null, (error) => {
			mainLogger.error('api:variants', null, { extra: error });

			res.statusCode = 500;
			res.end('{"error":500}');
		});
});

server.post('/api/decode', (req, res) => {
	readJsonFromStream(req)
		.result((json) => {
			let invalid =
				!json ||
				!json.phrase ||
				typeof json.phrase !== 'string' ||
				json.phrase.length > 512;

			if (invalid) {
				return AsyncM.error('invalidParams');
			}

			mainLogger.info('api:decode', null, { extra: json.phrase });

			return phrasesSpace.getJson(json.phrase);
		})
		.result((json) => {
			let value = json && json.value;

			res.setHeader('content-type', 'application/json; charset=utf-8');
			res.end(
				JSON.stringify({
					value,
				}),
			);
		})
		.run(null, (error) => {
			mainLogger.error('api:decode', null, { extra: error });

			res.statusCode = 500;
			res.end('{"error":500}');
		});
});

server.post('/api/autocomplete', (req, res) => {
	let autoCompleteTimer;

	readJsonFromStream(req)
		.result((json) => {
			let invalid =
				!json ||
				!json.word ||
				typeof json.word !== 'string' ||
				json.word.length > 30;

			if (invalid) {
				return AsyncM.error('invalidParams');
			}

			autoCompleteTimer = new HrTimer();

			return autoComplete.getVariants({
				word: json.word,
				count: 3,
			});
		})
		.result((variants) => {
			autoCompleteStats.measurement(autoCompleteTimer.elapsedMs());

			res.setHeader('content-type', 'application/json; charset=utf-8');
			res.end(
				JSON.stringify({
					variants,
				}),
			);
		})
		.run(null, (error) => {
			mainLogger.error('api:autoComplete', null, { extra: error });

			res.statusCode = 500;
			res.end('{"error":500}');
		});
});

function pickNonUsedPhrase() {
	let lockedPhrasesList = [];

	let m = wordsGenerator.generateWords({ count: 1 }).result(([phrase]) => {
		if (lockedPhrases.has(phrase)) return m;

		lockedPhrasesList.push(phrase);
		lockedPhrases.add(phrase);

		return phrasesSpace.get(phrase, { encoding: 'raw' }).result((value) => {
			if (value) {
				return m;
			}

			return AsyncM.result(phrase);
		});
	});

	return {
		m,
		free() {
			lockedPhrasesList.forEach((phrase) => {
				lockedPhrases.delete(phrase);
			});
		},
	};
}

server.post('/api/save', (req, res) => {
	let cleanups = [];
	let usedPhrase;
	let value;

	readJsonFromStream(req)
		.result((json) => {
			let invalid =
				!json ||
				!json.value ||
				typeof json.value !== 'string' ||
				json.value.length > 512;

			if (invalid) {
				return AsyncM.error('invalidParams');
			}

			value = json.value;

			let { m, free } = pickNonUsedPhrase();

			cleanups.push(free);

			return m;
		})
		.result((phrase) => {
			usedPhrase = phrase;

			mainLogger.info(
				'api:save',
				{ phrase: usedPhrase },
				{ extra: value },
			);

			return phrasesSpace.setJson(phrase, {
				value,
			});
		})
		.result(() => {
			res.setHeader('content-type', 'application/json; charset=utf-8');
			res.end(
				JSON.stringify({
					phrase: usedPhrase,
				}),
			);

			return AsyncM.result();
		})
		.run(
			() => {
				cleanups.forEach((fun) => fun());
			},
			(error) => {
				cleanups.forEach((fun) => fun());

				mainLogger.error('api:save', null, { extra: error });

				res.statusCode = 500;
				res.end('{"error":500}');
			},
		);
});

mainDb
	.init()
	.result(() => {
		server.listen(PORT);
		mainLogger.info('http:listen', { port: PORT });

		return wordsGenerator.init();
	})
	.run(null, (error) => {
		mainLogger.error('start', null, { extra: error });
	});

function error404(req, res) {
	mainLogger.trace('http:404', { method: req.method, url: req.url });

	res.statusCode = 404;
	res.end('404');
}
