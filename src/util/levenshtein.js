export { damerauLevenshteinDistance };

function damerauLevenshteinDistance(s1, s2) {
	let d = new Map();

	let lenstr1 = s1.length;
	let lenstr2 = s2.length;

	if (lenstr1 >= 254 || lenstr2 >= 254) {
		throw new Error('string too long');
	}

	for (let i = -1; i < lenstr1 + 1; i++) {
		setD(i, -1, i + 1);
	}
	for (let j = -1; j < lenstr2 + 1; j++) {
		setD(-1, j, j + 1);
	}

	for (let i = 0; i < lenstr1; i++) {
		for (let j = 0; j < lenstr2; j++) {
			let cost;

			if (s1[i] === s2[j]) {
				cost = 0;
			} else {
				cost = 1;
			}

			setD(i, j, Math.min(
				getD(i - 1, j) + 1,
				getD(i, j - 1) + 1,
				getD(i - 1, j - 1) + cost,
			));

			if (i && j && s1[i] === s2[j - 1] && s1[i - 1] === s2[j]) {
				setD(i, j, Math.min(getD(i, j), getD(i - 2, j - 2) + cost));
			}
		}
	}

	return getD(lenstr1 - 1, lenstr2 - 1);

	function getD(a, b) {
		return d.get(getKey(a, b));
	}
	function setD(a, b, value) {
		d.set(getKey(a, b), value);
	}
	function getKey(a, b) {
		return String.fromCharCode(a + 1) + String.fromCharCode(b + 1);
	}
}
