# gulp-gh-pages

[![NPM version](http://img.shields.io/npm/v/gulp-gh-pages.svg)](https://www.npmjs.com/package/gulp-gh-pages)
[![Build Status](http://img.shields.io/travis/shinnn/gulp-gh-pages.svg?style=flat)](http://travis-ci.org/shinnn/gulp-gh-pages)
[![Build status](https://ci.appveyor.com/api/projects/status/iskj8sml9luhkm21?svg=true)](https://ci.appveyor.com/project/ShinnosukeWatanabe/gulp-gh-pages)
[![Coverage Status](https://img.shields.io/coveralls/shinnn/gulp-gh-pages.svg)](https://coveralls.io/r/shinnn/gulp-gh-pages)
[![Dependency Status](https://img.shields.io/david/shinnn/gulp-gh-pages.svg?label=deps)](https://david-dm.org/shinnn/gulp-gh-pages)
[![devDependency Status](https://img.shields.io/david/dev/shinnn/gulp-gh-pages.svg?label=devDeps)](https://david-dm.org/shinnn/gulp-gh-pages#info=devDependencies)

> [gulp](http://gulpjs.com/) plugin to publish to [Github pages](https://pages.github.com/).

## [Contributors](https://github.com/shinnn/gulp-gh-pages/graphs/contributors)

Special thanks to the folks who have contributed to this plugin.git

## Usage

First you need to be sure you have a `gh-pages` branch.
If you don't have one, you can do the following:

```shell
git checkout --orphan gh-pages
git rm -rf .
touch README.md
git add README.md
git commit -m "Init gh-pages"
git push --set-upstream origin gh-pages
git checkout master
```

Install `gulp-gh-pages` as a development dependency

```shell
npm install --save-dev gulp-gh-pages
```

Then define a `deploy` task in your `gulpfile.js` (as below) which can be used to push to `gh-pages` going forward.

```javascript
var gulp   = require('gulp')
var deploy = require('gulp-gh-pages');

gulp.task('deploy', function () {
	return gulp.src('./dist/**/*')
		.pipe(deploy());
});
```

Now, you should be able to call your task by doing 

```shell
gulp deploy
```

## API

### deploy(options)

#### options.remoteUrl

Type: `String`
Default: URL for the remote of the current dir (assumes a git repository)

By default `gulp-gh-pages` assumes the current working directory is a git repository and uses its remote url. If your `gulpfile.js` is not in a git repository, or if you want to push to a different remote url, you can specify it. Ensure you have write access to the repository.

#### options.origin

Type: `String`
Default: `"origin"`

Git remote.

#### options.branch

Type: `String`
Default: `"gh-pages"`

The branch where deploy will by done. Change to "master" for `username.github.io` projects.

#### options.cacheDir

Type: `String`
Default: a temporary folder

Useful to keep a cache of the repo to avoid fresh clone all the time.

#### options.cname

Type: `String`
Optional

Placing CNAME file for [Custom domain](https://help.github.com/articles/adding-a-cname-file-to-your-repository) support.


#### options.push

Type: `Boolean`
Default: `true`

Allow you to make a build on the defined branch without pushing it to master. Useful for dry run.

#### options.force

Type: `Boolean`
Default: `false`

Force adding files to the `gh-pages` branch, even if they are ignored by `.gitignore` or `.gitignore_global`.

#### options.message

Type: `String`
Default: `"Update [timestamp]"`

Commit message.

## License

Copyright (c) 2014 [Micheal Benedict](https://github.com/rowoot), 2015 [Shinnosuke Watanabe](https://github.com/shinnn)

Licensed under [the MIT License](./LICENSE).
