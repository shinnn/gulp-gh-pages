'use strict';

var originUrl = require('git-remote-origin-url');
var when 	  = require('when');
var git 	  = require('gift');
var rimraf 	  = require('rimraf');
var path 	  = require('path');
var _ 		  = require('lodash');
var fs 		  = require('fs');
var os          = require('os');

/*
 * Git Constructor
**/
function Git (repo, initialBranch) {
	this._repo = repo;
	this._staged = [];
	this._localBranches = [];
	this._remoteBranches = [];
	this._currentBranch = initialBranch || "master";
	this._commits = [];
}

/*
 * Caller abstract method
 * for promisifying traditional callback methods
**/
function caller () {
	var returnedArgs = Array.prototype.slice.call(arguments);
	var fn = returnedArgs.shift();
	var deferred = when.defer();

	var cb = function (err, args) {
		if ( err ) {
			deferred.reject(err);
		} else {
			deferred.resolve(args);
		}
	};
	returnedArgs.push(cb);
	fn.apply(this, returnedArgs);
	return deferred.promise;
}

/*
 * Gets the URL for the specified remote of a repo
 */
function getRemoteUrl(repo, remote) {
	var deferred = when.defer();
	repo.config(function (err, config) {
		if ( err ) {
			deferred.reject(err);
		} else {
			deferred.resolve(config.items['remote.' + remote + '.url']);
		}
	});
	return deferred.promise;
}


/*
 * Clone repo
 * Returns repo object
**/
function prepareRepo (remoteUrl, origin, dir) {
	var promise;
	if (remoteUrl) {
		// if a remoteUrl was provided, use it
		var remoteUrlDeferred = when.defer();
		remoteUrlDeferred.resolve( remoteUrl );
		promise = remoteUrlDeferred.promise;
	} else {
		// else try to extract it from the .git folder of
		// the current directory.
		var cwd = process.cwd();
		if (fs.existsSync(path.join(cwd, '.git'))) {
			var cwdRepo = git(cwd);
			promise = getRemoteUrl(cwdRepo, origin);
		} else {
			promise.reject(new Error('Failed to find git repository in ' + cwd));
		}
	}
	return promise.then(function(rUrl){
		// use the provided cache-folder or create a folder in the
		// systems temp-directory.
		dir = dir || path.join(os.tmpdir(), 'tmpRepo');
		remoteUrl = rUrl;

		var deferred = when.defer();

		var initRepo = function (repo) {
			repo.branch(function (err, head) {
				if (err) {
					deferred.reject(err);
				} else {
					deferred.resolve(new Git(repo, head.name).status());
				}
			});
		};

		var clearAndInitRepo = function() {
			rimraf.sync(dir);
			git.clone(rUrl, dir, function (err, repo) {
				if ( err ) {
					deferred.reject(err);
				} else {
					initRepo(repo);
				}
			});
		};

		// assume that if there is a .git folder get its remoteUrl
		// and check if it mathces the one we want to use.
		if (fs.existsSync(path.join(dir, '.git'))) {
			var repo = git(dir);
			getRemoteUrl(repo, origin).then(
				function(cwdRemoteUrl){
					if (remoteUrl === cwdRemoteUrl) {
						initRepo(repo);
					} else {
						clearAndInitRepo();
					}
				}
			);
		} else {
			clearAndInitRepo();
		}
		return deferred.promise;
	});
}

/*
 * List Local branches
**/
function listLocalBranches (repo) {
	return caller.call(repo, repo.branches)
	.then(function (branches) {
		return _.pluck(branches, 'name');
	});
}

function listRemoteBranches (repo) {
	return caller.call(repo, repo.git, 'branch', {'r': true}, [])
	.then(function (branches) {
		branches = branches.split('\n');
		branches.shift();
		branches.pop();
		return branches.map(function (branchName) {
			branchName = branchName.trim();
			return branchName;
		});
	});
}

/*
 * List commits for specific branch
**/
function getCommits (repo, branchName) {
	return caller.call(repo, repo.commits, branchName)
	.then(function (commits) {
		return commits.map(function (commitObj) {
			return {
				id: commitObj.id,
				message: commitObj.message,
				committed_date: commitObj.committed_date
			};
		});
	});
}

Git.prepareRepo = prepareRepo;
Git.getRemoteUrl = getRemoteUrl;

/*
 * Status
 * files - Array of String paths; or a String path.
**/
Git.prototype.status = function () {
	var deferred = when.defer();
	this._repo.status(function (err, repo) {
		if ( err ) {
			deferred.reject(err);
		} else {
			this._repo = repo.repo;
			this._staged = repo.files;
			when.join(
				getCommits(this._repo, this._currentBranch),
				listRemoteBranches(this._repo),
				listLocalBranches(this._repo)
			)
			.then(function (args) {
				this._remoteBranches = args[1];
				this._localBranches = args[2];
				this._commits = args[0];
				deferred.resolve(this);
			}.bind(this), function (err) {
				deferred.reject(err);
			});
		}
	}.bind(this));

	return deferred.promise;
};

/*
 * Get remote url
**/
Git.prototype.getRemoteUrl = function () {
	var deferred = when.defer();
	originUrl(this._repo.path, function (err, url) {
		if ( err ) {
			deferred.reject(err);
		} else {
			this._remoteUrl = url;
			deferred.resolve(this);
		}
	}.bind(this));

	return deferred.promise;
};


/*
 * Checkout a specific branch in a repo
 * @param name {String} -  String name of the branch.
**/
Git.prototype.checkoutBranch = function (name) {
	var deferred = when.defer();
	name = name || 'master';
	this._repo.checkout(name, function (err) {
		if ( err ) {
			deferred.reject(err);
		} else {
			this._currentBranch = name;
			deferred.resolve(this.status());
		}
	}.bind(this));

	return deferred.promise;
};


/*
 * Create a branch
 * @param name {String} -  String name of the new branch.
**/
Git.prototype.createBranch = function (name) {
	var deferred = when.defer();
	this._repo.create_branch(name, function (err) {
		if ( err ) {
			deferred.reject(err);
		} else {
			this._currentBranch = name;
			deferred.resolve(this.status());
		}
	}.bind(this));

	return deferred.promise;
};

/*
 * Create and checkout a branch
 * @param name {String} -  String name of the new branch.
**/
Git.prototype.createAndCheckoutBranch = function (name) {
	return this.createBranch(name)
	.then(function (repo) {
		return repo.checkoutBranch(name);
	});
};

/*
 * Add files
 * files - Array of String paths; or a String path.
**/
Git.prototype.addFiles = function (files, options) {
	var deferred = when.defer();
	this._repo.add(files, options || {}, function (err) {
		if ( err ) {
			deferred.reject(err);
		} else {
			deferred.resolve(this.status());
		}
	}.bind(this));

	return deferred.promise;
};

/*
* Remove files
* files - Array of String paths; or a String path.
**/
Git.prototype.removeFiles = function (files, options) {
	var deferred = when.defer();
	this._repo.remove(files, options || {}, function (err) {
		if ( err ) {
			deferred.reject(err);
		} else {
			deferred.resolve(this.status());
		}
	}.bind(this));

	return deferred.promise;
};

/*
 * Commit
 * @param commitMsg {String|'Updates'}
**/
Git.prototype.commit = function (commitMsg) {
	var deferred = when.defer();
	this._repo.commit(commitMsg || 'Updates', {
		all: true
	}, function (err) {
		if ( err ) {
			deferred.reject(err);
		} else {
			deferred.resolve(this.status());
		}
	}.bind(this));

	return deferred.promise;
};

/*
 * Push
 * @param remote {String|'origin'}
 * @param branch {String|current checked out branch}
**/
Git.prototype.push = function (remote, branch) {
	var deferred = when.defer();
	remote = remote || 'origin';
	branch = branch || this._currentBranch;
	this._repo.git('push', {'set-upstream': true}, [remote, branch], function (err) {
		if ( err ) {
			deferred.reject(err);
		} else {
			deferred.resolve(this.status());
		}
	}.bind(this));

	return deferred.promise;
};

module.exports = Git;
