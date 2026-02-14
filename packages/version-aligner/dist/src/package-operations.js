"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageOperations = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const picocolors_1 = __importDefault(require("picocolors"));
const prompts_1 = require("@clack/prompts");
const utils_1 = require("./utils");
class PackageOperations {
    constructor(workspaces, rootPath, displayWorkspaces, getTypeIcon, hasPackage, installPackages) {
        this.workspaces = workspaces;
        this.rootPath = rootPath;
        this.displayWorkspaces = displayWorkspaces;
        this.getTypeIcon = getTypeIcon;
        this.hasPackage = hasPackage;
        this.installPackages = installPackages;
    }
    async addOrUpdatePackage() {
        this.displayWorkspaces();
        const packageName = await (0, prompts_1.text)({
            message: 'Enter package name:',
            placeholder: 'e.g., typescript, react, lodash',
            validate: (value) => value.length === 0 ? 'Package name is required' : undefined,
        });
        if ((0, prompts_1.isCancel)(packageName)) {
            (0, prompts_1.cancel)('Operation cancelled');
            return;
        }
        // Fetch and display latest version info
        const latestVersionInfo = await (0, utils_1.fetchLatestVersionSimple)(packageName);
        if (latestVersionInfo) {
            const latestInfo = `\n📋 Latest version on npm: ${picocolors_1.default.green(latestVersionInfo)}\n`;
            (0, prompts_1.note)(latestInfo, 'NPM Registry Info');
        }
        const version = await (0, prompts_1.text)({
            message: 'Enter package version:',
            placeholder: 'e.g., ^5.6.0, latest, ~4.0.0',
            defaultValue: latestVersionInfo || 'latest',
        });
        if ((0, prompts_1.isCancel)(version)) {
            (0, prompts_1.cancel)('Operation cancelled');
            return;
        }
        const dependencyType = await (0, prompts_1.select)({
            message: 'Select dependency type:',
            options: [
                { value: 'devDependencies', label: '🔧 devDependencies' },
                { value: 'dependencies', label: '📦 dependencies' },
                { value: 'peerDependencies', label: '🤝 peerDependencies' },
            ],
        });
        const scopeChoice = await (0, prompts_1.select)({
            message: 'Select update scope:',
            options: [
                { value: 'all', label: '🌍 All workspaces' },
                { value: 'byType', label: '🎯 By workspace type (apps/packages)' },
                { value: 'custom', label: '✨ Custom selection' },
            ],
        });
        let targetWorkspaces = [];
        if (scopeChoice === 'all') {
            targetWorkspaces = this.workspaces.map((w) => w.path);
        }
        else if (scopeChoice === 'byType') {
            const typeChoice = await (0, prompts_1.multiselect)({
                message: 'Select workspace types:',
                options: [
                    { value: 'root', label: '🏠 Root workspace' },
                    { value: 'app', label: '📱 Apps' },
                    { value: 'package', label: '📦 Packages' },
                ],
            });
            targetWorkspaces = this.workspaces
                .filter((w) => Array.isArray(typeChoice) && typeChoice.includes(w.type))
                .map((w) => w.path);
        }
        else {
            const selectedWorkspaces = await (0, prompts_1.multiselect)({
                message: 'Select specific workspaces:',
                options: this.workspaces.map((w) => ({
                    value: w.path,
                    label: `${this.getTypeIcon(w.type)} ${w.name} ${picocolors_1.default.dim(`(${(0, path_1.relative)(this.rootPath, w.path)})`)}`,
                })),
            });
            targetWorkspaces = selectedWorkspaces;
        }
        const dryRun = await (0, prompts_1.confirm)({
            message: 'Run in dry-run mode? (Preview changes without applying)',
            initialValue: true,
        });
        const config = {
            packageName: packageName,
            version: version,
            dependencyType: dependencyType,
            targetWorkspaces,
            dryRun: dryRun,
        };
        await this.executeUpdate(config);
    }
    async removePackage() {
        this.displayWorkspaces();
        // First, find all packages across workspaces
        const allPackages = new Set();
        this.workspaces.forEach((workspace) => {
            Object.keys(workspace.packageJson.dependencies || {}).forEach((pkg) => allPackages.add(pkg));
            Object.keys(workspace.packageJson.devDependencies || {}).forEach((pkg) => allPackages.add(pkg));
            Object.keys(workspace.packageJson.peerDependencies || {}).forEach((pkg) => allPackages.add(pkg));
        });
        const packageToRemove = await (0, prompts_1.select)({
            message: 'Select package to remove:',
            options: Array.from(allPackages)
                .sort()
                .map((pkg) => ({
                value: pkg,
                label: pkg,
            })),
        });
        const targetWorkspaces = await (0, prompts_1.multiselect)({
            message: 'Select workspaces to remove from:',
            options: this.workspaces
                .filter((w) => this.hasPackage(w, packageToRemove))
                .map((w) => ({
                value: w.path,
                label: `${this.getTypeIcon(w.type)} ${w.name} ${picocolors_1.default.dim(`(${(0, path_1.relative)(this.rootPath, w.path)})`)}`,
            })),
        });
        const dryRun = await (0, prompts_1.confirm)({
            message: 'Run in dry-run mode?',
            initialValue: true,
        });
        await this.executeRemoval(packageToRemove, targetWorkspaces, dryRun);
    }
    async syncPackageVersions() {
        const packageName = await (0, prompts_1.text)({
            message: 'Enter package name to sync:',
            placeholder: 'e.g., typescript, react',
        });
        if ((0, prompts_1.isCancel)(packageName)) {
            (0, prompts_1.cancel)('Operation cancelled');
            return;
        }
        // Find all versions of this package
        const versions = new Map();
        this.workspaces.forEach((workspace) => {
            const deps = {
                ...workspace.packageJson.dependencies,
                ...workspace.packageJson.devDependencies,
            };
            if (deps[packageName]) {
                const version = deps[packageName];
                if (!versions.has(version)) {
                    versions.set(version, []);
                }
                versions.get(version).push(workspace);
            }
        });
        if (versions.size === 0) {
            (0, prompts_1.note)(`Package "${String(packageName)}" not found in any workspace`, 'No Package Found');
            return;
        }
        if (versions.size === 1) {
            (0, prompts_1.note)(`Package "${String(packageName)}" already has consistent version: ${Array.from(versions.keys())[0]}`, 'Already Synced');
            return;
        }
        // Display current versions
        let versionDisplay = '\n';
        versions.forEach((workspaces, version) => {
            versionDisplay += picocolors_1.default.yellow(`Version ${version}:\n`);
            workspaces.forEach((w) => {
                versionDisplay += `  ${picocolors_1.default.gray('├─')} ${w.name}\n`;
            });
            versionDisplay += '\n';
        });
        (0, prompts_1.note)(versionDisplay, `Current versions of "${String(packageName)}"`);
        const targetVersion = await (0, prompts_1.select)({
            message: 'Select version to sync to:',
            options: Array.from(versions.keys()).map((version) => ({
                value: version,
                label: `${version} (used in ${versions.get(version).length} workspace${versions.get(version).length > 1 ? 's' : ''})`,
            })),
        });
        if ((0, prompts_1.isCancel)(targetVersion)) {
            (0, prompts_1.cancel)('Operation cancelled');
            return;
        }
        const dryRun = await (0, prompts_1.confirm)({
            message: 'Run in dry-run mode?',
            initialValue: true,
        });
        if ((0, prompts_1.isCancel)(dryRun)) {
            (0, prompts_1.cancel)('Operation cancelled');
            return;
        }
        return {
            packageName: packageName,
            targetVersion: targetVersion,
            versions,
            dryRun: dryRun,
        };
    }
    async executeUpdate(config) {
        var _a;
        const s = (0, prompts_1.spinner)();
        s.start(config.dryRun ? 'Previewing changes...' : 'Updating packages...');
        const changes = [];
        try {
            for (const workspacePath of config.targetWorkspaces) {
                const workspace = this.workspaces.find((w) => w.path === workspacePath);
                if (!workspace)
                    continue;
                const packageJsonPath = (0, path_1.join)(workspacePath, 'package.json');
                const packageJson = JSON.parse(await (0, promises_1.readFile)(packageJsonPath, 'utf-8'));
                const currentVersion = (_a = packageJson[config.dependencyType]) === null || _a === void 0 ? void 0 : _a[config.packageName];
                if (!packageJson[config.dependencyType]) {
                    packageJson[config.dependencyType] = {};
                }
                packageJson[config.dependencyType][config.packageName] = config.version;
                changes.push({
                    workspace: workspace.name,
                    action: currentVersion ? 'update' : 'add',
                    before: currentVersion,
                    after: config.version,
                });
                if (!config.dryRun) {
                    await (0, promises_1.writeFile)(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
                }
            }
            s.stop(config.dryRun ? '👀 Preview completed' : '✅ Update completed');
            // Display changes
            let changesDisplay = '\n';
            changes.forEach((change) => {
                const icon = change.action === 'add' ? '➕' : '📝';
                const action = change.action === 'add'
                    ? 'Added'
                    : `Updated ${picocolors_1.default.dim(String(change.before))} → `;
                changesDisplay += `${icon} ${change.workspace}: ${action}${picocolors_1.default.green(change.after)}\n`;
            });
            (0, prompts_1.note)(changesDisplay, config.dryRun ? 'Preview Changes' : 'Applied Changes');
            if (config.dryRun) {
                const apply = await (0, prompts_1.confirm)({
                    message: 'Apply these changes?',
                    initialValue: false,
                });
                if (apply) {
                    await this.executeUpdate({ ...config, dryRun: false });
                }
            }
            else {
                // Ask if user wants to install packages after successful update
                const shouldInstall = await (0, prompts_1.confirm)({
                    message: 'Install packages now? (Recommended after package changes)',
                    initialValue: true,
                });
                if (shouldInstall) {
                    await this.installPackages(config.targetWorkspaces);
                }
                (0, prompts_1.outro)(picocolors_1.default.green('✨ Package update completed successfully!'));
                process.exit(0);
            }
        }
        catch (error) {
            s.stop('❌ Update failed');
            throw error;
        }
    }
    async executeRemoval(packageName, targetWorkspaces, dryRun) {
        var _a, _b, _c;
        const s = (0, prompts_1.spinner)();
        s.start(dryRun ? 'Previewing removals...' : 'Removing packages...');
        const changes = [];
        try {
            for (const workspacePath of targetWorkspaces) {
                const workspace = this.workspaces.find((w) => w.path === workspacePath);
                if (!workspace)
                    continue;
                const packageJsonPath = (0, path_1.join)(workspacePath, 'package.json');
                const packageJson = JSON.parse(await (0, promises_1.readFile)(packageJsonPath, 'utf-8'));
                // Remove from all dependency types
                let removedFrom = '';
                let version = '';
                if ((_a = packageJson.dependencies) === null || _a === void 0 ? void 0 : _a[packageName]) {
                    version = packageJson.dependencies[packageName];
                    if (!dryRun)
                        delete packageJson.dependencies[packageName];
                    removedFrom = 'dependencies';
                }
                else if ((_b = packageJson.devDependencies) === null || _b === void 0 ? void 0 : _b[packageName]) {
                    version = packageJson.devDependencies[packageName];
                    if (!dryRun)
                        delete packageJson.devDependencies[packageName];
                    removedFrom = 'devDependencies';
                }
                else if ((_c = packageJson.peerDependencies) === null || _c === void 0 ? void 0 : _c[packageName]) {
                    version = packageJson.peerDependencies[packageName];
                    if (!dryRun)
                        delete packageJson.peerDependencies[packageName];
                    removedFrom = 'peerDependencies';
                }
                if (removedFrom) {
                    changes.push({
                        workspace: workspace.name,
                        type: removedFrom,
                        version,
                    });
                    if (!dryRun) {
                        await (0, promises_1.writeFile)(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
                    }
                }
            }
            s.stop(dryRun ? '👀 Preview completed' : '✅ Removal completed');
            // Display changes
            let changesDisplay = '\n';
            changes.forEach((change) => {
                changesDisplay += `🗑️  ${change.workspace}: Removed from ${change.type} ${picocolors_1.default.dim(`(${change.version})`)}\n`;
            });
            (0, prompts_1.note)(changesDisplay, dryRun ? 'Preview Removals' : 'Applied Removals');
            if (dryRun) {
                const apply = await (0, prompts_1.confirm)({
                    message: 'Apply these changes?',
                    initialValue: false,
                });
                if (apply) {
                    await this.executeRemoval(packageName, targetWorkspaces, false);
                }
            }
            else {
                // Ask if user wants to install packages after successful removal
                const shouldInstall = await (0, prompts_1.confirm)({
                    message: 'Install packages now? (Recommended after package changes)',
                    initialValue: true,
                });
                if (shouldInstall) {
                    await this.installPackages(targetWorkspaces);
                }
                (0, prompts_1.outro)(picocolors_1.default.green('✨ Package removal completed successfully!'));
                process.exit(0);
            }
        }
        catch (error) {
            s.stop('❌ Removal failed');
            throw error;
        }
    }
}
exports.PackageOperations = PackageOperations;
