/*!
 * load-from-cwd-or-npm | MIT (c) Shinnosuke Watanabe
 * https://github.com/shinnn/load-from-cwd-or-npm
*/
'use strict';

const path = require('path');

const npmCliDir = require('npm-cli-dir');
const optional = require('optional');
const resolveFromNpm = require('resolve-from-npm');

const resolveSemverFromNpm = resolveFromNpm('semver');

module.exports = function loadFromCwdOrNpm(moduleId, compareFn) {
  if (typeof moduleId !== 'string') {
    return Promise.reject(new TypeError(
      String(moduleId) + ' is not a string. Expected a string of npm package name ' +
      '(e.g. `glob`, `graceful-fs`).'
    ));
  }

  if (moduleId.charAt(0) === '@') {
    return new Promise(resolve => resolve(require(moduleId)));
  }

  if (moduleId.indexOf('/') !== -1 || moduleId.indexOf('\\') !== -1) {
    return Promise.reject(new Error(
      '"' + moduleId + '" includes path separator(s). The string must be an npm package name ' +
      '(e.g. `request`, `semver`).'
    ));
  }

  if (compareFn && typeof compareFn !== 'function') {
    return Promise.reject(new TypeError(
      String(compareFn) + ' is not a function. Expected a function to compare two package versions.'
    ));
  }

  const tasks = [resolveFromNpm(moduleId + '/package.json')];
  if (!compareFn) {
    tasks.push(resolveSemverFromNpm);
  }

  const cwd = process.cwd();

  return Promise.all(tasks).then(function chooseOneModuleFromCwdAndNpm(results) {
    const packageJsonPathFromNpm = results[0];

    if (!compareFn) {
      compareFn = require(results[1]).gte;
    }

    if (compareFn(
      (optional(moduleId + '/package.json') || {version: '0.0.0-0'}).version,
      require(packageJsonPathFromNpm).version
    )) {
      const result = optional(moduleId);
      if (result !== null) {
        return result;
      }
    }

    return require(path.dirname(packageJsonPathFromNpm));
  }, function fallbackToCwd() {
    const result = optional(moduleId);

    if (result === null) {
      return npmCliDir().then(npmCliDirPath => {
        const err = new Error(
          'Failed to load "' +
          moduleId +
          '" module from the current working directory (' +
          cwd +
          '). ' +
          'Then tried to load "' +
          moduleId +
          '" from the npm CLI directory (' +
          npmCliDirPath +
          '), but it also failed.'
        );
        err.code = 'MODULE_NOT_FOUND';

        return Promise.reject(err);
      });
    }

    return result;
  });
};
