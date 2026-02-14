#!/usr/bin/env bun
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prompts_1 = require("@clack/prompts");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const picocolors_1 = __importDefault(require("picocolors"));
const workspace_1 = require("./src/workspace");
const package_operations_1 = require("./src/package-operations");
const conflict_resolver_1 = require("./src/conflict-resolver");
const ui_1 = require("./src/ui");
const utils_1 = require("./src/utils");
class PackageUpdater {
    constructor(rootPath = process.cwd()) {
        this.rootPath = rootPath;
        this.workspaceManager = new workspace_1.WorkspaceManager(rootPath);
        this.ui = new ui_1.UIHelpers(rootPath);
        // These will be initialized after workspace scanning
        this.packageOps = null;
        this.conflictResolver = null;
    }
    async init() {
        console.clear();
        (0, prompts_1.intro)(picocolors_1.default.bold(picocolors_1.default.cyan('📦 Package Updater')));
        await this.workspaceManager.scanWorkspaces();
        const workspaces = this.workspaceManager.getWorkspaces();
        // Initialize other modules with workspace data and required dependencies
        this.packageOps = new package_operations_1.PackageOperations(workspaces, this.rootPath, () => this.workspaceManager.displayWorkspaces(), (type) => this.ui.getTypeIcon(type), (workspace, packageName) => this.ui.hasPackage(workspace, packageName), (targetWorkspaces) => this.installPackages(targetWorkspaces));
        this.conflictResolver = new conflict_resolver_1.ConflictResolver(workspaces, (packageName, targetVersion, versions, dryRun, suppressExit) => this.executeSyncVersions(packageName, targetVersion, versions, dryRun, suppressExit), (targetWorkspaces) => this.installPackages(targetWorkspaces));
    }
    async run() {
        try {
            const action = await (0, prompts_1.select)({
                message: 'What would you like to do?',
                options: [
                    { value: 'add', label: '➕ Add or update package' },
                    { value: 'remove', label: '🗑️  Remove package' },
                    { value: 'sync', label: '🔄 Sync package versions' },
                    {
                        value: 'conflicts',
                        label: '⚠️  Find and resolve version conflicts',
                    },
                    { value: 'list', label: '📋 List all packages' },
                    {
                        value: 'install',
                        label: '🚀 Install packages (run package manager)',
                    },
                ],
            });
            if ((0, prompts_1.isCancel)(action)) {
                (0, prompts_1.cancel)('Operation cancelled');
                return;
            }
            switch (action) {
                case 'add':
                    await this.packageOps.addOrUpdatePackage();
                    break;
                case 'remove':
                    await this.packageOps.removePackage();
                    break;
                case 'sync':
                    const syncResult = await this.packageOps.syncPackageVersions();
                    if (syncResult) {
                        await this.executeSyncVersions(syncResult.packageName, syncResult.targetVersion, syncResult.versions, syncResult.dryRun);
                    }
                    break;
                case 'conflicts':
                    await this.conflictResolver.findAndResolveConflicts();
                    break;
                case 'list':
                    await this.listPackages();
                    break;
                case 'install':
                    await this.showInstallPrompt();
                    break;
            }
        }
        catch (error) {
            (0, prompts_1.outro)(picocolors_1.default.red('❌ An error occurred: ' + error.message));
            process.exit(1);
        }
    }
    async listPackages() {
        const packageMap = this.workspaceManager.getAllPackages();
        this.ui.displayPackageList(packageMap);
    }
    async showInstallPrompt() {
        this.workspaceManager.displayWorkspaces();
        const confirmInstall = await (0, prompts_1.confirm)({
            message: 'Install packages for all workspaces? (This will run the package manager)',
            initialValue: true,
        });
        if (confirmInstall) {
            const allWorkspaces = this.workspaceManager
                .getWorkspaces()
                .map((w) => w.path);
            await this.installPackages(allWorkspaces);
            (0, prompts_1.outro)(picocolors_1.default.green('✨ Package installation completed successfully!'));
        }
    }
    async executeSyncVersions(packageName, targetVersion, versions, dryRun, suppressExit) {
        var _a, _b, _c;
        const s = (0, prompts_1.spinner)();
        s.start(dryRun ? 'Previewing sync...' : 'Syncing versions...');
        const changes = [];
        try {
            for (const [version, workspaces] of versions.entries()) {
                if (version === targetVersion)
                    continue;
                for (const workspace of workspaces) {
                    const packageJsonPath = (0, path_1.join)(workspace.path, 'package.json');
                    const packageJson = JSON.parse(await (0, promises_1.readFile)(packageJsonPath, 'utf-8'));
                    let depType = '';
                    if ((_a = packageJson.dependencies) === null || _a === void 0 ? void 0 : _a[packageName]) {
                        depType = 'dependencies';
                        if (!dryRun)
                            packageJson.dependencies[packageName] = targetVersion;
                    }
                    else if ((_b = packageJson.devDependencies) === null || _b === void 0 ? void 0 : _b[packageName]) {
                        depType = 'devDependencies';
                        if (!dryRun)
                            packageJson.devDependencies[packageName] = targetVersion;
                    }
                    else if ((_c = packageJson.peerDependencies) === null || _c === void 0 ? void 0 : _c[packageName]) {
                        depType = 'peerDependencies';
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
                        await (0, promises_1.writeFile)(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
                    }
                }
            }
            s.stop(dryRun ? '👀 Preview completed' : '✅ Sync completed');
            let changesDisplay = '\n';
            changes.forEach((change) => {
                changesDisplay += `🔄 ${change.workspace}: ${picocolors_1.default.dim(String(change.before))} → ${picocolors_1.default.green(String(change.after))} ${picocolors_1.default.gray(`(${change.type})`)}\n`;
            });
            (0, prompts_1.note)(changesDisplay, dryRun ? 'Preview Sync' : 'Applied Sync');
            if (dryRun) {
                const apply = await (0, prompts_1.confirm)({
                    message: 'Apply these changes?',
                    initialValue: false,
                });
                if (apply) {
                    await this.executeSyncVersions(packageName, targetVersion, versions, false, suppressExit);
                }
            }
            else {
                if (!suppressExit) {
                    // Ask if user wants to install packages after successful sync
                    const shouldInstall = await (0, prompts_1.confirm)({
                        message: 'Install packages now? (Recommended after version changes)',
                        initialValue: true,
                    });
                    if (shouldInstall) {
                        const allWorkspaces = Array.from(versions.values())
                            .flat()
                            .map((w) => w.path);
                        await this.installPackages(allWorkspaces);
                    }
                    (0, prompts_1.outro)(picocolors_1.default.green('✨ Version sync completed successfully!'));
                    process.exit(0);
                }
            }
        }
        catch (error) {
            s.stop('❌ Sync failed');
            throw error;
        }
    }
    async installPackages(targetWorkspaces) {
        const s = (0, prompts_1.spinner)();
        s.start('📦 Installing packages...');
        try {
            // Check if we're in a workspace with package manager preference
            const packageManager = await (0, utils_1.detectPackageManager)();
            // Group workspaces by their location for more efficient installation
            const workspaceGroups = await (0, utils_1.groupWorkspacesByLocation)(targetWorkspaces, this.rootPath);
            for (const { path, workspaces } of workspaceGroups) {
                const { spawn } = await Promise.resolve().then(() => __importStar(require('child_process')));
                const installCommand = this.getInstallCommand(packageManager);
                const [command, ...args] = installCommand;
                s.message(`Installing in ${path}...`);
                await new Promise((resolve, reject) => {
                    var _a, _b;
                    const installProcess = spawn(command, args, {
                        cwd: path,
                        stdio: ['inherit', 'pipe', 'pipe'],
                    });
                    let stdout = '';
                    let stderr = '';
                    (_a = installProcess.stdout) === null || _a === void 0 ? void 0 : _a.on('data', (data) => {
                        stdout += data.toString();
                    });
                    (_b = installProcess.stderr) === null || _b === void 0 ? void 0 : _b.on('data', (data) => {
                        stderr += data.toString();
                    });
                    installProcess.on('close', (code) => {
                        if (code === 0) {
                            resolve();
                        }
                        else {
                            reject(new Error(`Installation failed in ${path}: ${stderr || 'Unknown error'}`));
                        }
                    });
                    // Timeout after 5 minutes
                    setTimeout(() => {
                        installProcess.kill();
                        reject(new Error('Installation timeout'));
                    }, 300000);
                });
            }
            s.stop('✅ Installation completed');
        }
        catch (error) {
            s.stop('❌ Installation failed');
            // Show manual installation instructions as fallback
            await this.ui.showManualInstallInstructions(targetWorkspaces);
            throw error;
        }
    }
    getInstallCommand(packageManager) {
        if (packageManager.includes('pnpm'))
            return ['pnpm', 'install'];
        if (packageManager.includes('yarn'))
            return ['yarn'];
        if (packageManager.includes('bun'))
            return ['bun', 'install'];
        return ['npm', 'install'];
    }
}
// Run the script
const updater = new PackageUpdater();
updater
    .init()
    .then(() => updater.run())
    .catch(console.error);
