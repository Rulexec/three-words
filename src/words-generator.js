import AsyncM from 'asyncm';
import { getRandomPhrase } from './words/generate.js';

export { WordsGenerator };

function WordsGenerator({ lockedPhrases, logger, phrasesSpace }) {
	let variants = [];

	this.init = function () {
		preGenerate();

		return AsyncM.result();
	};

	this.generateWords = AsyncM.pureF(({ count }) => {
		let words = [];

		while (variants.length && words.length < count) {
			words.push(variants.pop());
		}

		let missingCount = count - words.length;

		if (missingCount) {
			logger.info('genWords', { missingCount });
		}

		return generateWords(missingCount).result((generated) => {
			generated.forEach((phrase) => {
				words.push(phrase);
			});

			return AsyncM.result(words);
		});
	});

	function preGenerate() {
		let sleepLoopM = AsyncM.pureM(() => {
			if (variants.length >= 1000) {
				return AsyncM.sleep(5000).skipResult(sleepLoopM);
			}

			logger.info('preGen:start', { count: variants.length });

			return generateWords(200);
		});

		let m = sleepLoopM.result((words) => {
			words.forEach((word) => {
				variants.push(word);
			});

			logger.info('preGen:step', { count: variants.length });

			return m;
		});

		start();

		function start() {
			m.run(null, (error) => {
				logger.error('preGen', null, { extra: error });

				setTimeout(() => {
					start();
				}, 15000);
			});
		}
	}

	function generateWords(count) {
		return AsyncM.pureM(() => {
			let nonCheckedPhrases = [];

			for (let i = 0; i < count; i++) {
				nonCheckedPhrases.push(getRandomPhrase());
			}

			return AsyncM.parallel(
				nonCheckedPhrases.map((phrase) => {
					if (lockedPhrases.has(phrase)) return AsyncM.result(null);

					return phrasesSpace
						.get(phrase, { encoding: 'raw' })
						.result((value) => {
							if (value) return AsyncM.result(null);

							return AsyncM.result(phrase);
						});
				}),
			).result((phrases) => {
				phrases = phrases.filter((x) => !!x);

				if (phrases.length === count) {
					return AsyncM.result(phrases);
				}

				let missingCount = count - phrases.length;

				return generateWords(missingCount).result((missingPhrases) => {
					missingPhrases.forEach((phrase) => {
						phrases.push(phrase);
					});

					return AsyncM.result(phrases);
				});
			});
		});
	}
}