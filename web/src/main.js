import css from './styles.less';
import htmlTemplate from 'raw-loader!./template.html';

const MAX_ENCODE_LENGTH = 512;

document.body.className = css.body;

let htmlTemplates = new HtmlTemplates(htmlTemplate);

let api = new Api();

let form = new Form({ api });
document.body.appendChild(form.getElement());

function Form({ api }) {
	const ENCRYPT_PHRASE = 'Погнали!';

	let element = htmlTemplates.instantiate('form');
	attachClasses(element, css);

	let {
		contentEl,
		encryptBlockEl,
		decryptBlockEl,
		decryptButtonEl,
		encryptSwitchEl,
		toEncodeEl,
		encryptButtonEl,
		encryptContentEl,
	} = extractElementsById(element);

	let wordsInput = new WordsInput({ api });

	injectSlots(element, {
		wordsInput: wordsInput.getElement(),
	});

	toggleEncryption(false);

	decryptButtonEl.addEventListener('click', () => {
		toggleEncryption(true);
	});
	encryptSwitchEl.addEventListener('click', () => {
		toggleEncryption(false);
	});

	function toggleEncryption(toggle) {
		wordsInput.toggleWordUpdates(!toggle);
		encryptBlockEl.style.display = toggle ? '' : 'none';
		decryptBlockEl.style.display = toggle ? 'none' : '';
	}

	let encryptButtonDisabledBySending = false;
	let encryptButtonDisabledByValidation = false;

	let lastEncodings = new Map();

	function updateEncryptButtonDisabled() {
		encryptButtonEl.disabled = encryptButtonDisabledBySending || encryptButtonDisabledByValidation;
	}

	encryptButtonEl.textContent = ENCRYPT_PHRASE;

	let timeoutId = 0;
	let counter = 0;

	wordsInput.watchValue((value) => {
		value = value.trim().replace(/\s+/g, ' ').toLowerCase();

		let requestId = ++counter;

		if (!value) {
			useHintSpan(contentEl, 'Введите фразу');
			return;
		}

		let wordsCount = value.split(' ').length;
		if (wordsCount < 3) {
			useHintSpan(contentEl, 'Нужно три слова');
			return;
		}
		if (wordsCount > 3) {
			useHintSpan(contentEl, 'Перебор');
			return;
		}

		useHintSpan(contentEl, 'Смотрим...');

		if (timeoutId) clearTimeout(timeoutId);
		timeoutId = setTimeout(async () => {
			let result = await api.decode(value);
			if (requestId !== counter) return;

			if (!result.value) {
				useHintSpan(contentEl, 'Такой фразы не было');
				return;
			}

			if (/https?:\/\//i.test(result.value)) {
				let anchor = document.createElement('a');
				anchor.setAttribute('href', result.value);
				anchor.textContent = result.value;
				contentEl.innerHTML = '';
				contentEl.appendChild(anchor);
			} else {
				contentEl.textContent = result.value;
			}
		}, 1000);
	});

	onEncodeValueChange();
	onEdit(toEncodeEl, onEncodeValueChange);

	function onEncodeValueChange() {
		let value = toEncodeEl.value;
		value = value.trim();

		encryptButtonDisabledByValidation = !validateEncoding(value);
		updateEncryptButtonDisabled();

		if (!value) {
			useHintSpan(encryptContentEl, 'Закодируйте что-нибудь. Можно ссылку, можно текст.');
		} else if (value.length > MAX_ENCODE_LENGTH) {
			useHintSpan(encryptContentEl, 'Голландия не резиновая');
		} else if (lastEncodings.has(value)) {
			let phrase = lastEncodings.get(value);
			encryptContentEl.textContent = phrase;
			encryptButtonDisabledByValidation = true;
			updateEncryptButtonDisabled();
		}
	}

	toEncodeEl.addEventListener('keyup', (event) => {
		let isEnter =
			event.key === 'Enter' ||
			event.code === 'Enter' ||
			event.keyCode === 13;

		if (isEnter) doEncrypt();
	});
	encryptButtonEl.addEventListener('click', () => { doEncrypt(); });

	async function doEncrypt() {
		if (encryptButtonEl.disabled) return;

		let value = toEncodeEl.value.trim();
		if (!validateEncoding(value)) return;

		toEncodeEl.disabled = true;
		encryptButtonDisabledBySending = true;
		updateEncryptButtonDisabled();

		let result;

		try {
			result = await api.save(value);
		} catch (error) {
			console.error(error);
			unlock();
			return;
		}

		lastEncodings.set(value, result.phrase);
		onEncodeValueChange();

		unlock();

		function unlock() {
			toEncodeEl.disabled = false;
			encryptButtonDisabledBySending = false;
			updateEncryptButtonDisabled();
		}
	}

	this.getElement = () => element;

	function useHintSpan(contentEl, text) {
		let span = document.createElement('span');
		span.className = css.hint;
		span.textContent = text;
		contentEl.innerHTML = '';
		contentEl.appendChild(span);
	}

	function validateEncoding(value) {
		value = value.trim();
		if (!value) return false;

		if (value.length > MAX_ENCODE_LENGTH) return false;

		return true;
	}
}

function WordsInput({ api }) {
	const self = this;

	let updateWords = false;
	let loopActive = false;

	let element = htmlTemplates.instantiate('main-input');
	attachClasses(element, css);

	let inputEl = element.querySelector('[data-id="input"]');

	this.getElement = () => element;

	this.isInputEmpty = () => !inputEl.value;
	this.setPlaceholder = function (text) {
		inputEl.setAttribute('placeholder', text);
	};
	this.toggleWordUpdates = function (toggle) {
		updateWords = !!toggle;

		if (!loopActive) {
			placeHolderUpdateLoop();
		}
	};

	this.watchValue = function (callback) {
		callback(inputEl.value);

		return onEdit(inputEl, callback);
	};

	placeHolderUpdateLoop();

	async function placeHolderUpdateLoop() {
		if (loopActive) return;
		loopActive = true;

		while (true) {
			if (!updateWords) {
				loopActive = false;
				return;
			}

			if (self.isInputEmpty()) {
				let word = await api.getWordVariant();
				self.setPlaceholder(word);
			}

			await sleep(2000);
		}
	}
}

function Api() {
	let wordVariants = [];
	let prefetching = false;

	this.getWordVariant = async function () {
		if (wordVariants.length) {
			if (wordVariants.length < 5 && !prefetching) {
				prefetching = true;
				fetchVariants().then(() => {
					prefetching = false;
				});
			}

			return wordVariants.pop();
		}

		while (true) {
			await fetchVariants();
			if (wordVariants.length) return wordVariants.pop();
		}

		async function fetchVariants() {
			while (true) {
				try {
					let response = await fetch(ENV.API_URL + '/api/variants', {
						method: 'POST',
					});
					let json = await response.json();

					if (Array.isArray(json.words)) {
						json.words.forEach((word) => {
							wordVariants.push(word);
						});
					}

					if (wordVariants.length) return;
				} catch (e) {
					console.warn(e);
				}

				await sleep(5000);
			}
		}
	};

	this.save = async function(value) {
		let response = await fetch(ENV.API_URL + '/api/save', {
			method: 'POST',
			body: JSON.stringify({
				value,
			}),
		});
		let json = await response.json();

		if (!json || !json.phrase) throw new Error('invalid response');

		return json;
	};

	this.decode = async function(phrase) {
		let response = await fetch(ENV.API_URL + '/api/decode', {
			method: 'POST',
			body: JSON.stringify({
				phrase,
			}),
		});
		let json = await response.json();

		if (!json) throw new Error('invalid response');

		return json;
	};
}

function HtmlTemplates(html) {
	let div = document.createElement('div');
	div.innerHTML = html;

	this.instantiate = function (id) {
		return div.querySelector(`[data-template-id="${id}"]`).cloneNode(true);
	};
}

function attachClasses(element, css) {
	processElement(element);

	element.querySelectorAll('[data-classes]').forEach((el) => {
		processElement(el);
	});

	function processElement(element) {
		let classes = element.getAttribute('data-classes');
		if (!classes) return;

		classes.split(' ').forEach((key) => {
			key = key.trim();
			if (!key) return;

			let className = css[key];
			if (!className) {
				console.warn(`no such class: ${key}`, element, css);
				return;
			}

			element.classList.add(className);
		});
	}
}

function injectSlots(element, elements) {
	element.querySelectorAll('[data-slot]').forEach((el) => {
		let name = el.getAttribute('data-slot');
		if (!name) return;

		let element = elements[name];
		if (!element) {
			console.warn(`no such slot: ${name}`, element, elements);
			return;
		}

		el.parentNode.insertBefore(element, el);
		el.parentNode.removeChild(el);
	});
}

function extractElementsById(element) {
	let result = {};

	element.querySelectorAll('[data-id]').forEach((el) => {
		result[el.getAttribute('data-id')] = el;
	});

	return result;
}

function onEdit(element, callback) {
	let value = element.value;

	element.addEventListener('keyup', onChange);
	element.addEventListener('change', onChange);

	function onChange() {
		let newValue = element.value;
		if (value === newValue) return;

		value = newValue;

		callback(value);
	}

	return {
		cancel() {
			element.removeEventListener('keyup', onChange);
			element.removeEventListener('change', onChange);
		},
	};
}

function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
