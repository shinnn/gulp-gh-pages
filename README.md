# gulp-gh-pages

[![npm version](https://img.shields.io/npm/v/gulp-gh-pages.svg)](https://www.npmjs.com/package/gulp-gh-pages)
[![Build Status](https://travis-ci.org/shinnn/gulp-gh-pages.svg?branch=master)](https://travis-ci.org/shinnn/gulp-gh-pages)
[![Build status](https://ci.appveyor.com/api/projects/status/iqmi2ijhabfg0cwb/branch/master?svg=true)](https://ci.appveyor.com/project/ShinnosukeWatanabe/gulp-gh-pages/branch/master)
[![Coverage Status](https://img.shields.io/coveralls/shinnn/gulp-gh-pages.svg)](https://coveralls.io/github/shinnn/gulp-gh-pages)

[gulp](http://gulpjs.com/) plugin to publish contents to [Github pages](https://pages.github.com/)

## Installation

[Use](https://docs.npmjs.com/cli/install) [npm](https://docs.npmjs.com/getting-started/what-is-npm).

```
npm install --save-dev gulp@next gulp-gh-pages
```

## Usage

Define a `deploy` task in your `gulpfile.js` (as below) which can be used to push to `gh-pages` going forward.

```javascript
const {src, task}= require('gulp');
const ghPages = require('gulp-gh-pages');

task('deploy', () => src('./dist/**/*').pipe(ghPages()));
```

Now, you should be able to call your task by doing:

```
gulp deploy
```

## API

```javascript
const ghPages = require('gulp-gh-pages');
```

### ghPages([*options*])

*options*: `Object`  
Return: [`stream.Transform`](https://nodejs.org/api/stream.html#stream_class_stream_transform)

#### options.remoteUrl

Type: `string`  
Default: URL for the remote of the current dir (assumes a git repository)

By default `gulp-gh-pages` assumes the current working directory is a git repository and uses the URL of the remote designated by `origin`. If your `gulpfile.js` is not in a git repository, or if you want to push to a different remote url, you can specify it. Ensure you have write access to the repository.

#### options.branch

Type: `string`  
Default: `"gh-pages"`

The branch where deploy will by done. Change to "master" for `username.github.io` projects.

#### options.cacheDir

Type: `string`  
Default: `.publish`

Set the directory path to keep a cache of the repository. If it doesn't exist, gulp-gh-pages automatically create it.

#### options.push

Type: `boolean`  
Default: `true`

Allow you to make a build on the defined branch without pushing it to master. Useful for dry  run.

#### options.force

Type: `boolean`  
Default: `false`

Force adding files to the `gh-pages` branch, even if they are ignored by `.gitignore` or `.gitignore_global`.

#### options.message

Type: `string`  
Default: `"Update [timestamp]"`

Edit commit message.

## License

[MIT License](./LICENSE) © 2014 [Micheal Benedict](https://github.com/rowoot), 2015 - 2018 [Shinnosuke Watanabe](https://github.com/shinnn)
