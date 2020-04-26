export { LimitedHeap };

function LimitedHeap(options) {
	let { getValue, size } = options;

	let list = [];

	this.add = function (value) {
		let n = getValue(value);

		let i = 0;
		for (; i < list.length; i++) {
			let [m] = list[i];

			if (n < m) {
				list[i] = [n, value];
				return;
			}
		}

		if (list.length < size) {
			list.push([n, value]);
		}
	};

	this.get = function () {
		return list.map(([, value]) => value);
	};
}
