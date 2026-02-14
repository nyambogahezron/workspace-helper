"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UIHelpers = void 0;
const picocolors_1 = __importDefault(require("picocolors"));
const path_1 = require("path");
const prompts_1 = require("@clack/prompts");
const utils_1 = require("./utils");
class UIHelpers {
    constructor(rootPath) {
        this.rootPath = rootPath;
    }
    getTypeIcon(type) {
        return type === 'app' ? '📱' : type === 'package' ? '📦' : '🏠';
    }
    hasPackage(workspace, packageName) {
        const allDeps = {
            ...workspace.packageJson.dependencies,
            ...workspace.packageJson.devDependencies,
            ...workspace.packageJson.peerDependencies,
        };
        return !!allDeps[packageName];
    }
    async showManualInstallInstructions(targetWorkspaces) {
        const packageManager = await (0, utils_1.detectPackageManager)();
        const installCommand = packageManager;
        let instructions = '\n';
        instructions += picocolors_1.default.yellow('📋 Manual Installation Instructions:\n\n');
        instructions += picocolors_1.default.gray('Run the following commands to install packages manually:\n\n');
        const groups = await (0, utils_1.groupWorkspacesByLocation)(targetWorkspaces, this.rootPath);
        groups.forEach(({ path }) => {
            const relativePath = (0, path_1.relative)(this.rootPath, path);
            instructions += picocolors_1.default.cyan(`📁 ${relativePath || 'root'}:\n`);
            instructions += picocolors_1.default.gray(`   cd ${relativePath || '.'}\n`);
            instructions += picocolors_1.default.green(`   ${installCommand}\n\n`);
        });
        (0, prompts_1.note)(instructions, 'Manual Installation');
    }
    displayPackageList(packageMap) {
        let display = '\n';
        Object.entries(packageMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([packageName, versionMap]) => {
            display += picocolors_1.default.bold(picocolors_1.default.cyan(`📦 ${packageName}\n`));
            Array.from(versionMap.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .forEach(([version, workspaces]) => {
                display += `  ${picocolors_1.default.yellow(version)} ${picocolors_1.default.dim(`(${workspaces.length} workspace${workspaces.length > 1 ? 's' : ''})\n`)}`;
                workspaces.forEach((workspace) => {
                    display += `    ${picocolors_1.default.gray('├─')} ${workspace.name}\n`;
                });
            });
            display += '\n';
        });
        (0, prompts_1.note)(display, 'All Packages');
    }
    formatVersionChange(before, after) {
        return `${picocolors_1.default.dim(String(before))} → ${picocolors_1.default.green(String(after))}`;
    }
    formatWorkspacePath(workspace) {
        const relativePath = (0, path_1.relative)(this.rootPath, workspace.path);
        return `${this.getTypeIcon(workspace.type)} ${workspace.name} ${picocolors_1.default.dim(`(${relativePath})`)}`;
    }
}
exports.UIHelpers = UIHelpers;
