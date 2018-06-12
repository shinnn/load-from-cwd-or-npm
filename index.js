'use strict';

const {dirname, join} = require('path');

const inspectWithKind = require('inspect-with-kind');
const npmCliDir = require('npm-cli-dir');
const optional = require('optional');
const resolveFromNpm = require('resolve-from-npm');

const MODULE_ID_ERROR = 'Expected a string of npm package name, for example `glob`, `graceful-fs`';
const resolveSemverFromNpm = resolveFromNpm('semver');

function createModuleNotFoundRejection(moduleId, cwd, npmCliDirPath) {
	const error = new Error(`Failed to load "${
		moduleId
	}" module from the current working directory (${
		cwd
	}).${npmCliDirPath ? ` Then tried to load "${
		moduleId
	}" from the npm CLI directory (${
		npmCliDirPath
	}), but it also failed.` : ''} Install "${moduleId}" and try again. (\`npm install ${moduleId}\`)`);

	error.code = 'MODULE_NOT_FOUND';
	error.id = moduleId;
	error.triedPaths = {cwd};

	if (npmCliDirPath) {
		error.triedPaths.npm = npmCliDirPath;
		error.npmVersion = require(join(npmCliDirPath, './package.json')).version;
	}

	return Promise.reject(error);
}

module.exports = function loadFromCwdOrNpm(...args) {
	const argLen = args.length;

	if (argLen !== 1 && argLen !== 2) {
		return Promise.reject(new RangeError(`Expected 1 or 2 arguments (<string>[, <Function>]), but got ${
			argLen === 0 ? 'no' : argLen
		} arguments.`));
	}

	const [moduleId] = args;

	if (typeof moduleId !== 'string') {
		return Promise.reject(new TypeError(`${MODULE_ID_ERROR}, but got ${inspectWithKind(moduleId)}.`));
	}

	if (moduleId.length === 0) {
		return Promise.reject(new Error(`${MODULE_ID_ERROR}, but got '' (empty string).`));
	}

	if (moduleId.charAt(0) === '@') {
		return new Promise(resolve => resolve(require(moduleId)));
	}

	if (moduleId.includes('/') || moduleId.includes('\\')) {
		return Promise.reject(new Error(`"${
			moduleId
		}" includes path separator(s). The string must be an npm package name, for example \`request\` \`semver\`.`));
	}

	const cwd = process.cwd();
	const modulePkgId = `${moduleId}/package.json`;
	const tasks = [];

	if (argLen === 2) {
		if (typeof args[1] !== 'function') {
			return Promise.reject(new TypeError(`Expected a function to compare two package versions, but got ${
				inspectWithKind(args[1])
			}.`));
		}
	} else {
		tasks.push(resolveSemverFromNpm);
	}

	tasks.unshift(resolveFromNpm(modulePkgId));

	return Promise.all(tasks).then(([packageJsonPathFromNpm, semverPath]) => {
		const compareFn = argLen === 2 ? args[1] : require(semverPath).gte;

		if (compareFn((optional(modulePkgId) || {version: '0.0.0-0'}).version, require(packageJsonPathFromNpm).version)) {
			const result = optional(moduleId);

			if (result !== null) {
				return result;
			}
		}

		return require(dirname(packageJsonPathFromNpm));
	}, () => {
		const modileFromCwd = optional(moduleId);

		if (modileFromCwd === null) {
			return npmCliDir().then(npmCliDirPath => createModuleNotFoundRejection(moduleId, cwd, npmCliDirPath), () => createModuleNotFoundRejection(moduleId, cwd, null));
		}

		return modileFromCwd;
	});
};
