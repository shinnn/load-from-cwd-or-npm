'use strict';

const {join} = require('path');
const {promisify} = require('util');

const clearAllModules = require('clear-module').all;
const outputFile = require('output-file');
const parse = require('semver');
const getPathKey = require('path-key');
const stubTrue = require('lodash/stubTrue');
const test = require('tape');

const pathKey = getPathKey();

test('loadFromCwdOrNpm()', async t => {
	const loadFromCwdOrNpm = require('.');
	const npmCliDir = require('npm-cli-dir');

	const readPkgJson = promisify(await loadFromCwdOrNpm('read-package-json'));

	t.equal(
		(await readPkgJson('./package.json', null)).name,
		'load-from-cwd-or-npm',
		'should load the module from npm when it only exists in npm directory.'
	);

	t.equal(
		await loadFromCwdOrNpm('npm-cli-dir'),
		npmCliDir,
		'should load the module from CWD when it only exists in CWD.'
	);

	t.equal(
		await loadFromCwdOrNpm('request'),
		require('request'),
		'should load the module from CWD when it exists in both npm and CWD, and the CWD version is newer.'
	);

	t.equal(
		typeof (await loadFromCwdOrNpm('osenv')).shell,
		'function',
		'should load the module from CWD when it exists in both npm and CWD, and the CWD version is older.'
	);

	t.equal(
		await loadFromCwdOrNpm('@babel/code-frame'),
		require('@babel/code-frame'),
		'should load the scoped module from CWD.'
	);

	await outputFile(join(__dirname, 'node_modules/validate-npm-package-name/package.json'), `{
	"name": "validate-npm-package-name",
	"private": true,
	"version": "9007199254740991.0.0",
	"main": "the/entry/point/file/does/not/exist"
}
`);

	t.equal(
		typeof await loadFromCwdOrNpm('validate-npm-package-name'),
		'function',
		'should load the module from npm when the CWD version exists but is corrupted.'
	);

	t.equal(
		'shell' in await loadFromCwdOrNpm('osenv', stubTrue),
		false,
		'should use custom comparison function when it takes the second argument.'
	);

	try {
		await loadFromCwdOrNpm('n');
		t.fail('Unexpectedly succeeded.');
	} catch ({code, id, message, npmVersion, triedPaths}) {
		const dir = await npmCliDir();

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
	}

	t.end();
});

test('Argument validation', async t => {
	const loadFromCwdOrNpm = require('.');

	try {
		await loadFromCwdOrNpm(1);
		t.fail('Unexpectedly succeeded.');
	} catch ({message}) {
		t.equal(
			message,
			'Expected a module ID (<string>), for example `glob` and `semver`, to resolve from either npm directory or the current working directory, but got a non-string value 1 (number).',
			'should fail when the first argument is not a string.'
		);
	}

	try {
		await loadFromCwdOrNpm('');
		t.fail('Unexpectedly succeeded.');
	} catch ({message}) {
		t.equal(
			message,
			'Expected a module ID (<string>), for example `glob` and `semver`, to resolve from either npm directory or the current working directory, but got \'\' (empty string).',
			'should fail when the first argument is an empty string.'
		);
	}

	try {
		await loadFromCwdOrNpm(__dirname);
		t.fail('Unexpectedly succeeded.');
	} catch ({message}) {
		t.ok(
			message.includes(`but got an absolute path '${__dirname}'.`),
			'should fail when the module ID includes `/`.'
		);
	}

	try {
		await loadFromCwdOrNpm('eslint', new Map());
		t.fail('Unexpectedly succeeded.');
	} catch ({message}) {
		t.equal(
			message,
			'Expected a function to compare two package versions, but got Map {}.',
			'should fail when it takes two arguments but the second is not a function.'
		);
	}

	try {
		await loadFromCwdOrNpm();
		t.fail('Unexpectedly succeeded.');
	} catch ({message}) {
		t.equal(
			message,
			'Expected 1 or 2 arguments (<string>[, <Function>]), but got no arguments.',
			'should fail when it takes no arguments.'
		);
	}

	try {
		await loadFromCwdOrNpm(0, 1, 2);
		t.fail('Unexpectedly succeeded.');
	} catch ({message}) {
		t.equal(
			message,
			'Expected 1 or 2 arguments (<string>[, <Function>]), but got 3 arguments.',
			'should fail when it takes too many arguments.'
		);
	}

	t.end();
});

test('loadFromCwdOrNpm() on an environment where npm CLI is not installed', async t => {
	t.plan(5);

	clearAllModules();
	process.env[pathKey] = 'C:\\nothing\\exists';
	delete process.env.npm_execpath;

	const loadFromCwdOrNpm = require('.');

	t.equal(
		await loadFromCwdOrNpm('resolve-from-npm'),
		require('resolve-from-npm'),
		'should load module only from CWD.'
	);

	try {
		await loadFromCwdOrNpm('pacote');
		t.fail('Unexpectedly succeeded.');
	} catch (err) {
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
	}
});
