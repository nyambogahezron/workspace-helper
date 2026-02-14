"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceManager = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const fs_1 = require("fs");
const picocolors_1 = __importDefault(require("picocolors"));
const prompts_1 = require("@clack/prompts");
class WorkspaceManager {
    constructor(rootPath) {
        this.rootPath = rootPath;
        this.workspaces = [];
    }
    async scanWorkspaces() {
        const s = (0, prompts_1.spinner)();
        s.start('🔍 Scanning workspace for package.json files...');
        try {
            // Add root workspace
            const rootPackageJsonPath = (0, path_1.join)(this.rootPath, 'package.json');
            if ((0, fs_1.existsSync)(rootPackageJsonPath)) {
                const rootPackageJson = JSON.parse(await (0, promises_1.readFile)(rootPackageJsonPath, 'utf-8'));
                this.workspaces.push({
                    path: this.rootPath,
                    name: rootPackageJson.name || 'root',
                    type: 'root',
                    packageJson: rootPackageJson,
                });
            }
            // Scan apps
            const appsPath = (0, path_1.join)(this.rootPath, 'apps');
            if ((0, fs_1.existsSync)(appsPath)) {
                const apps = await (0, promises_1.readdir)(appsPath);
                for (const app of apps) {
                    const appPath = (0, path_1.join)(appsPath, app);
                    const packageJsonPath = (0, path_1.join)(appPath, 'package.json');
                    if ((0, fs_1.existsSync)(packageJsonPath)) {
                        const packageJson = JSON.parse(await (0, promises_1.readFile)(packageJsonPath, 'utf-8'));
                        this.workspaces.push({
                            path: appPath,
                            name: packageJson.name || app,
                            type: 'app',
                            packageJson,
                        });
                    }
                }
            }
            // Scan packages
            const packagesPath = (0, path_1.join)(this.rootPath, 'packages');
            if ((0, fs_1.existsSync)(packagesPath)) {
                const packages = await (0, promises_1.readdir)(packagesPath);
                for (const pkg of packages) {
                    const pkgPath = (0, path_1.join)(packagesPath, pkg);
                    const packageJsonPath = (0, path_1.join)(pkgPath, 'package.json');
                    if ((0, fs_1.existsSync)(packageJsonPath)) {
                        const packageJson = JSON.parse(await (0, promises_1.readFile)(packageJsonPath, 'utf-8'));
                        this.workspaces.push({
                            path: pkgPath,
                            name: packageJson.name || pkg,
                            type: 'package',
                            packageJson,
                        });
                    }
                }
            }
            s.stop(`✅ Found ${this.workspaces.length} workspaces`);
            return this.workspaces;
        }
        catch (error) {
            s.stop('❌ Failed to scan workspaces');
            throw error;
        }
    }
    displayWorkspaces() {
        const workspacesByType = this.workspaces.reduce((acc, workspace) => {
            if (!acc[workspace.type])
                acc[workspace.type] = [];
            acc[workspace.type].push(workspace);
            return acc;
        }, {});
        let display = '\n';
        Object.entries(workspacesByType).forEach(([type, workspaces]) => {
            const typeIcon = type === 'app' ? '📱' : type === 'package' ? '📦' : '🏠';
            display += picocolors_1.default.bold(picocolors_1.default.cyan(`${typeIcon} ${type.toUpperCase()}S:\n`));
            workspaces.forEach((workspace) => {
                const relativePath = (0, path_1.relative)(this.rootPath, workspace.path);
                display += `  ${picocolors_1.default.gray('├─')} ${picocolors_1.default.white(workspace.name)} ${picocolors_1.default.dim(`(${relativePath})\n`)}`;
            });
            display += '\n';
        });
        (0, prompts_1.note)(display, 'Available Workspaces');
    }
    getWorkspaces() {
        return this.workspaces;
    }
    setWorkspaces(workspaces) {
        this.workspaces = workspaces;
    }
    findWorkspaceByName(name) {
        return this.workspaces.find((w) => w.name === name);
    }
    getWorkspacesByType(type) {
        return this.workspaces.filter((w) => w.type === type);
    }
    getAllPackages() {
        const packageMap = new Map();
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
                if (!versionMap.has(version)) {
                    versionMap.set(version, []);
                }
                versionMap.get(version).push(workspace);
            });
        });
        return Object.fromEntries(packageMap);
    }
}
exports.WorkspaceManager = WorkspaceManager;
