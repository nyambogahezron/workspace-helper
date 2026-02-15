import { cancel, confirm, isCancel, note, select, text } from "@clack/prompts";
import pc from "picocolors";
import type { WorkspaceInfo } from "../types";

export class PackageOperations {
	constructor(private workspaces: WorkspaceInfo[]) {}

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
}
