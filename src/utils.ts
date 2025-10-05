import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { WorkspaceInfo } from './types';

export async function fetchLatestVersionSimple(
	packageName: string
): Promise<string | null> {
	try {
		// Use npm view command to get latest version
		const { spawn } = await import('child_process');

		const result = await new Promise<string>((resolve, reject) => {
			const npmProcess = spawn('npm', ['view', packageName, 'version'], {
				stdio: ['pipe', 'pipe', 'pipe'],
			});

			let stdout = '';
			let stderr = '';

			npmProcess.stdout?.on('data', (data) => {
				stdout += data.toString();
			});

			npmProcess.stderr?.on('data', (data) => {
				stderr += data.toString();
			});

			npmProcess.on('close', (code) => {
				if (code === 0) {
					resolve(stdout.trim());
				} else {
					reject(new Error(stderr || 'Failed to fetch package info'));
				}
			});

			// Timeout after 10 seconds
			setTimeout(() => {
				npmProcess.kill();
				reject(new Error('Timeout: npm request took too long'));
			}, 10000);
		});

		return result.trim();
	} catch (error) {
		// Silently fail and continue without latest version info
		return null;
	}
}

export function isVersionNewer(
	latestVersion: string,
	currentVersions: string[]
): boolean {
	// Simple check - if the latest version is not in current versions, consider it newer
	// This is a basic implementation. For more accurate comparison, you'd need semver
	const cleanLatest = latestVersion.replace(/[\^~]/g, '');
	const cleanCurrents = currentVersions.map((v) => v.replace(/[\^~]/g, ''));

	return !cleanCurrents.includes(cleanLatest);
}

export async function groupWorkspacesByLocation(
	targetWorkspaces: string[],
	rootPath: string
): Promise<Array<{ path: string; workspaces: string[] }>> {
	// For monorepos, we usually want to install from the root
	// But we'll also support individual workspace installation
	const groups = new Map<string, string[]>();

	// Check if this is a monorepo (has workspaces in package.json)
	const rootPackageJsonPath = join(rootPath, 'package.json');
	if (existsSync(rootPackageJsonPath)) {
		try {
			const rootPackageJson = JSON.parse(
				readFileSync(rootPackageJsonPath, 'utf-8')
			);
			if (rootPackageJson.workspaces) {
				// It's a monorepo, install from root
				groups.set(rootPath, targetWorkspaces);
				return Array.from(groups.entries()).map(([path, workspaces]) => ({
					path,
					workspaces,
				}));
			}
		} catch (error) {
			// Continue with individual installations
		}
	}

	// Not a monorepo, group by workspace directories
	targetWorkspaces.forEach((workspace) => {
		const workspaceDir = workspace;
		if (!groups.has(workspaceDir)) {
			groups.set(workspaceDir, []);
		}
		groups.get(workspaceDir)!.push(workspace);
	});

	return Array.from(groups.entries()).map(([path, workspaces]) => ({
		path,
		workspaces,
	}));
}

export async function detectPackageManager(): Promise<string> {
	// Check for lock files to determine package manager
	if (existsSync('pnpm-lock.yaml')) return 'pnpm install';
	if (existsSync('yarn.lock')) return 'yarn install';
	if (existsSync('bun.lockb')) return 'bun install';
	return 'npm install';
}
