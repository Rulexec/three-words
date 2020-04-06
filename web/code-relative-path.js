import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

export { resolveCodePath };

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveCodePath(...args) {
	return resolve(__dirname, ...args);
}
