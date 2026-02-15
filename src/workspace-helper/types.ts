export interface PackageJson {
	name?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
}

export interface WorkspaceInfo {
	path: string;
	name: string;
	type: "app" | "package" | "root";
	packageJson: PackageJson;
}

export interface UpdateConfig {
	packageName: string;
	version: string;
	dependencyType: "dependencies" | "devDependencies" | "peerDependencies";
	targetWorkspaces: string[];
	dryRun: boolean;
}

export interface ChangeRecord {
	workspace: string;
	before?: string;
	after: string;
	type: string;
	action?: "add" | "update";
	version?: string;
}

export interface WorkspaceGroup {
	path: string;
	workspaces: WorkspaceInfo[];
}

export type DependencyType =
	| "dependencies"
	| "devDependencies"
	| "peerDependencies";

export type ConflictResolutionOption =
	| "interactive"
	| "bulk-choose"
	| "bulk-latest"
	| "bulk-skip";

export interface ConflictChoice {
	packageName: string;
	selectedVersion: string;
	versionMap: Map<string, WorkspaceInfo[]>;
}
