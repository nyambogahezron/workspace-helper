#!/usr/bin/env bun

import {
	intro,
	outro,
	select,
	confirm,
	spinner,
	note,
	cancel,
	isCancel,
} from '@clack/prompts';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import pc from 'picocolors';

import { WorkspaceInfo, ChangeRecord } from './src/types';
import { WorkspaceManager } from './src/workspace';
import { PackageOperations } from './src/package-operations';
import { ConflictResolver } from './src/conflict-resolver';
import { UIHelpers } from './src/ui';
import { groupWorkspacesByLocation, detectPackageManager } from './src/utils';

class PackageUpdater {
	private workspaceManager: WorkspaceManager;
	private packageOps: PackageOperations;
	private conflictResolver: ConflictResolver;
	private ui: UIHelpers;

	constructor(private rootPath: string = process.cwd()) {
		this.workspaceManager = new WorkspaceManager(rootPath);
		this.ui = new UIHelpers(rootPath);

		// These will be initialized after workspace scanning
		this.packageOps = null as any;
		this.conflictResolver = null as any;
	}

	async init() {
		console.clear();
		intro(pc.bold(pc.cyan('📦 Package Updater')));

		await this.workspaceManager.scanWorkspaces();
		const workspaces = this.workspaceManager.getWorkspaces();

		// Initialize other modules with workspace data and required dependencies
		this.packageOps = new PackageOperations(
			workspaces,
			this.rootPath,
			() => this.workspaceManager.displayWorkspaces(),
			(type: string) => this.ui.getTypeIcon(type),
			(workspace: WorkspaceInfo, packageName: string) =>
				this.ui.hasPackage(workspace, packageName),
			(targetWorkspaces: string[]) => this.installPackages(targetWorkspaces)
		);

		this.conflictResolver = new ConflictResolver(
			workspaces,
			(
				packageName: string,
				targetVersion: string,
				versions: Map<string, WorkspaceInfo[]>,
				dryRun: boolean,
				suppressExit?: boolean
			) =>
				this.executeSyncVersions(
					packageName,
					targetVersion,
					versions,
					dryRun,
					suppressExit
				),
			(targetWorkspaces: string[]) => this.installPackages(targetWorkspaces)
		);
	}

	async run() {
		try {
			const action = await select({
				message: 'What would you like to do?',
				options: [
					{ value: 'add', label: '➕ Add or update package' },
					{ value: 'remove', label: '🗑️  Remove package' },
					{ value: 'sync', label: '🔄 Sync package versions' },
					{
						value: 'conflicts',
						label: '⚠️  Find and resolve version conflicts',
					},
					{ value: 'list', label: '📋 List all packages' },
					{
						value: 'install',
						label: '🚀 Install packages (run package manager)',
					},
				],
			});

			if (isCancel(action)) {
				cancel('Operation cancelled');
				return;
			}

			switch (action) {
				case 'add':
					await this.packageOps.addOrUpdatePackage();
					break;
				case 'remove':
					await this.packageOps.removePackage();
					break;
				case 'sync':
					const syncResult = await this.packageOps.syncPackageVersions();
					if (syncResult) {
						await this.executeSyncVersions(
							syncResult.packageName,
							syncResult.targetVersion,
							syncResult.versions,
							syncResult.dryRun
						);
					}
					break;
				case 'conflicts':
					await this.conflictResolver.findAndResolveConflicts();
					break;
				case 'list':
					await this.listPackages();
					break;
				case 'install':
					await this.showInstallPrompt();
					break;
			}
		} catch (error) {
			outro(pc.red('❌ An error occurred: ' + (error as Error).message));
			process.exit(1);
		}
	}

	private async listPackages() {
		const packageMap = this.workspaceManager.getAllPackages();
		this.ui.displayPackageList(packageMap);
	}

	private async showInstallPrompt() {
		this.workspaceManager.displayWorkspaces();

		const confirmInstall = await confirm({
			message:
				'Install packages for all workspaces? (This will run the package manager)',
			initialValue: true,
		});

		if (confirmInstall) {
			const allWorkspaces = this.workspaceManager
				.getWorkspaces()
				.map((w) => w.path);
			await this.installPackages(allWorkspaces);
			outro(pc.green('✨ Package installation completed successfully!'));
		}
	}

	private async executeSyncVersions(
		packageName: string,
		targetVersion: string,
		versions: Map<string, WorkspaceInfo[]>,
		dryRun: boolean,
		suppressExit?: boolean
	) {
		const s = spinner();
		s.start(dryRun ? 'Previewing sync...' : 'Syncing versions...');

		const changes: Array<{
			workspace: string;
			before: string;
			after: string;
			type: string;
		}> = [];

		try {
			for (const [version, workspaces] of versions.entries()) {
				if (version === targetVersion) continue;

				for (const workspace of workspaces) {
					const packageJsonPath = join(workspace.path, 'package.json');
					const packageJson = JSON.parse(
						await readFile(packageJsonPath, 'utf-8')
					);

					let depType = '';
					if (packageJson.dependencies?.[packageName]) {
						depType = 'dependencies';
						if (!dryRun) packageJson.dependencies[packageName] = targetVersion;
					} else if (packageJson.devDependencies?.[packageName]) {
						depType = 'devDependencies';
						if (!dryRun)
							packageJson.devDependencies[packageName] = targetVersion;
					} else if (packageJson.peerDependencies?.[packageName]) {
						depType = 'peerDependencies';
						if (!dryRun)
							packageJson.peerDependencies[packageName] = targetVersion;
					}

					changes.push({
						workspace: workspace.name,
						before: version,
						after: targetVersion,
						type: depType,
					});

					if (!dryRun) {
						await writeFile(
							packageJsonPath,
							JSON.stringify(packageJson, null, 2) + '\n'
						);
					}
				}
			}

			s.stop(dryRun ? '👀 Preview completed' : '✅ Sync completed');

			let changesDisplay = '\n';
			changes.forEach((change) => {
				changesDisplay += `🔄 ${change.workspace}: ${pc.dim(
					String(change.before)
				)} → ${pc.green(String(change.after))} ${pc.gray(
					`(${change.type})`
				)}\n`;
			});

			note(changesDisplay, dryRun ? 'Preview Sync' : 'Applied Sync');

			if (dryRun) {
				const apply = await confirm({
					message: 'Apply these changes?',
					initialValue: false,
				});
				if (apply) {
					await this.executeSyncVersions(
						packageName,
						targetVersion,
						versions,
						false,
						suppressExit
					);
				}
			} else {
				if (!suppressExit) {
					// Ask if user wants to install packages after successful sync
					const shouldInstall = await confirm({
						message:
							'Install packages now? (Recommended after version changes)',
						initialValue: true,
					});
					if (shouldInstall) {
						const allWorkspaces = Array.from(versions.values())
							.flat()
							.map((w) => w.path);
						await this.installPackages(allWorkspaces);
					}
					outro(pc.green('✨ Version sync completed successfully!'));
					process.exit(0);
				}
			}
		} catch (error) {
			s.stop('❌ Sync failed');
			throw error;
		}
	}

	private async installPackages(targetWorkspaces: string[]) {
		const s = spinner();
		s.start('📦 Installing packages...');

		try {
			// Check if we're in a workspace with package manager preference
			const packageManager = await detectPackageManager();

			// Group workspaces by their location for more efficient installation
			const workspaceGroups = await groupWorkspacesByLocation(
				targetWorkspaces,
				this.rootPath
			);

			for (const { path, workspaces } of workspaceGroups) {
				const { spawn } = await import('child_process');

				const installCommand = this.getInstallCommand(packageManager);
				const [command, ...args] = installCommand;

				s.message(`Installing in ${path}...`);

				await new Promise<void>((resolve, reject) => {
					const installProcess = spawn(command, args, {
						cwd: path,
						stdio: ['inherit', 'pipe', 'pipe'],
					});

					let stdout = '';
					let stderr = '';

					installProcess.stdout?.on('data', (data) => {
						stdout += data.toString();
					});

					installProcess.stderr?.on('data', (data) => {
						stderr += data.toString();
					});

					installProcess.on('close', (code) => {
						if (code === 0) {
							resolve();
						} else {
							reject(
								new Error(
									`Installation failed in ${path}: ${stderr || 'Unknown error'}`
								)
							);
						}
					});

					// Timeout after 5 minutes
					setTimeout(() => {
						installProcess.kill();
						reject(new Error('Installation timeout'));
					}, 300000);
				});
			}

			s.stop('✅ Installation completed');
		} catch (error) {
			s.stop('❌ Installation failed');
			// Show manual installation instructions as fallback
			await this.ui.showManualInstallInstructions(targetWorkspaces);
			throw error;
		}
	}

	private getInstallCommand(packageManager: string): string[] {
		if (packageManager.includes('pnpm')) return ['pnpm', 'install'];
		if (packageManager.includes('yarn')) return ['yarn'];
		if (packageManager.includes('bun')) return ['bun', 'install'];
		return ['npm', 'install'];
	}
}

// Run the script
const updater = new PackageUpdater();
updater
	.init()
	.then(() => updater.run())
	.catch(console.error);
