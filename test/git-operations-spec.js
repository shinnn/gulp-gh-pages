/* global jasmine, describe, beforeEach, it, expect */

'use strict';

var git 	= require('../lib/git');
var fs      = require('fs');
var path    = require('path');
var rimraf  = require('rimraf');
var when 	= require('when');

jasmine.getEnv().defaultTimeoutInterval = 10000;

function copyFile (src, dest) {
	var defer = when.defer();
	var called = false;

	function done (err) {
		if (!called) {
			defer.reject(err);
		}
	}

	var read = fs.createReadStream(src);
	read.on('error', function (err) {
		done(err);
	});

	var write = fs.createWriteStream(dest);
	write.on('error', function (err) {
		done(err);
	});

	write.on('close', function() {
		defer.resolve();
	});

	read.pipe(write);

	return defer.promise;
}

function copyFileHelper (repo, src, dest) {
	var defer = when.defer();
	copyFile(src, dest)
	.then(function () {
		defer.resolve(repo);
	}, function (err) {
		defer.reject(err);
	});
	return defer.promise;
}

describe('git operations on a repo', function () {
	var promise;
	var tmpDir = path.join(require('os').tmpdir(), 'tmpRepo');
	var remoteUrl = 'git://github.com/rowoot/test-gh-pages.git';

	beforeEach(function () {
		rimraf.sync(tmpDir);
		promise = git.prepareRepo(remoteUrl);
	});

	it('should determine the remoteUrl of a git repository', function (cb) {
		promise
		.then(function (repo) {
			return git.getRemoteUrl(repo._repo, 'origin');
		})
		.then(function (rUrl) {
			expect(rUrl).toBe(remoteUrl);
			cb();
		});
	});

  	it('should create a branch', function (cb) {
	  	var branchName = 'new-branch';

	    promise
	    .then(function (repo) {
	    	return repo.createBranch(branchName);
	    })
	    .then(function (repo) {
	    	expect(repo._localBranches).toContain(branchName);
	    	cb();
	    }, function (err) {
	    	console.log(err);
	    });
  	});

  	it('should throw an error when checking out a non existent branch', function (cb) {
	  	var branchName = 'non-existent-branch';

	    promise
	    .then(function (repo) {
	    	return repo.checkoutBranch(branchName);
	    })
	    .then(function (repo) {
	    	// none
	    }, function (err) {
	    	expect(err.message).toBe('Command failed: error: pathspec \''+branchName+'\' did not match any file(s) known to git.\n');
	    	cb();
	    });
  	});

  	it('should checkout a existing remote branch', function (cb) {
	  	var branchName = 'gh-pages';

	    promise
	    .then(function (repo) {
	    	return repo.checkoutBranch(branchName);
	    })
	    .then(function (repo) {
	    	expect(repo._currentBranch).toBe(branchName);
	    	cb();
	    });
  	});

  	it('should create and checkout a branch', function (cb) {
	  	var branchName = 'new-and-checkout-branch';

	    promise
	    .then(function (repo) {
	    	return repo.createAndCheckoutBranch(branchName);
	    })
	    .then(function (repo) {
	    	expect(repo._currentBranch).toBe(branchName);
	    	expect(repo._localBranches).toContain(branchName);
	    	cb();
	    });
  	});


  	it('should add a file successfully and stage it', function (cb) {
	  	var file = 'test.txt';
	  	var src = path.join(__dirname, 'fixtures', file);
	  	var dest = path.join(tmpDir, file);

	    promise
	    .then(function (repo) {
	    	return copyFileHelper(repo, src, dest);
	    })
	    .then(function (repo) {
	    	return repo.addFiles(path.join(tmpDir , file));
	    })
	    .then(function (repo) {
	    	expect(Object.keys(repo._staged).length).toBe(1);
	    	expect(Object.keys(repo._staged)).toContain(file);
	    	cb();
	    });
  	});

  	// it('should commit a file successfully', function (cb) {
	  // 	var file = 'test.txt';
	  // 	var message = 'commit message';
	  // 	var src = path.join(__dirname, 'fixtures', file);
	  // 	var dest = path.join(tmpDir, file);

	  //   promise
	  //   .then(function (repo) {
	  //   	return copyFileHelper(repo, src, dest);
	  //   })
	  //   .then(function (repo) {
	  //   	return repo.addFiles(path.join(tmpDir , file));
	  //   })
	  //   .then(function (repo) {
	  //   	return repo.commit(message);
	  //   })
	  //   .then(function (repo) {
	  //   	expect(Object.keys(repo._staged).length).toBe(0);
	  //   	expect(repo._commits[0].message).toBe(message);
	  //   	cb();
	  //   });
  	// });
});

describe('git operations on special repositories', function () {
	var tmpDir = path.join(require('os').tmpdir(), 'tmpRepo');

	beforeEach(function () {
		rimraf.sync(tmpDir);
	});

	it('should be initialized on the default branch', function (cb) {
		var promise = git.prepareRepo('git://github.com/LeaVerou/csss.git');
		promise.then(function (repo) {
			expect(repo._currentBranch).toBe('gh-pages');
			cb();
		});
	});
});
