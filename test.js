'use strict';

var assert = require('assert');
var path = require('path');

var File = require('vinyl');
var fs = require('graceful-fs');
var ghPages = require('./');
var git = require('./lib/git');
var github = require('octonode');
var logSymbols = require('log-symbols');
var PassThrough = require('readable-stream/passthrough');
var readRemoveFile = require('read-remove-file');
var rimraf = require('rimraf');
var uuid = require('node-uuid');

var tmpDir = '.publish';
var tmpStr = uuid.v4();
var tmpFile = new File({
  path: tmpStr,
  contents: new Buffer(tmpStr)
});
var files = [
  new File({
    path: '.gitignore',
    contents: new Buffer('ignored-path')
  }),
  new File({
    path: 'ignored-path',
    contents: new Buffer('ignored')
  }),
  tmpFile
];
var tmpRepoName = 'shinnn/css-wide-keywords';
var remoteUrl;

var accessToken = process.env.GH_ACCESS_TOKEN;
var client;

before(function(done) {
  if (accessToken) {
    console.log(
      logSymbols.success +
      ' Set Github Access token from the environment variable'
    );
    client = github.client(accessToken);
    remoteUrl = 'https://' + accessToken + '@github.com/' + tmpRepoName + '.git';
    done();

  } else {
    var accessTokenFile = 'gh-access-token.txt';

    fs.readFile(accessTokenFile, 'utf8', function(err, text) {
      if (err || !text) {
        console.warn(
          logSymbols.warning +
          ' Create a plain text file "' +
          accessTokenFile +
          '" which contains your Github access token.'
        );
        accessToken = '';
      } else {
        accessToken = text.trim();
        console.log(
          logSymbols.success +
          ' Set Github Access token from ' + accessTokenFile
        );
      }

      client = github.client(accessToken);
      remoteUrl = 'https://' + accessToken + '@github.com/' + tmpRepoName + '.git';
      done();
    });
  }
});

describe('git operations on a repo', function() {
  before(function(done) {
    rimraf(tmpDir, done);
  });

  it('should throw an error when checking out a non existent branch', function(done) {
    git.prepareRepo('https://github.com/' + tmpRepoName + '.git', 'origin', '.publish')
    .then(function(repo) {
      return repo.checkoutBranch('non-existent-branch');
    })
    .then(function() {
      done(new Error('Expected an error.'));
    }, function(err) {
      var expectedMsg = 'error: pathspec \'' +
                        'non-existent-branch' +
                        '\' did not match any file(s) known to git.\n';
      assert.notEqual(err.message.indexOf(expectedMsg), -1);
      done();
    });
  });
});

describe('git operations on special repositories', function() {
  before(function(done) {
    rimraf(tmpDir, done);
  });

  it('should be initialized on the default branch', function(done) {
    git.prepareRepo('https://github.com/LeaVerou/csss.git', null, '.publish')
    .then(function(repo) {
      assert.equal(repo._currentBranch, 'gh-pages');
      done();
    });
  });
});

describe('gulp-gh-pages', function() {
  before(function(done) {
    rimraf.sync(tmpDir);

    client.del('/repos/' + tmpRepoName + '/git/refs/heads/tmp', {}, function(err) {
      if (err && err.message !== 'Reference does not exist') {
        done(err);
        return;
      }

      client.post('/repos/' + tmpRepoName + '/git/refs', {
        ref: 'refs/heads/tmp',
        sha: '8d6c241faa1246137a57b9f3cefcafbf30f14966'
      }, done);
    });
  });

  it('should ignore empty vinyl file objects', function(done) {
    ghPages()
    .on('error', done)
    .on('data', function(file) {
      assert(file.isNull());
      done();
    })
    .end(new File());
  });

  it('should emit an error when it takes files with stream contents', function(done) {
    ghPages()
    .on('error', function(err) {
      assert.equal(err.message, 'Stream content is not supported');
      done();
    })
    .end(new File({contents: new PassThrough({objectMode: true})}));
  });

  it('should push commits to an existing gh-pages branch', function(done) {
    var stream = ghPages({
      remoteUrl: remoteUrl,
      branch: 'tmp',
      message: '[ci skip] temporary commit ("tmp" branch)'
    })
    .on('error', done)
    .on('data', function(file) {
      assert(file.isBuffer());
    })
    .on('end', function() {
      fs.readFile(path.join(tmpDir, tmpStr), function(err, buf) {
        assert.strictEqual(err, null);
        assert.equal(String(buf), tmpStr);
        done();
      });
    });

    files.forEach(function(file) {
      stream.write(file);
    });

    stream.end();
  });

  it('should not push any commits when no files has been changed', function(done) {
    var stream = ghPages({
      remoteUrl: remoteUrl,
      branch: 'tmp'
    })
    .on('error', done)
    .on('data', function(file) {
      assert(file.isBuffer());
    })
    .on('end', done);

    files.forEach(function(file) {
      stream.write(file);
    });

    stream.end();
  });

  it('should create and checkout a branch', function(done) {
    client.del('/repos/' + tmpRepoName + '/git/refs/heads/new', {}, function(err) {
      if (err && err.message !== 'Reference does not exist') {
        done(err);
        return;
      }

      var stream = ghPages({
        remoteUrl: remoteUrl,
        branch: 'new',
        message: '[ci skip] temporary commit ("new" branch)',
        push: true,
        force: true
      })
      .on('error', done)
      .on('data', function(file) {
        assert(file.isBuffer());
      })
      .on('end', function() {
        client.del('/repos/' + tmpRepoName + '/git/refs/heads/new', {}, function(reqErr) {
          if (reqErr && reqErr.message !== 'Reference does not exist') {
            done(reqErr);
            return;
          }
          done();
        });
      });

      stream.write(new File({
        path: '.gitignore',
        contents: new Buffer('node_modules\nfoo')
      }));

      stream.write(new File({
        path: 'foo',
        contents: new Buffer('hi')
      }));

      stream.end(new File({
        path: 'node_modules/bar.txt',
        contents: new Buffer('hello\n')
      }));
    });
  });

  it('should specify the cache directory path with `cacheDir` option', function(done) {
    ghPages({
      remoteUrl: remoteUrl,
      cacheDir: '__cache__',
      push: false
    })
    .on('error', done)
    .on('data', function(file) {
      assert(file.isBuffer());
    })
    .on('end', function() {
      readRemoveFile(path.join('__cache__', tmpStr), function(readErr, buf) {
        assert.strictEqual(readErr, null);
        assert.equal(String(buf), tmpStr);
        done();
      });
    })
    .end(tmpFile);
  });

  it('should emit an error when it fails to create a cache directory', function(done) {
    ghPages({
      remoteUrl: remoteUrl,
      cacheDir: path.join(__filename, 'dir')
    })
    .on('error', function(err) {
      assert(err.code);
      done();
    })
    .on('end', function() {
      done(new Error('Expected an error.'));
    })
    .end(tmpFile);
  });

  it('should emit an error when the repository doesn\'t exist', function(done) {
    ghPages({remoteUrl: 'https://_/_this_/_repo_/_does_/_not_/_exist_/_.git'})
    .on('error', function(err) {
      assert(err);
      done();
    })
    .on('end', function() {
      done(new Error('Expected an error.'));
    })
    .end(tmpFile);
  });

  it('should emit an error when the user has no permission to push the repo', function(done) {
    ghPages({remoteUrl: 'https://' + accessToken + '@github.com/bot/move.git'})
    .on('error', function(err) {
      assert(/Permission to/.test(err.message));
      done();
    })
    .on('end', function() {
      done(new Error('Expected an error.'));
    })
    .end(tmpFile);
  });

  it('should emit an error when the remote URL is not a git repository\'s URL', function(done) {
    ghPages({remoteUrl: 'https://example.org/'})
    .on('error', function(err) {
      assert(/'https:\/\/example\.org\/' not found/.test(err.message));
      done();
    })
    .on('end', function() {
      done(new Error('Expected an error.'));
    })
    .end(tmpFile);
  });

  it('should emit an error when the current directory is not a git repository', function(done) {
    process.chdir('/');

    ghPages()
    .on('error', function(err) {
      assert(err);
      process.chdir(path.resolve(__dirname, '..'));
      done();
    })
    .on('end', function() {
      done(new Error('Expected an error.'));
    })
    .end(tmpFile);
  });
});
