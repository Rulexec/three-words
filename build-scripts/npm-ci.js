import _path from 'path';
import fs from 'fs';
import { spawn, spawnSync } from 'child_process';

const CACHE_DIR = process.env.CACHE_DIR;
const cachedPackageJsonLockPath = _path.join(CACHE_DIR, 'package-lock.json');
let cachedNodeModulesPath = _path.join(CACHE_DIR, 'node_modules');

run().then(null, (error) => {
	console.error(error);
	process.exit(1);
});

async function run() {
	let needNpmCi = true;

	spawnSyncBail('rm', ['-rf', 'node_modules']);

	if (CACHE_DIR) {
		let diffResult = spawnSync('diff', [
			'package-lock.json',
			cachedPackageJsonLockPath,
		]);

		if (diffResult.status === 0) {
			spawnSyncBail('ln', ['-s', cachedNodeModulesPath, 'node_modules']);

			needNpmCi = false;
		}
	}

	if (needNpmCi) {
		let npmCi = spawn('npm', ['ci'], { stdio: 'inherit' });
		await onClose(npmCi);

		if (CACHE_DIR) {
			spawnSyncBail('rm', ['-rf', cachedNodeModulesPath]);
			spawnSyncBail('cp', ['-r', 'node_modules', cachedNodeModulesPath]);
			fs.copyFileSync('package-lock.json', cachedPackageJsonLockPath);
		}
	}
}

function spawnSyncBail(...args) {
	let result = spawnSync(...args);
	if (result.status) {
		console.error(result.stdout.toString('utf8'));
		console.error(result.stderr.toString('utf8'));
		console.error('Status ' + result.status);
		process.exit(1);
	}
}

function onClose(cp) {
	return new Promise((resolve, reject) => {
		cp.on('close', (code) => {
			if (code) reject(code);
			else resolve();
		});
	});
}
