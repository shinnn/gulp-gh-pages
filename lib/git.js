'use strict';

var path = require('path');

var git = require('gift');
var rimraf = require('rimraf');
var tmpDir = require('os').tmpdir();
var wrapPromise = require('wrap-promise');

/*
 * Git Constructor
**/
function Git (repo, initialBranch) {
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
  var returnedArgs = Array.prototype.slice.call(arguments);
  var fn = returnedArgs.shift();
  var self = this;

  return wrapPromise(function(resolve, reject) {
    returnedArgs.push(function(err, args) {
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
  return wrapPromise(function(resolve, reject) {
    repo.config(function(err, config) {
      if (err) {
        reject(new Error('Failed to find git repository in ' + config.path));
        return;
      }
      resolve(config.items['remote.' + remote + '.url']);
    });
  });
}

/*
 * Clone repo
 * Returns repo object
**/
function prepareRepo(remoteUrl, origin, dir) {
  var promise;
  if (remoteUrl) {
    // if a remoteUrl was provided, use it
    promise = wrapPromise.Promise.resolve(remoteUrl);
  } else {
    // else try to extract it from the .git folder of
    // the current directory.
    promise = getRemoteUrl(git(process.cwd()), origin);
  }

  return promise.then(function(rUrl) {
    // use the provided cache-folder or create a folder in the
    // systems temp-directory.
    dir = dir || path.join(tmpDir, 'tmpRepo');
    remoteUrl = rUrl;

    return wrapPromise(function(resolve, reject) {
      function initRepo(repo) {
        repo.branch(function(err, head) {
          if (err) {
            reject(err);
            return;
          }
          resolve(new Git(repo, head.name).status());
        });
      }

      function clearAndInitRepo() {
        rimraf.sync(dir);
        git.clone(rUrl, dir, function(err, repo) {
          if (err) {
            reject(err);
            return;
          }
          initRepo(repo);
        });
      }

      // assume that if there is a .git folder get its remoteUrl
      // and check if it mathces the one we want to use.
      getRemoteUrl(git(dir), origin).then(function(cwdRemoteUrl) {
        if (remoteUrl === cwdRemoteUrl) {
          initRepo(git(dir));
          return;
        }
        clearAndInitRepo();
      }, function() {
        clearAndInitRepo();
      });
    });
  });
}

/*
 * List Local branches
**/
function listLocalBranches(repo) {
  return caller.call(repo, repo.branches).then(function(branches) {
    return branches.map(function(branch) {
      return branch.name;
    });
  });
}

function listRemoteBranches(repo) {
  return caller.call(repo, repo.git, 'branch', {'r': true}, [])
  .then(function(branches) {
    branches = branches.split('\n');
    branches.shift();
    branches.pop();
    return branches.map(function(branchName) {
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
  .then(function(commits) {
    return commits.map(function(commitObj) {
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
Git.prototype.status = function() {
  var self = this;

  return wrapPromise(function(resolve, reject) {
    self._repo.status(function(err, repo) {
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
      .then(function(args) {
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
  var self = this;

  return wrapPromise(function(resolve, reject) {
    self._repo.checkout(name, function(err) {
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
  var self = this;

  return wrapPromise(function(resolve, reject) {
    self._repo.create_branch(name, function(err) {
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
  .then(function(repo) {
    return repo.checkoutBranch(name);
  });
};

Git.prototype.addFiles = function(files, options) {
  var self = this;

  return wrapPromise(function(resolve, reject) {
    self._repo.add(files, options, function(err) {
      if (err) {
        reject(err);
        return;
      }

      resolve(self.status());
    });
  });
};

Git.prototype.commit = function(commitMsg) {
  var self = this;

  return wrapPromise(function(resolve, reject) {
    self._repo.commit(commitMsg, {all: true}, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(self.status());
      }
    });
  });
};

module.exports = Git;
