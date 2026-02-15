import { relative } from "node:path";
import { note } from "@clack/prompts";
import pc from "picocolors";
import type { WorkspaceInfo } from "../types";
import { detectPackageManager, groupWorkspacesByLocation } from "./utils";

export class UIHelpers {
	constructor(private rootPath: string) {}

	getTypeIcon(type: string): string {
		return type === "app" ? "[APP]" : type === "package" ? "" : "[ROOT]";
	}

	hasPackage(workspace: WorkspaceInfo, packageName: string): boolean {
		const allDeps = {
			...workspace.packageJson.dependencies,
			...workspace.packageJson.devDependencies,
			...workspace.packageJson.peerDependencies,
		};
		return !!allDeps[packageName];
	}

	async showManualInstallInstructions(targetWorkspaces: string[]) {
		const packageManager = await detectPackageManager();
		const installCommand = packageManager;

		let instructions = "\n";
		instructions += pc.yellow("Manual Installation Instructions:\n\n");
		instructions += pc.gray(
			"Run the following commands to install packages manually:\n\n",
		);

		const groups = await groupWorkspacesByLocation(
			targetWorkspaces,
			this.rootPath,
		);

		groups.forEach(({ path }) => {
			const relativePath = relative(this.rootPath, path);
			instructions += pc.cyan(`[DIR] ${relativePath || "root"}:\n`);
			instructions += pc.gray(`   cd ${relativePath || "."}\n`);
			instructions += pc.green(`   ${installCommand}\n\n`);
		});

		note(instructions, "Manual Installation");
	}

	displayPackageList(packageMap: Record<string, Map<string, WorkspaceInfo[]>>) {
		let display = "\n";

		Object.entries(packageMap)
			.sort(([a], [b]) => a.localeCompare(b))
			.forEach(([packageName, versionMap]) => {
				display += pc.bold(pc.cyan(` ${packageName}\n`));

				Array.from(versionMap.entries())
					.sort(([a], [b]) => a.localeCompare(b))
					.forEach(([version, workspaces]) => {
						display += `  ${pc.yellow(version)} ${pc.dim(
							`(${workspaces.length} workspace${
								workspaces.length > 1 ? "s" : ""
							})\n`,
						)}`;
						workspaces.forEach((workspace) => {
							display += `    ${pc.gray("├─")} ${workspace.name}\n`;
						});
					});
				display += "\n";
			});

		note(display, "All Packages");
	}

	formatVersionChange(before: string, after: string): string {
		return `${pc.dim(String(before))} → ${pc.green(String(after))}`;
	}

	formatWorkspacePath(workspace: WorkspaceInfo): string {
		const relativePath = relative(this.rootPath, workspace.path);
		return `${this.getTypeIcon(workspace.type)} ${workspace.name} ${pc.dim(
			`(${relativePath})`,
		)}`;
	}
}
