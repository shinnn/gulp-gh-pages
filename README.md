# gulp-gh-pages
[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][depstat-image]][depstat-url]

> Gulp plugin to publish to Github pages.

## [Contributors](https://github.com/rowoot/gulp-gh-pages/graphs/contributors)
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
var deploy = require('gulp-gh-pages');

gulp.task('deploy', function () {
	return gulp.src('./dist/**/*')
		.pipe(deploy(options));
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

#### options.push

Type: `Boolean`
Default: `true`

Allow you to make a build on the defined branch without pushing it to master. Useful for dry run.

#### options.message

Type: `String`
Default: `"Update [timestamp]"`

Commit message.

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License)

[npm-url]: https://npmjs.org/package/gulp-gh-pages
[npm-image]: https://badge.fury.io/js/gulp-gh-pages.png

[travis-url]: http://travis-ci.org/rowoot/gulp-gh-pages
[travis-image]: https://secure.travis-ci.org/rowoot/gulp-gh-pages.png?branch=master

[coveralls-url]: https://coveralls.io/r/rowoot/gulp-gh-pages
[coveralls-image]: https://coveralls.io/repos/rowoot/gulp-gh-pages/badge.png

[depstat-url]: https://david-dm.org/rowoot/gulp-gh-pages
[depstat-image]: https://david-dm.org/rowoot/gulp-gh-pages.png
