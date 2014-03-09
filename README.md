# gulp-gh-pages
[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][depstat-image]][depstat-url]

> Gulp plugin to publish to Github pages.

## Usage

First, install `gulp-gh-pages` as a development dependency

```shell
npm install --save-dev gulp-gh-pages
```

If your repository does not have a `gh-pages` branch, it is advised that you create one first. I used `git subtree push --prefix <dist folder> origin gh-pages`. 

Then define a `deploy` task in your `gulpfile.js` (as below) which can be used to push to `gh-pages` going forward.

```javascript
var deploy = require("gulp-gh-pages");

gulp.task('deploy', function () {
	gulp.src("./dist/**/*")
		.pipe(deploy(gitRemoteUrl, remote));
});
```

## API

### deploy(gitRemoteUrl, remote)

Either define `options.templatePath` or `options.template`. If both are given, `options.templatePath` is used.

#### gitRemoteUrl
Type: `String`
Default: `undefined`
Required: `true`

Your git remote url. Ensure you have write access to the repository.

#### remote
Type: `String`
Default: `origin`
Required: `true`

Git remote.

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
