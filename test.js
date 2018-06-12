'use strict';

const assert = require('assert');
const {join} = require('path');

const clearAllModules = require('clear-module').all;
const parse = require('semver');
const getPathKey = require('path-key');
const test = require('tape');
const writeJsonFile = require('write-json-file');

const pathKey = getPathKey();
const originalPath = process.env[pathKey];

test('loadFromCwdOrNpm() on an environment where npm CLI is not installed', t => {
	t.plan(5);
	process.env[pathKey] = 'C:\\nothing\\exists';

	const loadFromCwdOrNpm = require('.');

	loadFromCwdOrNpm('resolve-from-npm').then(lib => {
		t.equal(lib, require('resolve-from-npm'), 'should load module only from CWD.');
	});

	loadFromCwdOrNpm('pacote').catch(err => {
		t.equal(
			err.code,
			'MODULE_NOT_FOUND',
			'should add MODULE_NOT_FOUND code to the error when it cannot find the module.'
		);

		t.equal(
			err.toString(),
			`Error: Failed to load "pacote" module from the current working directory (${
				process.cwd()
			}). Install "pacote" and try again. (\`npm install pacote\`)`,
			'should not include npm CLI directory path to the error message.'
		);

		t.notOk(
			'npm' in err.triedPaths,
			'should not add `.toriedPaths.npm` property to the error.'
		);

		t.notOk(
			'npmVersion' in err,
			'should not add `.npmVersion` property to the error.'
		);
	});
});

test('loadFromCwdOrNpm()', async t => {
	t.plan(18);
	process.env[pathKey] = originalPath;
	clearAllModules();

	const loadFromCwdOrNpm = require('.');
	const npmCliDir = require('npm-cli-dir');

	await writeJsonFile(join(__dirname, 'node_modules', 'validate-npm-package-name', 'package.json'), {
		name: 'validate-npm-package-name',
		private: true,
		version: '9007199254740991.0.0',
		main: 'the/entry/point/file/does/not/exist'
	});

	loadFromCwdOrNpm('read-package-json').then(readPkgJson => {
		readPkgJson('./package.json', null, (err, {name}) => {
			assert.ifError(err);
			t.equal(
				name,
				'load-from-cwd-or-npm',
				'should load the module from npm when it only exists in npm directory.'
			);
		});
	}).catch(t.fail);

	loadFromCwdOrNpm('npm-cli-dir').then(lib => {
		t.equal(lib, npmCliDir, 'should load the module from CWD when it only exists in CWD.');
	}).catch(t.fail);

	loadFromCwdOrNpm('request').then(request => {
		t.equal(
			request,
			require('request'),
			'should load the module from CWD when it exists in both npm and CWD, and the CWD version is newer.'
		);
	}).catch(t.fail);

	loadFromCwdOrNpm('osenv').then(osenv => {
		// osenv v0.0.2 doesn't have .shell method.
		t.equal(
			typeof osenv.shell,
			'function',
			'should load the module from CWD when it exists in both npm and CWD, and the CWD version is older.'
		);
	}).catch(t.fail);

	loadFromCwdOrNpm('@shinnn/eslint-config-node').then(config => {
		t.equal(
			config,
			require('@shinnn/eslint-config-node'),
			'should load the scoped module from CWD.'
		);
	}).catch(t.fail);

	loadFromCwdOrNpm('validate-npm-package-name').then(npmRegistryClient => {
		t.equal(
			typeof npmRegistryClient,
			'function',
			'should load the module from npm when the CWD version exists but is corrupted.'
		);
	}).catch(t.fail);

	loadFromCwdOrNpm('osenv', function alwaysReturnTrue() {
		return true;
	}).then(osenv => {
		t.equal(
			'shell' in osenv,
			false,
			'should use custom comparison function when it takes the second argument.'
		);
	}).catch(t.fail);

	loadFromCwdOrNpm('n').then(t.fail, ({code, id, message, npmVersion, triedPaths}) => npmCliDir().then(dir => {
		t.equal(
			message,
			`Failed to load "n" module from the current working directory (${
				__dirname
			}). Then tried to load "n" from the npm CLI directory (${
				dir
			}), but it also failed. Install "n" and try again. (\`npm install n\`)`,
			'should fail when it cannot find the module from either directories.'
		);

		t.equal(
			code,
			'MODULE_NOT_FOUND',
			'should add MODULE_NOT_FOUND code to the error when it cannot find the module.'
		);

		t.equal(id, 'n', 'should include module ID as `id` property to the MODULE_NOT_FOUND error.');

		t.equal(
			triedPaths.npm,
			dir,
			'should include the npm directory path to the MODULE_NOT_FOUND error.'
		);

		t.equal(
			triedPaths.cwd,
			__dirname,
			'should include the CWD path to the MODULE_NOT_FOUND error.'
		);

		t.notEqual(
			parse(npmVersion),
			null,
			'should include the npm version to the MODULE_NOT_FOUND error.'
		);
	})).catch(t.fail);

	loadFromCwdOrNpm(1).then(t.fail, ({message}) => {
		t.equal(
			message,
			'Expected a string of npm package name, for example `glob`, `graceful-fs`, but got 1 (number).',
			'should fail when the first argument is not a string.'
		);
	}).catch(t.fail);

	loadFromCwdOrNpm('').then(t.fail, ({message}) => {
		t.equal(
			message,
			'Expected a string of npm package name, for example `glob`, `graceful-fs`, but got \'\' (empty string).',
			'should fail when the first argument is an empty string.'
		);
	}).catch(t.fail);

	loadFromCwdOrNpm('./lib').then(t.fail, ({message}) => {
		t.equal(
			message,
			'"./lib" includes path separator(s). The string must be an npm package name, for example `request` `semver`.',
			'should fail when the module ID includes `/`.'
		);
	}).catch(t.fail);

	loadFromCwdOrNpm('\\lib').then(t.fail, ({message}) => {
		t.equal(
			message,
			'"\\lib" includes path separator(s). The string must be an npm package name, for example `request` `semver`.',
			'should fail when the module ID includes `\\`.'
		);
	}).catch(t.fail);

	loadFromCwdOrNpm('eslint', new Map()).then(t.fail, ({message}) => {
		t.equal(
			message,
			'Expected a function to compare two package versions, but got Map {}.',
			'should fail when it takes two arguments but the second is not a function.'
		);
	}).catch(t.fail);
});
