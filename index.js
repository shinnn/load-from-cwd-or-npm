'use strict';

const {dirname, join} = require('path');

const inspectWithKind = require('inspect-with-kind');
const npmCliDir = require('npm-cli-dir');
const optional = require('optional');
const resolveFromNpm = require('resolve-from-npm');

const MODULE_ID_ERROR = 'Expected a module ID (<string>), for example `glob` and `semver`, to resolve from either npm directory or the current working directory';
const resolveSemverFromNpm = resolveFromNpm('semver');

module.exports = async function loadFromCwdOrNpm(...args) {
	const argLen = args.length;

	if (argLen !== 1) {
		throw new RangeError(`Expected 1 argument (<string>), but got ${
			argLen === 0 ? 'no' : argLen
		} arguments.`);
	}

	const [moduleId] = args;

	if (typeof moduleId !== 'string') {
		throw new TypeError(`${MODULE_ID_ERROR}, but got a non-string value ${inspectWithKind(moduleId)}.`);
	}

	if (moduleId.length === 0) {
		throw new Error(`${MODULE_ID_ERROR}, but got '' (empty string).`);
	}

	if (moduleId.charAt(0) === '@') {
		return require(moduleId);
	}

	const cwd = process.cwd();
	const modulePkgId = `${moduleId}/package.json`;

	try {
		const [packageJsonPathFromNpm, semverPath] = await Promise.all([resolveFromNpm(modulePkgId), resolveSemverFromNpm]);
		const compareFn = require(semverPath).gte;

		if (compareFn((optional(modulePkgId) || {version: '0.0.0-0'}).version, require(packageJsonPathFromNpm).version)) {
			const result = optional(moduleId);

			if (result !== null) {
				return result;
			}
		}

		return require(dirname(packageJsonPathFromNpm));
	} catch (err) {
		if (err.code === 'ERR_ABSOLUTE_MODULE_ID') {
			err.message = `${MODULE_ID_ERROR}, but got an absolute path '${
				moduleId
			}'. For absolute paths there is no need to use \`load-from-cwd-or-npm\` in favor of Node.js built-in \`require.resolve()\`.`;

			throw err;
		}

		const modileFromCwd = optional(moduleId);

		if (modileFromCwd === null) {
			let npmCliDirPath;

			try {
				npmCliDirPath = await npmCliDir();
			} catch (errUnused) {} // eslint-disable-line no-unused-vars

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

			throw error;
		}

		return modileFromCwd;
	}
};
