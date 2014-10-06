'use strict';

var gulp        = require('gulp');
var gutil       = require('gulp-util');
var through     = require('through2');
var git         = require('./lib/git');
var when        = require('when');

/*
 * Public: Push to gh-pages branch for github
 *
 * options - {Object} that contains all the options of the plugin
 *   - remoteUrl: The {String} remote url (github repository) of the project,
 *   - origin: The {String} origin of the git repository (default to `"origin"`),
 *   - branch: The {String} branch where deploy will by done (default to `"gh-pages"`),
 *   - cacheDir: {String} where the git repo will be located. (default to a temporary folder)
 *   - push: {Boolean} to know whether or not the branch should be pushed (default to `true`)
 *   - message: {String} commit message (default to `"Update [timestamp]"`)
 *
 * Returns `Stream`.
**/
module.exports = function (options) {
	options = options || {};
	var remoteUrl = options.remoteUrl;
	var origin = options.origin || 'origin';
	var branch = options.branch || 'gh-pages';
	var cacheDir = options.cacheDir;
	var push = options.push === undefined ? true : options.push;
	var message = options.message || 'Update ' + new Date().toISOString();

	var filePaths = [];
	var TAG = '[gulp-' + branch + ']: ';

	function collectFileName (file, enc, callback) {
		if (file.isNull()) {
			this.push(file);
			return callback();
		}

		if (file.isStream()) {
			this.emit("error",
				new gutil.PluginError("gulp-gh-pages", "Stream content is not supported"));
			return callback();
		}

		filePaths.push(file);
		callback();
	}

	function task (callback) {
		if (filePaths.length === 0) {return callback();}
		return git.prepareRepo(remoteUrl, origin, cacheDir)
		.then(function (repo) {
			gutil.log(TAG + 'Cloning repo');
			if ( repo._localBranches.indexOf(branch) > -1 ) {
				gutil.log(TAG + 'Checkout branch `' + branch + '`');
				return repo.checkoutBranch(branch);
			}
			else if ( repo._remoteBranches.indexOf(origin + '/' + branch) > -1 ) {
				gutil.log(TAG + 'Checkout remote branch `' + branch + '`');
				return repo.checkoutBranch(branch);
			} else {
				gutil.log(TAG + 'Create branch `' + branch + '` and checkout');
				return repo.createAndCheckoutBranch(branch);
			}
		})
		.then(function (repo) {
			var deferred = when.defer();
			// updating to avoid having local cache not up to date
			if (cacheDir) {
				gutil.log(TAG + 'Updating repository');
				repo._repo.git("pull", function(err) {
					if (err) {
						deferred.reject(err);
						throw new Error(err);
					}
					else {
						deferred.resolve(repo);
					}
				});
			}
			// no cache, skip this step
			else {
				deferred.resolve(repo);
			}

			return deferred.promise;
		})
		.then(function (repo) {
			// remove all files to stage deleted files
			return repo.removeFiles('.', {r: true});
		})
		.then(function (repo) {
			var deferred = when.defer();
			gutil.log(TAG + 'Copying files to repository');
			// Create temporary stream and write the files in memory
			var srcStream = through.obj(function (file, enc, callback) {
				this.push(file);
				callback();
			});

			srcStream
			.pipe(gulp.dest(repo._repo.path))
			.on('end', function () {
				deferred.resolve(repo);
			})
			.on('error', function (err) {
				deferred.reject(err);
				throw new Error(err);
			});

			// Write files to stream
			filePaths.forEach(function (file) {
				srcStream.write(file);
			});
			srcStream.end();

			return deferred.promise;
		})
		.then(function (repo) {
			return repo.addFiles('.');
		})
		.then(function (repo) {
			var filesToBeCommitted = Object.keys(repo._staged).length;
			if (filesToBeCommitted === 0) {
				gutil.log(TAG + 'No files have changed.');
				return repo;
			} else {
				gutil.log(TAG + 'Adding ' + filesToBeCommitted + ' files.');
				gutil.log(TAG + 'Commiting "' + message + '"');
				return repo.commit(message)
				.then(function (repo) {
					if (push) {
						gutil.log(TAG + 'Pushing to remote.');
						return repo.push(origin);
					}
				});
			}
		})
		.done(function () {
			return callback();
		}, function (err) {
			throw new Error(err);
		});
	}
  return through.obj(collectFileName, task);
};
