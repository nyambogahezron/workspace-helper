import pc from 'picocolors';
import {
	select,
	multiselect,
	text,
	confirm,
	spinner,
	note,
	outro,
} from '@clack/prompts';
import { WorkspaceInfo } from './types';
import { fetchLatestVersionSimple, isVersionNewer } from './utils';

export class ConflictResolver {
	constructor(
		private workspaces: WorkspaceInfo[],
		private executeSyncVersions: (
			packageName: string,
			targetVersion: string,
			versions: Map<string, WorkspaceInfo[]>,
			dryRun: boolean,
			suppressExit?: boolean
		) => Promise<void>,
		private installPackages: (targetWorkspaces: string[]) => Promise<void>
	) {}

	async findAndResolveConflicts() {
		const s = spinner();
		s.start('🔍 Analyzing package versions across workspaces...');

		// Build a comprehensive package version map
		const packageVersionMap = new Map<string, Map<string, WorkspaceInfo[]>>();

		this.workspaces.forEach((workspace) => {
			const allDeps = {
				...workspace.packageJson.dependencies,
				...workspace.packageJson.devDependencies,
				...workspace.packageJson.peerDependencies,
			};

			Object.entries(allDeps).forEach(([packageName, version]) => {
				if (!packageVersionMap.has(packageName)) {
					packageVersionMap.set(packageName, new Map());
				}
				const versionMap = packageVersionMap.get(packageName)!;
				if (!versionMap.has(version)) {
					versionMap.set(version, []);
				}
				versionMap.get(version)!.push(workspace);
			});
		});

		// Find packages with multiple versions (conflicts)
		const conflicts = Array.from(packageVersionMap.entries())
			.filter(([, versionMap]) => versionMap.size > 1)
			.sort(([a], [b]) => a.localeCompare(b));

		s.stop('✅ Analysis completed');

		if (conflicts.length === 0) {
			note(
				'🎉 No version conflicts found! All packages have consistent versions across workspaces.',
				'All Clear'
			);
			process.exit(0);
		}

		// Display conflicts summary
		this.displayConflictsSummary(conflicts);

		const resolutionChoice = await select({
			message: 'How would you like to resolve conflicts?',
			options: [
				{ value: 'all', label: '🔄 Resolve all conflicts interactively' },
				{ value: 'specific', label: '🎯 Choose specific packages to resolve' },
				{ value: 'auto', label: '⚡ Auto-resolve to most common versions' },
				{ value: 'latest', label: '🚀 Auto-resolve all to latest versions' },
			],
		});

		if (resolutionChoice === 'all') {
			await this.resolveAllConflicts(conflicts);
		} else if (resolutionChoice === 'specific') {
			await this.resolveSpecificConflicts(conflicts);
		} else if (resolutionChoice === 'auto') {
			await this.autoResolveToMostCommon(conflicts);
		} else if (resolutionChoice === 'latest') {
			await this.autoResolveToLatest(conflicts);
		}
	}

	private displayConflictsSummary(
		conflicts: Array<[string, Map<string, WorkspaceInfo[]>]>
	) {
		let conflictsSummary = '\n';
		conflictsSummary += pc.red(
			`Found ${conflicts.length} package${
				conflicts.length > 1 ? 's' : ''
			} with version conflicts:\n\n`
		);

		conflicts.forEach(([packageName, versionMap]) => {
			conflictsSummary += pc.bold(pc.yellow(`📦 ${packageName}\n`));
			Array.from(versionMap.entries()).forEach(([version, workspaces]) => {
				conflictsSummary += `  ${pc.cyan(version)} ${pc.dim(
					`(${workspaces.length} workspace${
						workspaces.length > 1 ? 's' : ''
					})\n`
				)}`;
				workspaces.forEach((workspace) => {
					conflictsSummary += `    ${pc.gray('├─')} ${workspace.name}\n`;
				});
			});
			conflictsSummary += '\n';
		});

		note(conflictsSummary, 'Version Conflicts Detected');
	}

	private async resolveAllConflicts(
		conflicts: Array<[string, Map<string, WorkspaceInfo[]>]>
	) {
		// Prompt for bulk resolution strategy
		const bulkStrategy = await select({
			message: 'How would you like to resolve all conflicts?',
			options: [
				{
					value: 'inuse',
					label: '🎯 Choose a version in use for each package (bulk)',
				},
				{ value: 'latest', label: '🚀 Use latest version from npm for all' },
				{
					value: 'interactive',
					label: '🛠️ Resolve each conflict interactively (default)',
				},
			],
		});

		let affectedWorkspaces: string[] = [];

		if (bulkStrategy === 'inuse') {
			affectedWorkspaces = await this.resolveBulkInUse(conflicts);
		} else if (bulkStrategy === 'latest') {
			affectedWorkspaces = await this.resolveBulkLatest(conflicts);
		} else {
			affectedWorkspaces = await this.resolveInteractively(conflicts);
		}

		// Prompt for install ONCE for all affected workspaces
		if (affectedWorkspaces.length > 0) {
			const shouldInstall = await confirm({
				message:
					'Install packages now? (Recommended after resolving conflicts)',
				initialValue: true,
			});
			if (shouldInstall) {
				await this.installPackages(affectedWorkspaces);
			}
		}
		process.exit(0);
	}

	private async resolveBulkInUse(
		conflicts: Array<[string, Map<string, WorkspaceInfo[]>]>
	): Promise<string[]> {
		let affectedWorkspaces: string[] = [];

		for (const [packageName, versionMap] of conflicts) {
			// Build options: all in-use versions, plus latest and skip
			let versionOptions = Array.from(versionMap.keys()).map((version) => ({
				value: version,
				label: `${version} ${pc.dim(
					`(used in ${versionMap.get(version)!.length} workspace${
						versionMap.get(version)!.length > 1 ? 's' : ''
					})`
				)}`,
			}));
			versionOptions.push({
				value: 'latest',
				label: `${pc.green('Use latest from npm')}`,
			});
			versionOptions.push({
				value: 'skip',
				label: `${pc.gray('Skip (do nothing)')}`,
			});

			const chosenVersion = await select({
				message: `Select version to use for ${packageName}:`,
				options: versionOptions,
			});

			if (chosenVersion === 'skip') {
				note(`Skipped resolution for ${packageName}`, 'Skipped');
				continue;
			}

			let finalVersion = chosenVersion as string;
			if (chosenVersion === 'latest') {
				const latestVersion = await fetchLatestVersionSimple(packageName);
				finalVersion = latestVersion || 'latest';
			}

			await this.executeSyncVersions(
				packageName,
				finalVersion,
				versionMap,
				false,
				true
			);
			affectedWorkspaces.push(
				...Array.from(versionMap.values())
					.flat()
					.map((w) => w.path)
			);
		}

		outro(pc.green('✨ All conflicts resolved to chosen in-use versions!'));
		return [...new Set(affectedWorkspaces)];
	}

	private async resolveBulkLatest(
		conflicts: Array<[string, Map<string, WorkspaceInfo[]>]>
	): Promise<string[]> {
		let affectedWorkspaces: string[] = [];

		for (const [packageName, versionMap] of conflicts) {
			const latestVersion = await fetchLatestVersionSimple(packageName);
			const finalVersion = latestVersion || 'latest';

			await this.executeSyncVersions(
				packageName,
				finalVersion,
				versionMap,
				false,
				true
			);
			affectedWorkspaces.push(
				...Array.from(versionMap.values())
					.flat()
					.map((w) => w.path)
			);
		}

		outro(pc.green('✨ All conflicts resolved to latest versions!'));
		return [...new Set(affectedWorkspaces)];
	}

	private async resolveInteractively(
		conflicts: Array<[string, Map<string, WorkspaceInfo[]>]>
	): Promise<string[]> {
		let affectedWorkspaces: string[] = [];

		for (const [packageName, versionMap] of conflicts) {
			const workspacesPaths = await this.resolvePackageConflict(
				packageName,
				versionMap
			);
			affectedWorkspaces.push(...workspacesPaths);
		}

		outro(pc.green('✨ All conflicts resolved successfully!'));
		return [...new Set(affectedWorkspaces)];
	}

	private async resolveSpecificConflicts(
		conflicts: Array<[string, Map<string, WorkspaceInfo[]>]>
	) {
		const selectedPackages = await multiselect({
			message: 'Select packages to resolve:',
			options: conflicts.map(([packageName, versionMap]) => ({
				value: packageName,
				label: `📦 ${packageName} ${pc.dim(`(${versionMap.size} versions)`)}`,
			})),
		});

		const selectedConflicts = conflicts.filter(([packageName]) =>
			(selectedPackages as string[]).includes(packageName)
		);

		for (const [packageName, versionMap] of selectedConflicts) {
			await this.resolvePackageConflict(packageName, versionMap);
		}

		outro(pc.green('✨ Selected conflicts resolved successfully!'));
		process.exit(0);
	}

	private async resolvePackageConflict(
		packageName: string,
		versionMap: Map<string, WorkspaceInfo[]>
	): Promise<string[]> {
		// Display current versions for this package
		let versionDisplay = '\n';
		versionDisplay += pc.bold(pc.cyan(`📦 Resolving: ${packageName}\n\n`));

		Array.from(versionMap.entries()).forEach(([version, workspaces]) => {
			versionDisplay += pc.yellow(`Version ${version}:\n`);
			workspaces.forEach((workspace) => {
				versionDisplay += `  ${pc.gray('├─')} ${workspace.name}\n`;
			});
			versionDisplay += '\n';
		});

		note(versionDisplay, `Conflict Resolution for ${packageName}`);

		// Fetch latest version from npm
		const latestVersion = await fetchLatestVersionSimple(packageName);
		const currentVersions = Array.from(versionMap.keys());
		const isNewer = latestVersion
			? isVersionNewer(latestVersion, currentVersions)
			: false;

		// Display npm latest version info if available
		if (latestVersion) {
			const latestInfo = `\n📋 Latest version on npm: ${pc.green(
				latestVersion
			)}${
				isNewer
					? pc.yellow(' 🆕 (newer than current versions)')
					: pc.gray(' (already in use)')
			}\n`;
			note(latestInfo, 'NPM Registry Info');
		}

		const resolutionOptions = [
			...Array.from(versionMap.keys()).map((version) => ({
				value: version,
				label: `${version} ${pc.dim(
					`(used in ${versionMap.get(version)!.length} workspace${
						versionMap.get(version)!.length > 1 ? 's' : ''
					})`
				)}`,
			})),
			...(latestVersion
				? [
						{
							value: latestVersion,
							label: `${latestVersion} ${pc.green('(latest from npm)')} ${
								isNewer ? pc.yellow('🆕') : ''
							}`,
						},
				  ]
				: []),
			{ value: 'custom', label: '✨ Enter custom version' },
			{ value: 'skip', label: '⏭️  Skip this package' },
		];

		const targetVersion = await select({
			message: `Select target version for ${packageName}:`,
			options: resolutionOptions,
		});

		if (targetVersion === 'skip') {
			note(`Skipped resolution for ${packageName}`, 'Skipped');
			return [];
		}

		let finalVersion = targetVersion as string;
		if (targetVersion === 'custom') {
			const customVersion = await text({
				message: `Enter custom version for ${packageName}:`,
				placeholder: 'e.g., ^5.6.0, latest, ~4.0.0',
				validate: (value) =>
					value.length === 0 ? 'Version is required' : undefined,
			});
			finalVersion = customVersion as string;
		}

		await this.executeSyncVersions(
			packageName,
			finalVersion,
			versionMap,
			false,
			true
		);

		return Array.from(versionMap.values())
			.flat()
			.map((w) => w.path);
	}

	private async autoResolveToMostCommon(
		conflicts: Array<[string, Map<string, WorkspaceInfo[]>]>
	) {
		let affectedWorkspaces: string[] = [];

		for (const [packageName, versionMap] of conflicts) {
			// Find the version used by the most workspaces
			let mostCommonVersion = '';
			let maxCount = 0;

			for (const [version, workspaces] of versionMap.entries()) {
				if (workspaces.length > maxCount) {
					maxCount = workspaces.length;
					mostCommonVersion = version;
				}
			}

			await this.executeSyncVersions(
				packageName,
				mostCommonVersion,
				versionMap,
				false,
				true
			);

			affectedWorkspaces.push(
				...Array.from(versionMap.values())
					.flat()
					.map((w) => w.path)
			);
		}

		outro(pc.green('✨ All conflicts resolved to most common versions!'));
		return [...new Set(affectedWorkspaces)];
	}

	private async autoResolveToLatest(
		conflicts: Array<[string, Map<string, WorkspaceInfo[]>]>
	) {
		let affectedWorkspaces: string[] = [];

		for (const [packageName, versionMap] of conflicts) {
			const latestVersion = await fetchLatestVersionSimple(packageName);
			const finalVersion = latestVersion || 'latest';

			await this.executeSyncVersions(
				packageName,
				finalVersion,
				versionMap,
				false,
				true
			);

			affectedWorkspaces.push(
				...Array.from(versionMap.values())
					.flat()
					.map((w) => w.path)
			);
		}

		outro(pc.green('✨ All conflicts resolved to latest versions!'));
		return [...new Set(affectedWorkspaces)];
	}
}
