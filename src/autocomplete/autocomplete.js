import AsyncM from 'asyncm';
import { damerauLevenshteinDistance } from '../util/levenshtein.js';
import { LimitedHeap } from '../util/limited-heap.js';

export { AutoComplete };

function AutoComplete() {
	let allWordsList = [];
	let allWordsSet = new Set();

	this.getVariants = AsyncM.pureF((options) => {
		let { word: userWord, count } = options;

		let heap = new LimitedHeap({
			size: count,
			getValue: ({ distance }) => distance,
		});

		allWordsList.forEach((word) => {
			let distance = damerauLevenshteinDistance(userWord, word);

			heap.add({
				word,
				distance,
			});
		});

		return AsyncM.result(
			heap
				.get()
				.filter(({ distance }) => {
					return distance <= 3;
				})
				.map(({ word }) => word),
		);
	});

	this.addWord = function (word) {
		if (allWordsSet.has(word)) {
			return;
		}

		allWordsSet.add(word);

		allWordsList.push(word);
	};
}
