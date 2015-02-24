/* global jasmine, describe, beforeEach, it, expect */
'use strict';

var fs = require('fs');
var path = require('path');

var git = require('../lib/git');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var when = require('when');

jasmine.getEnv().defaultTimeoutInterval = 10000;

function copyFile(src, dest) {
  var defer = when.defer();
  var called = false;

  function done(err) {
    if (!called) {
      defer.reject(err);
    }
  }

  var read = fs.createReadStream(src);
  read.on('error', done);

  var write = fs.createWriteStream(dest);
  write.on('error', done);

  write.on('close', function() {
    defer.resolve();
  });

  read.pipe(write);

  return defer.promise;
}

function copyFileHelper (repo, src, dest) {
  var defer = when.defer();

  copyFile(src, dest).then(function() {
    defer.resolve(repo);
  }, defer.reject);

  return defer.promise;
}

describe('git operations on a repo', function() {
  var promise;
  var tmpDir = path.join(require('os').tmpdir(), 'tmpRepo');
  var remoteUrl = 'git://github.com/rowoot/test-gh-pages.git';

  beforeEach(function() {
    rimraf.sync(tmpDir);
    promise = git.prepareRepo(remoteUrl);
  });

  it('should determine the remoteUrl of a git repository', function(cb) {
    promise
    .then(function(repo) {
      return git.getRemoteUrl(repo._repo, 'origin');
    })
    .then(function(rUrl) {
      expect(rUrl).toBe(remoteUrl);
      cb();
    });
  });

  it('should create a branch', function(cb) {
    var branchName = 'new-branch';

    promise
    .then(function(repo) {
      return repo.createBranch(branchName);
    })
    .then(function(repo) {
      expect(repo._localBranches).toContain(branchName);
      cb();
    }, function(err) {
      console.log(err);
    });
  });

  it('should throw an error when checking out a non existent branch', function(cb) {
    var branchName = 'non-existent-branch';

    promise
    .then(function(repo) {
      return repo.checkoutBranch(branchName);
    })
    .catch(function(err) {
      var expectedMsg = 'error: pathspec \'' +
                        branchName +
                        '\' did not match any file(s) known to git.\n';
      expect(err.message.indexOf(expectedMsg)).not.toBe(-1);
      cb();
    });
  });

  it('should checkout a existing remote branch', function(cb) {
    var branchName = 'gh-pages';

    promise
    .then(function(repo) {
      return repo.checkoutBranch(branchName);
    })
    .then(function(repo) {
      expect(repo._currentBranch).toBe(branchName);
      cb();
    });
  });

  it('should create and checkout a branch', function(cb) {
    var branchName = 'new-and-checkout-branch';

    promise
    .then(function(repo) {
      return repo.createAndCheckoutBranch(branchName);
    })
    .then(function(repo) {
      expect(repo._currentBranch).toBe(branchName);
      expect(repo._localBranches).toContain(branchName);
      cb();
    });
  });

  it('should add a file successfully and stage it', function(cb) {
    var file = 'test.txt';
    var src = path.join(__dirname, 'fixtures', file);
    var dest = path.join(tmpDir, file);

    promise
    .then(function(repo) {
      return copyFileHelper(repo, src, dest);
    })
    .then(function(repo) {
      return repo.addFiles(path.join(tmpDir, file));
    })
    .then(function(repo) {
      expect(Object.keys(repo._staged).length).toBe(1);
      expect(Object.keys(repo._staged)).toContain(file);
      cb();
    });
  });

  describe('git ignored files', function() {
    function noop () {}

    function absolutePathFromFixtures (filename) {
      var absolute = path.join(__dirname, 'fixtures', filename);
      return absolute;
    }

    function absolutePathToTmp (filename) {
      var absolute = path.join(tmpDir, filename);
      return absolute;
    }

    function ensureFolder (src, dest) {
      var srcStat = fs.statSync(src);
      var dir;
      if (!srcStat.isDirectory()) {
        dir = path.dirname(dest);
      } else {
        dir = dest;
      }
      mkdirp.sync(dir);
    }

    function promiseCopy (filename) {
      var src = absolutePathFromFixtures(filename);
      var dest = absolutePathToTmp(filename);
      ensureFolder(src, dest);
      var copier = function(repo) {
          return copyFileHelper(repo, src, dest);
        };
      return copier;
    }

    function promiseAdd (filename, options) {
      return function(repo) {
        return repo.addFiles(absolutePathToTmp(filename), options || {});
      };
    }

    var alreadyAddedCount = 1;
    var promiseWithIgnoreFile;

    beforeEach(function copyIgnoreFile(done) {
      var ignoreFile = '.gitignore';

      promiseWithIgnoreFile = promise
      .then(promiseCopy(ignoreFile))
      .then(promiseAdd(ignoreFile))
      .then(function(repo) {
        // All tests below have to take the fact
        // that the ignore file would be added into consideration.
        expect(Object.keys(repo._staged).length).toBe(alreadyAddedCount);
        expect(Object.keys(repo._staged)).toContain(ignoreFile);
        return repo;
      })
      .then(function(repo) {
        done();
        return repo;
      });
    });

    it('should add an unignored file and stage it', function(cb) {
      var file = 'test.txt';

      promiseWithIgnoreFile
      .then(promiseCopy(file))
      .then(promiseAdd(file))
      .then(function(repo) {
        // TODO: check that the error is "correct".
        expect(Object.keys(repo._staged).length).toBe(alreadyAddedCount + 1);
        expect(Object.keys(repo._staged)).toContain(file);
        cb();
      });
    });

    it('should not add an ignored file nor stage it', function(cb) {
      var ignoredFile = 'ignored-file.txt';
      var savedRepo;

      promiseWithIgnoreFile
      .then(promiseCopy(ignoredFile))
      .then(function(repo) {
        // Saving repo as the next step is expected to throw.
        savedRepo = repo;
        return repo;
      })
      .then(promiseAdd(ignoredFile))
      .then(function() {
        // Test failed, as an error was expected.
        expect(noop).toThrow();
        cb();
      },
      function(error) {
        // TODO: check that the error is "correct".
        expect(error).not.toBeFalsy();
        return savedRepo;
      })
      .then(function(repo) {
        expect(Object.keys(repo._staged).length).toBe(alreadyAddedCount + 0);
        expect(Object.keys(repo._staged)).not.toContain(ignoredFile);
        cb();
      });
    });

    it('shouldn\'t add/stage an ignored file but add and stage an unignored file', function(cb) {
      var ignoredFile = 'ignored-file.txt';
      var file = 'test.txt';
      var savedRepo;

      promiseWithIgnoreFile
      .then(promiseCopy(ignoredFile))
      .then(promiseCopy(file))
      .then(promiseAdd(file))
      .then(function(repo) {
        // Saving repo as the next step is expected to throw.
        savedRepo = repo;
        return repo;
      })
      .then(promiseAdd(ignoredFile))
      .then(function() {
        // Test failed, as an error was expected.
        expect(noop).toThrow();
        cb();
      },
      function(error) {
        // TODO: check that the error is "correct".
        expect(error).not.toBeFalsy();
        return savedRepo;
      })
      .then(function(repo) {
        expect(Object.keys(repo._staged).length).toBe(alreadyAddedCount + 1);
        expect(Object.keys(repo._staged)).not.toContain(ignoredFile);
        expect(Object.keys(repo._staged)).toContain(file);
        cb();
      });
    });

    it('should force add an ignored file successfully and stage it', function(cb) {
      var ignoredFile = 'ignored-file.txt';

      promiseWithIgnoreFile
      .then(promiseCopy(ignoredFile))
      .then(promiseAdd(ignoredFile, {force: true}))
      .then(function(repo) {
        expect(Object.keys(repo._staged).length).toBe(alreadyAddedCount + 1);
        expect(Object.keys(repo._staged)).toContain(ignoredFile);
        cb();
      });
    });

    it('should force add an ignored folder successfully and stage it', function(cb) {
      var ignoredFolder = 'ignored-folder/';
      var ignoredFile = 'ignored-folder/file-in-ignored-folder.txt';

      promiseWithIgnoreFile
      // The current copy functions do not copy folder structures, so
      // copying the file and expecting the folder to be created.
      .then(promiseCopy(ignoredFile))
      .then(promiseAdd(ignoredFolder, {force: true}))
      .then(function(repo) {
        expect(Object.keys(repo._staged).length).toBe(alreadyAddedCount + 1);
        expect(Object.keys(repo._staged)).toContain(ignoredFile);
        cb();
      });
    });
  });

    // it('should commit a file successfully', function(cb) {
    //   var file = 'test.txt';
    //   var message = 'commit message';
    //   var src = path.join(__dirname, 'fixtures', file);
    //   var dest = path.join(tmpDir, file);

    //   promise
    //   .then(function(repo) {
    //     return copyFileHelper(repo, src, dest);
    //   })
    //   .then(function(repo) {
    //     return repo.addFiles(path.join(tmpDir , file));
    //   })
    //   .then(function(repo) {
    //     return repo.commit(message);
    //   })
    //   .then(function(repo) {
    //     expect(Object.keys(repo._staged).length).toBe(0);
    //     expect(repo._commits[0].message).toBe(message);
    //     cb();
    //   });
    // });
});

describe('git operations on special repositories', function() {
  var tmpDir = path.join(require('os').tmpdir(), 'tmpRepo');

  beforeEach(function() {
    rimraf.sync(tmpDir);
  });

  it('should be initialized on the default branch', function(cb) {
    var promise = git.prepareRepo('git://github.com/LeaVerou/csss.git');
    promise.then(function(repo) {
      expect(repo._currentBranch).toBe('gh-pages');
      cb();
    });
  });
});
