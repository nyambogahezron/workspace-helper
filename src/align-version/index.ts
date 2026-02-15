#!/usr/bin/env bun

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	cancel,
	confirm,
	intro,
	isCancel,
	note,
	outro,
	select,
	spinner,
} from "@clack/prompts";
import pc from "picocolors";
import type { WorkspaceInfo } from "../types";
import printLogo from "../utils/logo";
import { ConflictResolver } from "./conflict-resolver";
import { PackageOperations } from "./package-operations";
import { UIHelpers } from "./ui";
import { detectPackageManager, groupWorkspacesByLocation } from "./utils";
import { WorkspaceManager } from "./workspace-manager";

class AlignVersions {
	private workspaceManager: WorkspaceManager;
	private packageOps: PackageOperations;
	private conflictResolver: ConflictResolver;
	private ui: UIHelpers;

	constructor(private rootPath: string = process.cwd()) {
		this.workspaceManager = new WorkspaceManager(rootPath);
		this.ui = new UIHelpers(rootPath);

		// These will be initialized after workspace scanning
		this.packageOps = null as unknown as PackageOperations;
		this.conflictResolver = null as unknown as ConflictResolver;
	}

	async init() {
		console.clear();
		printLogo();
		intro(pc.bold(pc.cyan(" Package Updater")));

		await this.workspaceManager.scanWorkspaces();
		const workspaces = this.workspaceManager.getWorkspaces();

		// Initialize other modules with workspace data and required dependencies
		this.packageOps = new PackageOperations(workspaces);

		this.conflictResolver = new ConflictResolver(
			workspaces,
			(
				packageName: string,
				targetVersion: string,
				versions: Map<string, WorkspaceInfo[]>,
				dryRun: boolean,
				suppressExit?: boolean,
			) =>
				this.executeSyncVersions(
					packageName,
					targetVersion,
					versions,
					dryRun,
					suppressExit,
				),
			(targetWorkspaces: string[]) => this.installPackages(targetWorkspaces),
		);
	}

	async run() {
		try {
			const action = await select({
				message: "What would you like to do?",
				options: [
					{ value: "sync", label: "Sync package versions" },
					{
						value: "conflicts",
						label: "Find and resolve version conflicts",
					},
					{ value: "list", label: "List all packages" },
				],
			});

			if (isCancel(action)) {
				cancel("Operation cancelled");
				return;
			}

			switch (action) {
				case "sync": {
					const syncResult = await this.packageOps.syncPackageVersions();
					if (syncResult) {
						await this.executeSyncVersions(
							syncResult.packageName,
							syncResult.targetVersion,
							syncResult.versions,
							syncResult.dryRun,
						);
					}
					break;
				}
				case "conflicts":
					await this.conflictResolver.findAndResolveConflicts();
					break;
				case "list":
					await this.listPackages();
					break;
			}
		} catch (error) {
			outro(pc.red(`An error occurred: ${(error as Error).message}`));
			process.exit(1);
		}
	}

	private async listPackages() {
		const packageMap = this.workspaceManager.getAllPackages();
		this.ui.displayPackageList(packageMap);
	}

	private async executeSyncVersions(
		packageName: string,
		targetVersion: string,
		versions: Map<string, WorkspaceInfo[]>,
		dryRun: boolean,
		suppressExit?: boolean,
	) {
		const s = spinner();
		s.start(dryRun ? "Previewing sync..." : "Syncing versions...");

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
					const packageJsonPath = join(workspace.path, "package.json");
					const packageJson = JSON.parse(
						await readFile(packageJsonPath, "utf-8"),
					);

					let depType = "";
					if (packageJson.dependencies?.[packageName]) {
						depType = "dependencies";
						if (!dryRun) packageJson.dependencies[packageName] = targetVersion;
					} else if (packageJson.devDependencies?.[packageName]) {
						depType = "devDependencies";
						if (!dryRun)
							packageJson.devDependencies[packageName] = targetVersion;
					} else if (packageJson.peerDependencies?.[packageName]) {
						depType = "peerDependencies";
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
							`${JSON.stringify(packageJson, null, 2)}\n`,
						);
					}
				}
			}

			s.stop(dryRun ? "[PREVIEW] Preview completed" : "Sync completed");

			let changesDisplay = "\n";
			changes.forEach((change) => {
				changesDisplay += `[SYNC] ${change.workspace}: ${pc.dim(
					String(change.before),
				)} → ${pc.green(String(change.after))} ${pc.gray(
					`(${change.type})`,
				)}\n`;
			});

			note(changesDisplay, dryRun ? "Preview Sync" : "Applied Sync");

			if (dryRun) {
				const apply = await confirm({
					message: "Apply these changes?",
					initialValue: false,
				});
				if (apply) {
					await this.executeSyncVersions(
						packageName,
						targetVersion,
						versions,
						false,
						suppressExit,
					);
				}
			} else {
				if (!suppressExit) {
					// Ask if user wants to install packages after successful sync
					const shouldInstall = await confirm({
						message:
							"Install packages now? (Recommended after version changes)",
						initialValue: true,
					});
					if (shouldInstall) {
						const allWorkspaces = Array.from(versions.values())
							.flat()
							.map((w) => w.path);
						await this.installPackages(allWorkspaces);
					}
					outro(pc.green(" Version sync completed successfully!"));
					process.exit(0);
				}
			}
		} catch (error) {
			s.stop("Sync failed");
			throw error;
		}
	}

	private async installPackages(targetWorkspaces: string[]) {
		const s = spinner();
		s.start(" Installing packages...");

		try {
			// Check if we're in a workspace with package manager preference
			const packageManager = await detectPackageManager();

			// Group workspaces by their location for more efficient installation
			const workspaceGroups = await groupWorkspacesByLocation(
				targetWorkspaces,
				this.rootPath,
			);

			for (const { path } of workspaceGroups) {
				const { spawn } = await import("node:child_process");

				const installCommand = this.getInstallCommand(packageManager);
				const [command, ...args] = installCommand;

				s.message(`Installing in ${path}...`);

				await new Promise<void>((resolve, reject) => {
					const installProcess = spawn(command, args, {
						cwd: path,
						stdio: ["inherit", "pipe", "pipe"],
					});

					let _stdout = "";
					let stderr = "";

					installProcess.stdout?.on("data", (data) => {
						_stdout += data.toString();
					});

					installProcess.stderr?.on("data", (data) => {
						stderr += data.toString();
					});

					installProcess.on("close", (code) => {
						if (code === 0) {
							resolve();
						} else {
							reject(
								new Error(
									`Installation failed in ${path}: ${stderr || "Unknown error"}`,
								),
							);
						}
					});

					// Timeout after 5 minutes
					setTimeout(() => {
						installProcess.kill();
						reject(new Error("Installation timeout"));
					}, 300000);
				});
			}

			s.stop("Installation completed");
		} catch (error) {
			s.stop("Installation failed");
			// Show manual installation instructions as fallback
			await this.ui.showManualInstallInstructions(targetWorkspaces);
			throw error;
		}
	}

	private getInstallCommand(packageManager: string): string[] {
		if (packageManager.includes("pnpm")) return ["pnpm", "install"];
		if (packageManager.includes("yarn")) return ["yarn"];
		if (packageManager.includes("bun")) return ["bun", "install"];
		return ["npm", "install"];
	}
}

export default AlignVersions;
