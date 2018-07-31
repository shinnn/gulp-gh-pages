'use strict';

const assert = require('assert').strict;
const {PassThrough} = require('stream');
const {join} = require('path');
const {randomBytes} = require('crypto');
const {readFile} = require('fs').promises;

const File = require('vinyl');
const ghPages = require('.');
const git = require('./lib.js');
const github = require('octonode');
const readRemoveFile = require('read-remove-file');
const rimraf = require('rimraf');

const tmpDir = '.publish';
const tmpStr = randomBytes(32).toString('hex');
const tmpFile = new File({
	path: tmpStr,
	contents: Buffer.from(tmpStr)
});
const files = [
	new File({
		path: '.gitignore',
		contents: Buffer.from('ignored-path')
	}),
	new File({
		path: 'ignored-path',
		contents: Buffer.from('ignored')
	}),
	tmpFile
];
const tmpRepoName = 'shinnn/css-wide-keywords';
let remoteUrl;

let accessToken = process.env.GH_ACCESS_TOKEN;
let client;

before(async () => {
	if (accessToken) {
		client = github.client(accessToken);
		remoteUrl = `https://${accessToken}@github.com/${tmpRepoName}.git`;

		return;
	}

	const accessTokenFile = 'gh-access-token.txt';

	try {
		accessToken = (await readFile(accessTokenFile, 'utf8')).trim();
	} catch {
		throw new Error(`Create a plain text file "${accessTokenFile}" which contains your Github access token.`);
	}

	client = github.client(accessToken);
	remoteUrl = `https://${accessToken}@github.com/${tmpRepoName}.git`;
});

describe('git operations on special repositories', () => {
	before(done => rimraf(tmpDir, done));

	it('should be initialized on the default branch', async () => {
		const repo = await git.prepareRepo('https://github.com/LeaVerou/csss.git', null, '.publish');
		assert.equal(repo._currentBranch, 'gh-pages');
	});
});

describe('gulp-gh-pages', () => {
	before(done => {
		rimraf.sync(tmpDir);

		client.del(`/repos/${tmpRepoName}/git/refs/heads/tmp`, {}, err => {
			if (err && err.message !== 'Reference does not exist') {
				done(err);
				return;
			}

			client.post(`/repos/${tmpRepoName}/git/refs`, {
				ref: 'refs/heads/tmp',
				sha: '8d6c241faa1246137a57b9f3cefcafbf30f14966'
			}, done);
		});
	});

	it('should ignore empty vinyl file objects', done => {
		ghPages()
		.on('error', done)
		.on('data', file => {
			assert(file.isNull());
			done();
		})
		.end(new File());
	});

	it('should emit an error when it takes files with stream contents', done => {
		ghPages()
		.on('error', err => {
			assert.equal(err.message, 'Stream content is not supported');
			done();
		})
		.end(new File({contents: new PassThrough({objectMode: true})}));
	});

	it('should push commits to an existing gh-pages branch', done => {
		const stream = ghPages({
			remoteUrl,
			branch: 'tmp',
			message: '[ci skip] temporary commit ("tmp" branch)'
		})
		.on('error', done)
		.on('data', file => assert(file.isBuffer()))
		.on('end', async () => {
			assert.equal(await readFile(join(tmpDir, tmpStr), 'utf8'), tmpStr);
			done();
		});

		for (const file of files) {
			stream.write(file);
		}

		stream.end();
	});

	it('should not push any commits when no files has been changed', done => {
		const stream = ghPages({
			remoteUrl,
			branch: 'tmp'
		})
		.on('error', done)
		.on('data', file => assert(file.isBuffer()))
		.on('end', done);

		for (const file of files) {
			stream.write(file);
		}

		stream.end();
	});

	it('should create and checkout a branch', done => {
		client.del(`/repos/${tmpRepoName}/git/refs/heads/new`, {}, err => {
			if (err && err.message !== 'Reference does not exist') {
				done(err);
				return;
			}

			const stream = ghPages({
				remoteUrl,
				branch: 'new',
				message: '[ci skip] temporary commit ("new" branch)',
				push: true,
				force: true
			})
			.on('error', done)
			.on('data', file => assert(file.isBuffer()))
			.on('end', () => {
				client.del(`/repos/${tmpRepoName}/git/refs/heads/new`, {}, reqErr => {
					if (reqErr && reqErr.message !== 'Reference does not exist') {
						done(reqErr);
						return;
					}

					done();
				});
			});

			stream.write(new File({
				path: '.gitignore',
				contents: Buffer.from('node_modules\nfoo')
			}));

			stream.write(new File({
				path: 'foo',
				contents: Buffer.from('hi')
			}));

			stream.end(new File({
				path: 'node_modules/bar.txt',
				contents: Buffer.from('hello\n')
			}));
		});
	});

	it('should specify the cache directory path with `cacheDir` option', done => {
		ghPages({
			remoteUrl,
			cacheDir: '__cache__',
			push: false
		})
		.on('error', done)
		.on('data', file => {
			assert(file.isBuffer());
		})
		.on('end', async () => {
			assert.equal(
				await readRemoveFile(join(__dirname, '__cache__', tmpStr), 'utf8'),
				tmpStr
			);

			done();
		})
		.end(tmpFile);
	});

	it('should emit an error when it fails to create a cache directory', done => {
		ghPages({
			remoteUrl,
			cacheDir: join(__filename, 'dir')
		})
		.on('error', err => {
			assert(err.code);
			done();
		})
		.on('end', () => done(new Error('Expected an error.')))
		.end(tmpFile);
	});

	it('should emit an error when the repository doesn\'t exist', done => {
		ghPages({remoteUrl: 'https://_/_this_/_repo_/_does_/_not_/_exist_/_.git'})
		.on('error', err => {
			assert(err);
			done();
		})
		.on('end', () => done(new Error('Expected an error.')))
		.end(tmpFile);
	});

	it('should emit an error when the user has no permission to push the repo', done => {
		ghPages({remoteUrl: `https://${accessToken}@github.com/z/dotfiles.git`})
		.on('error', err => {
			assert(/Permission to/.test(err.message));
			done();
		})
		.on('end', () => done(new Error('Expected an error.')))
		.end(tmpFile);
	});

	it('should emit an error when the remote URL is not a git repository\'s URL', done => {
		ghPages({remoteUrl: 'https://example.org/'})
		.on('error', err => {
			assert(/ENOENT/.test(err.message));
			done();
		})
		.on('end', () => done(new Error('Expected an error.')))
		.end(tmpFile);
	});

	it('should emit an error when the current directory is not a git repository', done => {
		process.chdir('/');

		ghPages()
		.on('error', err => {
			assert(err);
			process.chdir(join(__dirname, '..'));
			done();
		})
		.on('end', () => done(new Error('Expected an error.')))
		.end(tmpFile);
	});
});
