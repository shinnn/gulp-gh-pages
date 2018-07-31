'use strict';

const {promisify} = require('util');
const {finished, Transform} = require('stream');

const fancyLog = require('fancy-log');
const git = require('./lib.js');
const PluginError = require('plugin-error');
const vinylFs = require('vinyl-fs');

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
	options = {...options};
	const origin = options.origin || 'origin';
	const branch = options.branch || 'gh-pages';
	const message = options.message || `Update ${new Date().toISOString()}`;

	const files = [];
	const TAG = branch === 'gh-pages' ? '[gh-pages]' : `[gh-pages (${branch})]`;

	return new Transform({
		objectMode: true,
		transform(file, enc, cb) {
			if (file.isNull()) {
				cb(null, file);
				return;
			}

			if (file.isStream()) {
				cb(new PluginError('gulp-gh-pages', 'Stream content is not supported'));
				return;
			}

			files.push(file);
			cb(null, file);
		},
		async flush(cb) {
			if (files.length === 0) {
				fancyLog(TAG, 'No files in the stream.');
				cb();
				return;
			}

			try {
				const repo = await git.prepareRepo(options.remoteUrl, origin, options.cacheDir || '.publish');
				fancyLog(TAG, 'Cloning repo');

				if (repo._localBranches.includes(branch)) {
					fancyLog(TAG, `Checkout branch \`${branch}\``);
					await repo.checkoutBranch(branch);
				}

				if (repo._remoteBranches.includes(`${origin}/${branch}`)) {
					fancyLog(TAG, `Checkout remote branch \`${branch}\``);
					await repo.checkoutBranch(branch);
					fancyLog(TAG, 'Updating repository');
					// updating to avoid having local cache not up to date
					await promisify(repo._repo.git.bind(repo._repo))('pull');
				} else {
					fancyLog(TAG, `Create branch \`${branch}\` and checkout`);
					await repo.createAndCheckoutBranch(branch);
				}

				await promisify(repo._repo.remove.bind(repo._repo))('.', {r: true});
				fancyLog(TAG, 'Copying files to repository');

				const destStream = vinylFs.dest(repo._repo.path);

				for (const file of files) {
					destStream.write(file);
				}

				setImmediate(() => destStream.end());
				await promisify(finished)(destStream);
				await repo.addFiles('.', {force: options.force || false});
				const filesToBeCommitted = Object.keys(repo._staged).length;

				if (filesToBeCommitted === 0) {
					fancyLog(TAG, 'No files have changed.');
					cb();
					return;
				}

				fancyLog(TAG, `Adding ${filesToBeCommitted} files.`);
				fancyLog(TAG, `Committing "${message}"`);

				const nrepo = await repo.commit(message);

				if (!(options.push === undefined || options.push)) {
					cb();
					return;
				}

				fancyLog(TAG, 'Pushing to remote.');
				await promisify(nrepo._repo.git.bind(nrepo._repo))('push', {
					'set-upstream': true
				}, [origin, nrepo._currentBranch]);

				cb();
			} catch (err) {
				cb(err);
			}
		}
	});
};
