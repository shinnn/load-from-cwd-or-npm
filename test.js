'use strict';

var assert = require('assert');

var loadFromCwdOrNpm = require('./');
var npmCliDir = require('npm-cli-dir');
var resolveFromNpm = require('resolve-from-npm');
var test = require('tape');

test('loadFromCwdOrNpm()', function(t) {
  t.plan(14);

  t.strictEqual(loadFromCwdOrNpm.name, 'loadFromCwdOrNpm', 'should have a function name.');

  loadFromCwdOrNpm('read-package-json').then(function(readPkgJson) {
    readPkgJson('./package.json', null, function(err, data) {
      assert.ifError(err);
      t.strictEqual(
        data.name,
        'load-from-cwd-or-npm',
        'should load the module from npm when it only exists in npm directory.'
      );
    });
  }).catch(t.fail);

  loadFromCwdOrNpm('tape').then(function(tape) {
    t.strictEqual(tape, test, 'should load the module from CWD when it only exists in CWD.');
  }).catch(t.fail);

  loadFromCwdOrNpm('request').then(function(request) {
    t.strictEqual(
      request,
      require('request'),
      'should load the module from CWD when it exists in both npm and CWD, and the CWD version is newer.'
    );
  }).catch(t.fail);

  loadFromCwdOrNpm('osenv').then(function(osenv) {
    // osenv v0.0.2 doesn't have .shell method.
    t.strictEqual(
      typeof osenv.shell,
      'function',
      'should load the module from CWD when it exists in both npm and CWD, and the CWD version is older.'
    );
  }).catch(t.fail);

  resolveFromNpm('./package.json').then(function(npmPackageJsonPath) {
    /* istanbul ignore next */
    if (require(npmPackageJsonPath).version.charAt(0) === '1') {
      t.pass('(Skipping a test for scoped module loading since npm v1.x doesn\'t support it.)');
    } else {
      return loadFromCwdOrNpm('@shinnn/eslint-config-node-legacy').then(function(config) {
        t.strictEqual(
          config,
          require('@shinnn/eslint-config-node-legacy'),
          'should load the scoped module from CWD.'
        );
      });
    }
  }).catch(t.fail);

  loadFromCwdOrNpm('npm-registry-client').then(function(npmRegistryClient) {
    t.strictEqual(
      typeof npmRegistryClient,
      'function',
      'should load the module from npm when the CWD version exists but is corrupted.'
    );
  }).catch(t.fail);

  loadFromCwdOrNpm('osenv', function alwaysReturnTrue() {
    return true;
  }).then(function(osenv) {
    t.strictEqual(
      'shell' in osenv,
      false,
      'should use custom comparison function when it takes the second argument.'
    );
  }).catch(t.fail);

  loadFromCwdOrNpm('n').then(t.fail, function(err) {
    return npmCliDir().then(function(dir) {
      t.strictEqual(
        err.message,
        'Failed to load "n" module from the current working directory (' +
        process.cwd() +
        '). Then tried to load "n" from the npm CLI directory (' +
        dir +
        '), but it also failed.',
        'should fail when it cannot find the module from either directories.'
      );
      t.strictEqual(
        err.code,
        'MODULE_NOT_FOUND',
        'should add MODULE_NOT_FOUND code to the error when it cannot find the module.'
      );
    });
  }).catch(t.fail);

  loadFromCwdOrNpm(1).then(t.fail, function(err) {
    t.strictEqual(
      err.message,
      '1 is not a string. Expected a string of npm package name (e.g. `glob`, `graceful-fs`).',
      'should fail when the first argument is not a string.'
    );
  }).catch(t.fail);

  loadFromCwdOrNpm('./lib').then(t.fail, function(err) {
    t.strictEqual(
      err.message,
      '"./lib" includes path separator(s). The string must be an npm package name (e.g. `request`, `semver`).',
      'should fail when the module ID includes `/`.'
    );
  }).catch(t.fail);

  loadFromCwdOrNpm('\\lib').then(t.fail, function(err) {
    t.strictEqual(
      err.message,
      '"\\lib" includes path separator(s). The string must be an npm package name (e.g. `request`, `semver`).',
      'should fail when the module ID includes `\\`.'
    );
  }).catch(t.fail);

  loadFromCwdOrNpm('eslint', 1).then(t.fail, function(err) {
    t.strictEqual(
      err.message,
      '1 is not a function. Expected a function to compare two package versions.',
      'should fail when it takes two arguments but the second is not a function.'
    );
  }).catch(t.fail);
});
