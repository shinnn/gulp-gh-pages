'use strict'

var path        = require('path');
var gulp       	= require('gulp');
var gutil       = require('gulp-util');
var through     = require('through2');
var fs          = require('fs');
var git 	  	= require('./lib/git');
var os 			= require('os');
var when 		= require('when');
var PluginError = gutil.PluginError;

/*
 * Public: Push to gh-pages branch for github
 *
 * remoteUrl- The {String} remote url (github repository) of the project.
 *
 * Returns `Stream`.
**/
module.exports = function (remoteUrl, origin) {
  	var filePaths = [];
  	var tmpDir = path.join(os.tmpdir(), 'tmpRepo');
  	var branchName = 'gh-pages';
  	var TAG = '[gulp-gh-pages]: ';

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
  		if (filePaths.length === 0) return callback();
  		return git.cloneRepo(remoteUrl)
	  	.then(function (repo) {
	  		gutil.log(TAG + 'Cloning repo');
	  		if ( repo._remoteBranches.indexOf('origin/gh-pages') > -1 ) {
	  			gutil.log(TAG + 'Checkout branch `gh-pages`');
	  			return repo.checkoutBranch(branchName);
	  		} else {
	  			gutil.log(TAG + 'Create branch `gh-pages` and checkout');
	  			return repo.createAndCheckoutBranch(branchName)
	  		}
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
	  		.pipe(gulp.dest(tmpDir))
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
	  		gutil.log(TAG + 'Adding ' + filePaths.length+ ' files.');
	  		return repo.addFiles('.');
	  	})
	  	.then(function (repo) {
	  		gutil.log(TAG + 'Commiting');
	  		return repo.commit('Updated');
	  	})
	  	// .then(function (repo) {
	  	// 	gutil.log(TAG + 'Pushing to remote.');
	  	// 	return repo.push(origin);
	  	// })
	  	.then(function (repo) {
	  		return callback();
	  	}, function (err) {
	  		throw new Error(err);
	  	});
  	}
  return through.obj(collectFileName, task);
};
