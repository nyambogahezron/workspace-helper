import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { note, spinner } from "@clack/prompts";
import pc from "picocolors";
import type { WorkspaceInfo } from "./types";

export class WorkspaceManager {
	private workspaces: WorkspaceInfo[] = [];

	constructor(private rootPath: string) {}

	async scanWorkspaces(): Promise<WorkspaceInfo[]> {
		const s = spinner();
		s.start(" Scanning workspace for package.json files...");

		try {
			// Add root workspace
			const rootPackageJsonPath = join(this.rootPath, "package.json");
			if (existsSync(rootPackageJsonPath)) {
				const rootPackageJson = JSON.parse(
					await readFile(rootPackageJsonPath, "utf-8"),
				);
				this.workspaces.push({
					path: this.rootPath,
					name: rootPackageJson.name || "root",
					type: "root",
					packageJson: rootPackageJson,
				});
			}

			// Scan apps
			const appsPath = join(this.rootPath, "apps");
			if (existsSync(appsPath)) {
				const apps = await readdir(appsPath);
				for (const app of apps) {
					const appPath = join(appsPath, app);
					const packageJsonPath = join(appPath, "package.json");
					if (existsSync(packageJsonPath)) {
						const packageJson = JSON.parse(
							await readFile(packageJsonPath, "utf-8"),
						);
						this.workspaces.push({
							path: appPath,
							name: packageJson.name || app,
							type: "app",
							packageJson,
						});
					}
				}
			}

			// Scan packages
			const packagesPath = join(this.rootPath, "packages");
			if (existsSync(packagesPath)) {
				const packages = await readdir(packagesPath);
				for (const pkg of packages) {
					const pkgPath = join(packagesPath, pkg);
					const packageJsonPath = join(pkgPath, "package.json");
					if (existsSync(packageJsonPath)) {
						const packageJson = JSON.parse(
							await readFile(packageJsonPath, "utf-8"),
						);
						this.workspaces.push({
							path: pkgPath,
							name: packageJson.name || pkg,
							type: "package",
							packageJson,
						});
					}
				}
			}

			s.stop(`Found ${this.workspaces.length} workspaces`);
			return this.workspaces;
		} catch (error) {
			s.stop("Failed to scan workspaces");
			throw error;
		}
	}

	displayWorkspaces() {
		const workspacesByType = this.workspaces.reduce(
			(acc, workspace) => {
				if (!acc[workspace.type]) acc[workspace.type] = [];
				acc[workspace.type].push(workspace);
				return acc;
			},
			{} as Record<string, WorkspaceInfo[]>,
		);

		let display = "\n";

		Object.entries(workspacesByType).forEach(([type, workspaces]) => {
			const typeIcon = type === "app" ? "📱" : type === "package" ? "" : "🏠";
			display += pc.bold(pc.cyan(`${typeIcon} ${type.toUpperCase()}S:\n`));

			workspaces.forEach((workspace) => {
				const relativePath = relative(this.rootPath, workspace.path);
				display += `  ${pc.gray("├─")} ${pc.white(workspace.name)} ${pc.dim(
					`(${relativePath})\n`,
				)}`;
			});
			display += "\n";
		});

		note(display, "Available Workspaces");
	}

	getWorkspaces(): WorkspaceInfo[] {
		return this.workspaces;
	}

	setWorkspaces(workspaces: WorkspaceInfo[]): void {
		this.workspaces = workspaces;
	}

	findWorkspaceByName(name: string): WorkspaceInfo | undefined {
		return this.workspaces.find((w) => w.name === name);
	}

	getWorkspacesByType(type: "app" | "package" | "root"): WorkspaceInfo[] {
		return this.workspaces.filter((w) => w.type === type);
	}

	getAllPackages(): Record<string, Map<string, WorkspaceInfo[]>> {
		const packageMap = new Map<string, Map<string, WorkspaceInfo[]>>();

		this.workspaces.forEach((workspace) => {
			const allDeps = {
				...workspace.packageJson.dependencies,
				...workspace.packageJson.devDependencies,
				...workspace.packageJson.peerDependencies,
			};

			Object.entries(allDeps).forEach(([packageName, version]) => {
				if (!packageMap.has(packageName)) {
					packageMap.set(packageName, new Map());
				}

				const versionMap = packageMap.get(packageName);
				if (!versionMap) {
					// Should not happen as we just set it if missing
					return;
				}
				if (!versionMap.has(version)) {
					versionMap.set(version, []);
				}
				versionMap.get(version)?.push(workspace);
			});
		});

		return Object.fromEntries(packageMap);
	}
}
