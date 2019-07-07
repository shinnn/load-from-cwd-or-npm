# load-from-cwd-or-npm

[![npm version](https://img.shields.io/npm/v/load-from-cwd-or-npm.svg)](https://www.npmjs.com/package/load-from-cwd-or-npm)
[![Build Status](https://travis-ci.com/shinnn/load-from-cwd-or-npm.svg?branch=master)](https://travis-ci.com/shinnn/load-from-cwd-or-npm)
[![Coverage Status](https://img.shields.io/coveralls/shinnn/load-from-cwd-or-npm.svg)](https://coveralls.io/github/shinnn/load-from-cwd-or-npm?branch=master)

Load a module from either CWD or [`npm` CLI](https://github.com/npm/cli) directory

```javascript
const loadFromCwdOrNpm = require('load-from-cwd-or-npm');

// $ npm ls validate-npm-package-name
// > └── (empty)

(async () => {
  require('validate-npm-package-name'); // throws a `MODULE_NOT_FOUND` error
  const RegistryClient = await loadFromCwdOrNpm('validate-npm-package-name'); // doesn't throw
})();
```

## Installation

[Use](https://docs.npmjs.com/cli/install) [npm](https://docs.npmjs.com/about-npm/).

```
npm install load-from-cwd-or-npm
```

## API

```javascript
const loadFromCwdOrNpm = require('load-from-cwd-or-npm');
```

### loadFromCwdOrNpm(*moduleId*)

*moduleId*: `string` (a module ID without path separators (`/`, `\\`))  
Return: `Promise<any>`

It loads a module with the given module ID from either of these two directories:

1. [`node_modules`](https://docs.npmjs.com/files/folders#node-modules) in the [current working directory](https://nodejs.org/api/process.html#process_process_cwd)
2. `node_modules` in the directory where [`npm` CLI](https://github.com/npm/npm) is installed

If the module ins't installed in CWD but included in the [npm CLI dependencies](https://github.com/npm/npm/blob/v5.5.1/package.json#L36-L129), it loads the module from npm CLI directory.

```javascript
// $ npm ls nopt
// > └── (empty)

(async () => {
  const nopt = await loadFromCwdOrNpm('nopt'); //=> {[Function: nopt], clean: [Function: clean] ...}
})();
```

If the module ins't included in the npm CLI dependencies but installed in CWD, it loads the module from CWD.

```javascript
// $ npm ls eslint
// > └── eslint@4.11.0

(async () => {
  // npm doesn't depend on `eslint` module.
  const eslint = await loadFromCwdOrNpm('eslint'); //=> {linter: EventEmitter { ... }, ...}
})();
```

If the module exists in both directories, it compares their [package versions](https://docs.npmjs.com/files/package.json#version) and loads the newer one.

```javascript
// $ npm ls rimraf
// > └── rimraf@1.0.0

(async () => {
  // Loaded from npm CLI directory because the CWD version is older
  const rimraf = await loadFromCwdOrNpm('rimraf');
})();
```

The returned promise will be [fulfilled](http://promisesaplus.com/#point-26) with the loaded module, or [rejected](http://promisesaplus.com/#point-30) when it fails to find the module from either directories.

## License

[ISC License](./LICENSE) © 2017 - 2018 Shinnosuke Watanabe
