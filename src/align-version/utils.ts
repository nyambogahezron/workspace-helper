import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export async function fetchLatestVersionSimple(
	packageName: string,
): Promise<string | null> {
	try {
		const { spawn } = await import("node:child_process");

		const result = await new Promise<string>((resolve, reject) => {
			const npmProcess = spawn("npm", ["view", packageName, "version"], {
				stdio: ["pipe", "pipe", "pipe"],
			});

			let stdout = "";
			let stderr = "";

			npmProcess.stdout?.on("data", (data) => {
				stdout += data.toString();
			});

			npmProcess.stderr?.on("data", (data) => {
				stderr += data.toString();
			});

			npmProcess.on("close", (code) => {
				if (code === 0) {
					resolve(stdout.trim());
				} else {
					reject(new Error(stderr || "Failed to fetch package info"));
				}
			});

			setTimeout(() => {
				npmProcess.kill();
				reject(new Error("Timeout: npm request took too long"));
			}, 10000);
		});

		return result.trim();
	} catch (_error) {
		return null;
	}
}

export function isVersionNewer(
	latestVersion: string,
	currentVersions: string[],
): boolean {
	const cleanLatest = latestVersion.replace(/[\^~]/g, "");
	const cleanCurrents = currentVersions.map((v) => v.replace(/[\^~]/g, ""));

	return !cleanCurrents.includes(cleanLatest);
}

export async function groupWorkspacesByLocation(
	targetWorkspaces: string[],
	rootPath: string,
): Promise<Array<{ path: string; workspaces: string[] }>> {
	const groups = new Map<string, string[]>();

	const rootPackageJsonPath = join(rootPath, "package.json");
	if (existsSync(rootPackageJsonPath)) {
		try {
			const rootPackageJson = JSON.parse(
				readFileSync(rootPackageJsonPath, "utf-8"),
			);
			if (rootPackageJson.workspaces) {
				groups.set(rootPath, targetWorkspaces);
				return Array.from(groups.entries()).map(([path, workspaces]) => ({
					path,
					workspaces,
				}));
			}
		} catch (_error) {}
	}

	targetWorkspaces.forEach((workspace) => {
		const workspaceDir = workspace;
		if (!groups.has(workspaceDir)) {
			groups.set(workspaceDir, []);
		}
		groups.get(workspaceDir)?.push(workspace);
	});

	return Array.from(groups.entries()).map(([path, workspaces]) => ({
		path,
		workspaces,
	}));
}

export async function detectPackageManager(): Promise<string> {
	if (existsSync("pnpm-lock.yaml")) return "pnpm install";
	if (existsSync("yarn.lock")) return "yarn install";
	if (existsSync("bun.lockb")) return "bun install";
	return "npm install";
}
