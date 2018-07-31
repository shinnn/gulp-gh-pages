'use strict';

const {promisify} = require('util');

const git = require('gift');
const rimrafCallback = require('rimraf');

const rimraf = promisify(rimrafCallback);

async function listLocalBranches(repo) {
	return (await promisify(repo.branches.bind(repo))()).map(({name}) => name);
}

async function listRemoteBranches(repo) {
	const branches = (await promisify(repo.git.bind(repo))('branch', {r: true})).split('\n');
	branches.shift();
	branches.pop();

	return branches.map(branchName => {
		branchName = branchName.trim();
		return branchName;
	});
}

async function getCommits(repo, branchName) {
	return (await promisify(repo.commits.bind(repo))(branchName)).map(({id, message, committed_date}) => {
		return {id, message, committed_date};
	});
}

class Git {
	constructor(repo, initialBranch) {
		this._repo = repo;
		this._staged = [];
		this._localBranches = [];
		this._remoteBranches = [];
		this._currentBranch = initialBranch;
		this._commits = [];
	}

	/*
	* Status
	* files - Array of String paths; or a String path.
	**/
	async status() {
		const repo = await promisify(this._repo.status.bind(this._repo))();
		this._repo = repo.repo;
		this._staged = repo.files;
		[this._commits, this._remoteBranches, this._localBranches] = await Promise.all([
			getCommits(this._repo, this._currentBranch),
			listRemoteBranches(this._repo),
			listLocalBranches(this._repo)
		]);

		return this;
	}

	async checkoutBranch(name) {
		await promisify(this._repo.checkout.bind(this._repo))(name);
		this._currentBranch = name;

		return this.status();
	}

	async createBranch(name) {
		await promisify(this._repo.create_branch.bind(this._repo))(name);
		this._currentBranch = name;

		return this.status();
	}

	async createAndCheckoutBranch(name) {
		return (await this.createBranch(name)).checkoutBranch(name);
	}

	async addFiles(files, options) {
		await promisify(this._repo.add.bind(this._repo))(files, options);
		return this.status();
	}

	async commit(commitMsg) {
		await promisify(this._repo.commit.bind(this._repo))(commitMsg, {all: true});
		return this.status();
	}
}

/*
 * Gets the URL for the specified remote of a repo
 */
async function getRemoteUrl(repo, remote) {
	return (await promisify(repo.config.bind(repo))()).items[`remote.${remote}.url`];
}

/*
 * Clone repo
 * Returns repo object
**/
async function prepareRepo(remoteUrl, origin, dir) {
	// assume that if there is a .git folder get its remoteUrl
	// and check if it mathces the one we want to use.
	remoteUrl = remoteUrl || await getRemoteUrl(git(process.cwd()), origin);

	async function initRepo(repo) {
		const head = await promisify(repo.branch.bind(repo))();
		return new Git(repo, head.name).status();
	}

	async function clearAndInitRepo() {
		await rimraf(dir);
		return initRepo(await promisify(git.clone.bind(git))(remoteUrl, dir));
	}

	try {
		const cwdRemoteUrl = await getRemoteUrl(git(dir), origin);

		if (remoteUrl === cwdRemoteUrl) {
			return initRepo(git(dir));
		}

		return clearAndInitRepo();
	} catch (err) {
		return clearAndInitRepo();
	}
}

Git.prepareRepo = prepareRepo;
Git.getRemoteUrl = getRemoteUrl;

module.exports = Git;
