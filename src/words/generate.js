import fs from 'fs';
import _path from 'path';
import { resolveCodePath } from '../code-relative-path.js';

export { getRandomPhrase, getAllWords };

let colors = readLinesFile(resolveCodePath('../dictionary/colors.txt'));
let adjectives = readLinesFile(resolveCodePath('../dictionary/adjectives.txt'));
let nouns = readLinesFile(resolveCodePath('../dictionary/nouns.txt'));

function getAllWords() {
	return Array.from(new Set([...colors, ...adjectives, ...nouns]));
}

function getRandomPhrase() {
	let noun = getRandomItem(nouns);

	let start;
	let middle;

	let rand = Math.random();

	if (rand < 0.33) {
		start = getRandomItem(adjectives);
		middle = getRandomItem(colors);
	} else if (rand < 0.66) {
		start = getRandomItem(colors);
		middle = getRandomItem(adjectives);
	} else {
		start = getRandomItem(adjectives);
		while (true) {
			middle = getRandomItem(adjectives);
			if (start !== middle) break;
		}
	}

	let nounInfo = getWordInfo(noun);

	start = fixWord(start, nounInfo);
	middle = fixWord(middle, nounInfo);

	/*let concatenated = concatWords(start, middle);
	if (concatenated) {
		start = concatenated;
		middle = null;
	}*/

	return [start, middle, noun].filter((x) => !!x).join(' ');

	function fixWord(word, info) {
		if (info.woman) {
			word = womanize(word);
		} else if (info.middleSex) {
			word = middleSexize(word);
		}

		return word;
	}
}

/*function concatWords(first, second) {
	let result = null;

	[
		[/ное$/, 'но'],
		[/щая$/, 'ще'],
	].some(([regex, replace]) => {
		if (regex.test(first)) {
			first = first.replace(regex, replace);
			result = `${first}-${second}`;
			return true;
		}
	});

	return result;
}*/

function getWordInfo(word) {
	let woman = isWoman(word);
	let middleSex = !woman && isMiddleSex(word);

	return {
		woman,
		middleSex,
	};
}

function womanize(word) {
	[
		[/ний$/, 'няя'],
		[/(ы|и|о)й$/, 'ая'],
	].some(([regex, replace]) => {
		if (regex.test(word)) {
			word = word.replace(regex, replace);
			return true;
		}
	});

	return word;
}

function middleSexize(word) {
	[[/(ий|ый|ой)$/, 'ое']].some(([regex, replace]) => {
		if (regex.test(word)) {
			word = word.replace(regex, replace);
			return true;
		}
	});

	return word;
}

function isWoman(word) {
	return /(ст?ь|а|я|нь)$/.test(word);
}

function isMiddleSex(word) {
	return /(ие|ое|ье|ро)$/.test(word);
}

function getRandomItem(list) {
	let index = (Math.random() * list.length) | 0;

	return list[index];
}

function readLinesFile(path) {
	let content = fs.readFileSync(path, { encoding: 'utf8' });
	let lines = content.split('\n');
	return lines.map((x) => x.trim().toLowerCase()).filter((x) => !!x);
}
