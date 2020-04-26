export { PercentileStats };

const PERCENTILES = [50, 80, 90, 95, 98, 99, 99.5, 99.9, 100];

function PercentileStats(options) {
	let {
		minCount = 100,
		maxCount = 10000,
		maxSeconds = 60 * 5, // 5 minutes
		onCalculated,
	} = options;

	let secondsTimeoutId = 0;

	let measurements = [];

	resetTimer();

	this.measurement = function(value) {
		measurements.push(value);

		if (measurements.length >= maxCount) {
			calculate(false);
		}
	};

	function calculate(byTimer) {
		if (measurements.length < minCount) {
			resetTimer();
			return;
		}

		measurements.sort((a, b) => a - b);

		let total = measurements.reduce((a, b) => a + b);
		let count = measurements.length;
		let average = total / count;

		let percentiles = PERCENTILES.map(p => {
			return {
				p,
				value: getPercentile(measurements, p),
			};
		});

		measurements = [];

		onCalculated({
			count,
			average,
			percentiles,
			byTimer,
		});

		resetTimer();
	}

	function resetTimer() {
		if (secondsTimeoutId) {
			clearTimeout(secondsTimeoutId);
		}

		secondsTimeoutId = setTimeout(() => { calculate(true); }, maxSeconds * 1000);
	}
}

function getPercentile(arr /*:Array, Sorted*/, p /*:Number, 0<=p<=1*/) {
	let n = (arr.length - 1) * p;
	let floor = n | 0;

	if (floor >= arr.length - 1) return arr[arr.length - 1];

	let diff = n - floor;

	if (diff <= 0.05) return arr[floor];
	if (floor >= arr.length - 1) return arr[arr.length - 1];
	if (diff >= 0.95) return arr[floor + 1];

	return arr[floor] + (arr[floor + 1] - arr[floor]) / 2;
}