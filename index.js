'use strict';

const Transform = require('stream').Transform;

const git = require('./lib/git');
const gutil = require('gulp-util');
const vinylFs = require('vinyl-fs');
const wrapPromise = require('wrap-promise');

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
module.exports = function gulpGhPages(options) {
	options = options || {};
	const origin = options.origin || 'origin';
	const branch = options.branch || 'gh-pages';
	const message = options.message || `Update ${new Date().toISOString()}`;

	const files = [];
	let TAG;
	if (branch !== 'gh-pages') {
		TAG = `[gh-pages (${branch})]`;
	} else {
		TAG = '[gh-pages]';
	}

	return new Transform({
		objectMode: true,
		transform: function collectFiles(file, enc, cb) {
			if (file.isNull()) {
				cb(null, file);
				return;
			}

			if (file.isStream()) {
				cb(new gutil.PluginError('gulp-gh-pages', 'Stream content is not supported'));
				return;
			}

			files.push(file);
			cb(null, file);
		},
		flush: function publish(cb) {
			if (files.length === 0) {
				gutil.log(TAG, 'No files in the stream.');
				cb();
				return;
			}

			let newBranchCreated = false;

			git.prepareRepo(options.remoteUrl, origin, options.cacheDir || '.publish')
			.then(repo => {
				gutil.log(TAG, 'Cloning repo');
				if (repo._localBranches.indexOf(branch) > -1) {
					gutil.log(TAG, `Checkout branch \`${branch}\``);
					return repo.checkoutBranch(branch);
				}

				if (repo._remoteBranches.indexOf(`${origin}/${branch}`) > -1) {
					gutil.log(TAG, `Checkout remote branch \`${branch}\``);
					return repo.checkoutBranch(branch);
				}

				gutil.log(TAG, `Create branch \`${branch}\` and checkout`);
				newBranchCreated = true;
				return repo.createAndCheckoutBranch(branch);
			})
			.then(repo => wrapPromise((resolve, reject) => {
				if (newBranchCreated) {
					resolve(repo);
					return;
				}

				// updating to avoid having local cache not up to date
				gutil.log(TAG, 'Updating repository');
				repo._repo.git('pull', err => {
					if (err) {
						reject(err);
						return;
					}
					resolve(repo);
				});
			}))
			.then(repo => wrapPromise((resolve, reject) => {
				repo._repo.remove('.', {r: true}, err => {
					if (err) {
						reject(err);
						return;
					}
					resolve(repo.status());
				});
			}))
			.then(repo => {
				gutil.log(TAG, 'Copying files to repository');

				return wrapPromise((resolve, reject) => {
					const destStream = vinylFs.dest(repo._repo.path)
					.on('error', reject)
					.on('end', () => {
						resolve(repo);
					})
					.resume();

					files.forEach(file => {
						destStream.write(file);
					});

					destStream.end();
				});
			})
			.then(repo => repo.addFiles('.', {force: options.force || false}))
			.then(repo => {
				const filesToBeCommitted = Object.keys(repo._staged).length;
				if (filesToBeCommitted === 0) {
					gutil.log(TAG, 'No files have changed.');
					cb();
					return;
				}

				gutil.log(TAG, `Adding ${filesToBeCommitted} files.`);
				gutil.log(TAG, `Committing "${message}"`);
				repo.commit(message).then(newRepo => {
					if (options.push === undefined || options.push) {
						gutil.log(TAG, 'Pushing to remote.');
						newRepo._repo.git('push', {
							'set-upstream': true
						}, [origin, newRepo._currentBranch], err => {
							if (err) {
								cb(err);
								return;
							}
							cb();
						});
						return;
					}
					cb();
				}, cb);
			})
			.catch(err => {
				setImmediate(() => {
					cb(new gutil.PluginError('gulp-gh-pages', err));
				});
			});
		}
	});
};
