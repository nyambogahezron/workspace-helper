import { readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
	cancel,
	confirm,
	isCancel,
	multiselect,
	note,
	outro,
	select,
	spinner,
	text,
} from "@clack/prompts";
import pc from "picocolors";
import type { UpdateConfig, WorkspaceInfo } from "./types";
import { fetchLatestVersionSimple } from "./utils";

export class PackageOperations {
	constructor(
		private workspaces: WorkspaceInfo[],
		private rootPath: string,
		private displayWorkspaces: () => void,
		private getTypeIcon: (type: string) => string,
		private hasPackage: (
			workspace: WorkspaceInfo,
			packageName: string,
		) => boolean,
		private installPackages: (targetWorkspaces: string[]) => Promise<void>,
	) {}

	async addOrUpdatePackage() {
		this.displayWorkspaces();

		const packageName = await text({
			message: "Enter package name:",
			placeholder: "e.g., typescript, react, lodash",
			validate: (value) =>
				value.length === 0 ? "Package name is required" : undefined,
		});

		if (isCancel(packageName)) {
			cancel("Operation cancelled");
			return;
		}

		// Fetch and display latest version info
		const latestVersionInfo = await fetchLatestVersionSimple(
			packageName as string,
		);
		if (latestVersionInfo) {
			const latestInfo = `\nLatest version on npm: ${pc.green(
				latestVersionInfo,
			)}\n`;
			note(latestInfo, "NPM Registry Info");
		}

		const version = await text({
			message: "Enter package version:",
			placeholder: "e.g., ^5.6.0, latest, ~4.0.0",
			defaultValue: latestVersionInfo || "latest",
		});

		if (isCancel(version)) {
			cancel("Operation cancelled");
			return;
		}

		const dependencyType = await select({
			message: "Select dependency type:",
			options: [
				{ value: "devDependencies", label: "🔧 devDependencies" },
				{ value: "dependencies", label: " dependencies" },
				{ value: "peerDependencies", label: "🤝 peerDependencies" },
			],
		});

		const scopeChoice = await select({
			message: "Select update scope:",
			options: [
				{ value: "all", label: "🌍 All workspaces" },
				{ value: "byType", label: " By workspace type (apps/packages)" },
				{ value: "custom", label: " Custom selection" },
			],
		});

		let targetWorkspaces: string[] = [];

		if (scopeChoice === "all") {
			targetWorkspaces = this.workspaces.map((w) => w.path);
		} else if (scopeChoice === "byType") {
			const typeChoice = await multiselect({
				message: "Select workspace types:",
				options: [
					{ value: "root", label: "🏠 Root workspace" },
					{ value: "app", label: "📱 Apps" },
					{ value: "package", label: " Packages" },
				],
			});

			targetWorkspaces = this.workspaces
				.filter((w) => Array.isArray(typeChoice) && typeChoice.includes(w.type))
				.map((w) => w.path);
		} else {
			const selectedWorkspaces = await multiselect({
				message: "Select specific workspaces:",
				options: this.workspaces.map((w) => ({
					value: w.path,
					label: `${this.getTypeIcon(w.type)} ${w.name} ${pc.dim(
						`(${relative(this.rootPath, w.path)})`,
					)}`,
				})),
			});

			targetWorkspaces = selectedWorkspaces as string[];
		}

		const dryRun = await confirm({
			message: "Run in dry-run mode? (Preview changes without applying)",
			initialValue: true,
		});

		const config: UpdateConfig = {
			packageName: packageName as string,
			version: version as string,
			dependencyType: dependencyType as UpdateConfig["dependencyType"],
			targetWorkspaces,
			dryRun: dryRun as boolean,
		};

		await this.executeUpdate(config);
	}

	async removePackage() {
		this.displayWorkspaces();

		// First, find all packages across workspaces
		const allPackages = new Set<string>();
		this.workspaces.forEach((workspace) => {
			Object.keys(workspace.packageJson.dependencies || {}).forEach((pkg) => {
				allPackages.add(pkg);
			});
			Object.keys(workspace.packageJson.devDependencies || {}).forEach((pkg) => {
				allPackages.add(pkg);
			});
			Object.keys(workspace.packageJson.peerDependencies || {}).forEach((pkg) => {
				allPackages.add(pkg);
			});
		});

		const packageToRemove = await select({
			message: "Select package to remove:",
			options: Array.from(allPackages)
				.sort()
				.map((pkg) => ({
					value: pkg,
					label: pkg,
				})),
		});

		const targetWorkspaces = await multiselect({
			message: "Select workspaces to remove from:",
			options: this.workspaces
				.filter((w) => this.hasPackage(w, packageToRemove as string))
				.map((w) => ({
					value: w.path,
					label: `${this.getTypeIcon(w.type)} ${w.name} ${pc.dim(
						`(${relative(this.rootPath, w.path)})`,
					)}`,
				})),
		});

		const dryRun = await confirm({
			message: "Run in dry-run mode?",
			initialValue: true,
		});

		await this.executeRemoval(
			packageToRemove as string,
			targetWorkspaces as string[],
			dryRun as boolean,
		);
	}

	async syncPackageVersions() {
		const packageName = await text({
			message: "Enter package name to sync:",
			placeholder: "e.g., typescript, react",
		});

		if (isCancel(packageName)) {
			cancel("Operation cancelled");
			return;
		}

		// Find all versions of this package
		const versions = new Map<string, WorkspaceInfo[]>();
		this.workspaces.forEach((workspace) => {
			const deps = {
				...workspace.packageJson.dependencies,
				...workspace.packageJson.devDependencies,
			};
			if (deps[packageName as string]) {
				const version = deps[packageName as string];
				if (!versions.has(version)) {
					versions.set(version, []);
				}
				versions.get(version)?.push(workspace);
			}
		});

		if (versions.size === 0) {
			note(
				`Package "${String(packageName)}" not found in any workspace`,
				"No Package Found",
			);
			return;
		}

		if (versions.size === 1) {
			note(
				`Package "${String(packageName)}" already has consistent version: ${
					Array.from(versions.keys())[0]
				}`,
				"Already Synced",
			);
			return;
		}

		// Display current versions
		let versionDisplay = "\n";
		versions.forEach((workspaces, version) => {
			versionDisplay += pc.yellow(`Version ${version}:\n`);
			workspaces.forEach((w) => {
				versionDisplay += `  ${pc.gray("├─")} ${w.name}\n`;
			});
			versionDisplay += "\n";
		});

		note(versionDisplay, `Current versions of "${String(packageName)}"`);

		const targetVersion = await select({
			message: "Select version to sync to:",
			options: Array.from(versions.keys()).map((version) => ({
				value: version,
				label: `${version} (used in ${versions.get(version)?.length ?? 0} workspace${
					(versions.get(version)?.length ?? 0) > 1 ? "s" : ""
				})`,
			})),
		});

		if (isCancel(targetVersion)) {
			cancel("Operation cancelled");
			return;
		}

		const dryRun = await confirm({
			message: "Run in dry-run mode?",
			initialValue: true,
		});

		if (isCancel(dryRun)) {
			cancel("Operation cancelled");
			return;
		}

		return {
			packageName: packageName as string,
			targetVersion: targetVersion as string,
			versions,
			dryRun: dryRun as boolean,
		};
	}

	async executeUpdate(config: UpdateConfig) {
		const s = spinner();
		s.start(config.dryRun ? "Previewing changes..." : "Updating packages...");

		const changes: Array<{
			workspace: string;
			action: string;
			before?: string;
			after: string;
		}> = [];

		try {
			for (const workspacePath of config.targetWorkspaces) {
				const workspace = this.workspaces.find((w) => w.path === workspacePath);
				if (!workspace) continue;

				const packageJsonPath = join(workspacePath, "package.json");
				const packageJson = JSON.parse(
					await readFile(packageJsonPath, "utf-8"),
				);

				const currentVersion =
					packageJson[config.dependencyType]?.[config.packageName];

				if (!packageJson[config.dependencyType]) {
					packageJson[config.dependencyType] = {};
				}

				packageJson[config.dependencyType][config.packageName] = config.version;

				changes.push({
					workspace: workspace.name,
					action: currentVersion ? "update" : "add",
					before: currentVersion,
					after: config.version,
				});

				if (!config.dryRun) {
					await writeFile(
						packageJsonPath,
						`${JSON.stringify(packageJson, null, 2)}\n`,
					);
				}
			}

			s.stop(config.dryRun ? "👀 Preview completed" : "Update completed");

			// Display changes
			let changesDisplay = "\n";
			changes.forEach((change) => {
				const icon = change.action === "add" ? "➕" : "📝";
				const action =
					change.action === "add"
						? "Added"
						: `Updated ${pc.dim(String(change.before ?? ""))} → `;
				changesDisplay += `${icon} ${change.workspace}: ${action}${pc.green(
					change.after,
				)}\n`;
			});

			note(
				changesDisplay,
				config.dryRun ? "Preview Changes" : "Applied Changes",
			);

			if (config.dryRun) {
				const apply = await confirm({
					message: "Apply these changes?",
					initialValue: false,
				});

				if (apply) {
					await this.executeUpdate({ ...config, dryRun: false });
				}
			} else {
				// Ask if user wants to install packages after successful update
				const shouldInstall = await confirm({
					message: "Install packages now? (Recommended after package changes)",
					initialValue: true,
				});

				if (shouldInstall) {
					await this.installPackages(config.targetWorkspaces);
				}

				outro(pc.green(" Package update completed successfully!"));
				process.exit(0);
			}
		} catch (error) {
			s.stop("Update failed");
			throw error;
		}
	}

	async executeRemoval(
		packageName: string,
		targetWorkspaces: string[],
		dryRun: boolean,
	) {
		const s = spinner();
		s.start(dryRun ? "Previewing removals..." : "Removing packages...");

		const changes: Array<{
			workspace: string;
			type: string;
			version: string;
		}> = [];

		try {
			for (const workspacePath of targetWorkspaces) {
				const workspace = this.workspaces.find((w) => w.path === workspacePath);
				if (!workspace) continue;

				const packageJsonPath = join(workspacePath, "package.json");
				const packageJson = JSON.parse(
					await readFile(packageJsonPath, "utf-8"),
				);

				// Remove from all dependency types
				let removedFrom = "";
				let version = "";

				if (packageJson.dependencies?.[packageName]) {
					version = packageJson.dependencies[packageName];
					if (!dryRun) delete packageJson.dependencies[packageName];
					removedFrom = "dependencies";
				} else if (packageJson.devDependencies?.[packageName]) {
					version = packageJson.devDependencies[packageName];
					if (!dryRun) delete packageJson.devDependencies[packageName];
					removedFrom = "devDependencies";
				} else if (packageJson.peerDependencies?.[packageName]) {
					version = packageJson.peerDependencies[packageName];
					if (!dryRun) delete packageJson.peerDependencies[packageName];
					removedFrom = "peerDependencies";
				}

				if (removedFrom) {
					changes.push({
						workspace: workspace.name,
						type: removedFrom,
						version,
					});

					if (!dryRun) {
						await writeFile(
							packageJsonPath,
							`${JSON.stringify(packageJson, null, 2)}\n`,
						);
					}
				}
			}

			s.stop(dryRun ? "👀 Preview completed" : "Removal completed");

			// Display changes
			let changesDisplay = "\n";
			changes.forEach((change) => {
				changesDisplay += `🗑️  ${change.workspace}: Removed from ${
					change.type
				} ${pc.dim(`(${change.version})`)}\n`;
			});

			note(changesDisplay, dryRun ? "Preview Removals" : "Applied Removals");

			if (dryRun) {
				const apply = await confirm({
					message: "Apply these changes?",
					initialValue: false,
				});

				if (apply) {
					await this.executeRemoval(packageName, targetWorkspaces, false);
				}
			} else {
				// Ask if user wants to install packages after successful removal
				const shouldInstall = await confirm({
					message: "Install packages now? (Recommended after package changes)",
					initialValue: true,
				});

				if (shouldInstall) {
					await this.installPackages(targetWorkspaces);
				}

				outro(pc.green(" Package removal completed successfully!"));
				process.exit(0);
			}
		} catch (error) {
			s.stop("Removal failed");
			throw error;
		}
	}
}
