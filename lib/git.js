'use strict';

const git = require('gift');
const rimraf = require('rimraf');
const wrapPromise = require('wrap-promise');

/*
 * Git Constructor
**/
function Git(repo, initialBranch) {
	this._repo = repo;
	this._staged = [];
	this._localBranches = [];
	this._remoteBranches = [];
	this._currentBranch = initialBranch;
	this._commits = [];
}

/*
 * Caller abstract method
 * for promisifying traditional callback methods
**/
function caller() {
	const returnedArgs = Array.prototype.slice.call(arguments); // eslint-disable-line
	const fn = returnedArgs.shift();
	const self = this;

	return wrapPromise((resolve, reject) => {
		returnedArgs.push((err, args) => {
			if (err) {
				reject(err);
				return;
			}
			resolve(args);
		});

		fn.apply(self, returnedArgs);
	});
}

/*
 * Gets the URL for the specified remote of a repo
 */
function getRemoteUrl(repo, remote) {
	return wrapPromise((resolve, reject) => {
		repo.config((err, config) => {
			if (err) {
				reject(new Error(`Failed to find git repository in ${config.path}`));
				return;
			}
			resolve(config.items[`remote.${remote}.url`]);
		});
	});
}

/*
 * Clone repo
 * Returns repo object
**/
function prepareRepo(remoteUrl, origin, dir) {
	let promise;
	if (remoteUrl) {
		// if a remoteUrl was provided, use it
		promise = wrapPromise.Promise.resolve(remoteUrl);
	} else {
		// else try to extract it from the .git folder of
		// the current directory.
		promise = getRemoteUrl(git(process.cwd()), origin);
	}

	return promise.then(rUrl => {
		remoteUrl = rUrl;

		return wrapPromise((resolve, reject) => {
			function initRepo(repo) {
				repo.branch((err, head) => {
					if (err) {
						reject(err);
						return;
					}
					resolve(new Git(repo, head.name).status());
				});
			}

			function clearAndInitRepo() {
				rimraf(dir, rmErr => {
					if (rmErr) {
						reject(rmErr);
						return;
					}

					git.clone(rUrl, dir, (cloneErr, repo) => {
						if (cloneErr) {
							reject(cloneErr);
							return;
						}
						initRepo(repo);
					});
				});
			}

			// assume that if there is a .git folder get its remoteUrl
			// and check if it mathces the one we want to use.
			getRemoteUrl(git(dir), origin).then(cwdRemoteUrl => {
				if (remoteUrl === cwdRemoteUrl) {
					initRepo(git(dir));
					return;
				}
				clearAndInitRepo();
			}, () => {
				clearAndInitRepo();
			});
		});
	});
}

/*
 * List Local branches
**/
function listLocalBranches(repo) {
	return caller.call(repo, repo.branches).then(branches => branches.map(branch => branch.name));
}

function listRemoteBranches(repo) {
	return caller.call(repo, repo.git, 'branch', {r: true}, [])
	.then(branches => {
		branches = branches.split('\n');
		branches.shift();
		branches.pop();
		return branches.map(branchName => {
			branchName = branchName.trim();
			return branchName;
		});
	});
}

/*
 * List commits for specific branch
**/
function getCommits(repo, branchName) {
	return caller.call(repo, repo.commits, branchName)
	.then(commits => commits.map(commitObj => {
		return {
			id: commitObj.id,
			message: commitObj.message,
			committed_date: commitObj.committed_date
		};
	}));
}

Git.prepareRepo = prepareRepo;
Git.getRemoteUrl = getRemoteUrl;

/*
 * Status
 * files - Array of String paths; or a String path.
**/
Git.prototype.status = function() {
	const self = this;

	return wrapPromise((resolve, reject) => {
		self._repo.status((err, repo) => {
			if (err) {
				reject(err);
				return;
			}

			self._repo = repo.repo;
			self._staged = repo.files;
			wrapPromise.Promise.all([
				getCommits(self._repo, self._currentBranch),
				listRemoteBranches(self._repo),
				listLocalBranches(self._repo)
			])
			.then(args => {
				self._remoteBranches = args[1];
				self._localBranches = args[2];
				self._commits = args[0];
				resolve(self);
			}, reject);
		});
	});
};

/*
 * Checkout a specific branch in a repo
 * @param name {String} -  String name of the branch.
**/
Git.prototype.checkoutBranch = function(name) {
	const self = this;

	return wrapPromise((resolve, reject) => {
		self._repo.checkout(name, err => {
			if (err) {
				reject(err);
				return;
			}

			self._currentBranch = name;
			resolve(self.status());
		});
	});
};

/*
 * Create a branch
 * @param name {String} -  String name of the new branch.
**/
Git.prototype.createBranch = function(name) {
	const self = this;

	return wrapPromise((resolve, reject) => {
		self._repo.create_branch(name, err => {
			if (err) {
				reject(err);
			} else {
				self._currentBranch = name;
				resolve(self.status());
			}
		});
	});
};

/*
 * Create and checkout a branch
 * @param name {String} -  String name of the new branch.
**/
Git.prototype.createAndCheckoutBranch = function(name) {
	return this.createBranch(name)
	.then(repo => repo.checkoutBranch(name));
};

Git.prototype.addFiles = function(files, options) {
	const self = this;

	return wrapPromise((resolve, reject) => {
		self._repo.add(files, options, err => {
			if (err) {
				reject(err);
				return;
			}

			resolve(self.status());
		});
	});
};

Git.prototype.commit = function(commitMsg) {
	const self = this;

	return wrapPromise((resolve, reject) => {
		self._repo.commit(commitMsg, {all: true}, err => {
			if (err) {
				reject(err);
			} else {
				resolve(self.status());
			}
		});
	});
};

module.exports = Git;
