/*!
 * resolve-from-npm | MIT (c) Shinnosuke Watanabe
 * https://github.com/shinnn/resolve-from-npm
*/
'use strict';

var path = require('path');

var npmCliDir = require('npm-cli-dir');
var optional = require('optional');
var PinkiePromise = require('pinkie-promise');
var resolveFromNpm = require('resolve-from-npm');

var resolveSemverFromNpm = resolveFromNpm('semver');

module.exports = function loadFromCwdOrNpm(moduleId, compareFn) {
  if (typeof moduleId !== 'string') {
    return PinkiePromise.reject(new TypeError(
      String(moduleId) + ' is not a string. Expected a string of npm package name ' +
      '(e.g. `glob`, `graceful-fs`).'
    ));
  }

  if (moduleId.charAt(0) === '@') {
    return new PinkiePromise(function executor(resolve) {
      resolve(require(moduleId));
    });
  }

  if (moduleId.indexOf('/') !== -1 || moduleId.indexOf('\\') !== -1) {
    return PinkiePromise.reject(new Error(
      '"' + moduleId + '" includes path separator(s). The string must be an npm package name ' +
      '(e.g. `request`, `semver`).'
    ));
  }

  if (compareFn && typeof compareFn !== 'function') {
    return PinkiePromise.reject(new TypeError(
      String(compareFn) + ' is not a function. Expected a function to compare two package versions.'
    ));
  }

  var tasks = [resolveFromNpm(moduleId + '/package.json')];
  if (!compareFn) {
    tasks.push(resolveSemverFromNpm);
  }

  var cwd = process.cwd();

  return PinkiePromise.all(tasks)
  .then(function chooseOneModuleFromCwdAndNpm(results) {
    var packageJsonPathFromNpm = results[0];

    if (!compareFn) {
      compareFn = require(results[1]).gte;
    }

    if (compareFn(
      (optional(moduleId + '/package.json') || {version: '0.0.0-0'}).version,
      require(packageJsonPathFromNpm).version
    )) {
      var result = optional(moduleId);
      if (result !== null) {
        return PinkiePromise.resolve(result);
      }
    }

    return PinkiePromise.resolve(require(path.dirname(packageJsonPathFromNpm)));
  }, function fallbackToCwd() {
    var result = optional(moduleId);

    if (result === null) {
      return npmCliDir().then(function(npmCliDirPath) {
        var err = new Error(
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

        return PinkiePromise.reject(err);
      });
    }

    return PinkiePromise.resolve(result);
  });
};
