export { HrTimer };

function HrTimer() {
	let [s1, ns1] = process.hrtime();

	this.elapsedMs = function() {
		let [s2, ns2] = process.hrtime();

		return (s2 - s1) * 1000 + (ns2 - ns1) / 1000000;
	};
}