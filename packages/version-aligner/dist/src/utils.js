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
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLatestVersionSimple = fetchLatestVersionSimple;
exports.isVersionNewer = isVersionNewer;
exports.groupWorkspacesByLocation = groupWorkspacesByLocation;
exports.detectPackageManager = detectPackageManager;
const fs_1 = require("fs");
const path_1 = require("path");
async function fetchLatestVersionSimple(packageName) {
    try {
        // Use npm view command to get latest version
        const { spawn } = await Promise.resolve().then(() => __importStar(require('child_process')));
        const result = await new Promise((resolve, reject) => {
            var _a, _b;
            const npmProcess = spawn('npm', ['view', packageName, 'version'], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            let stdout = '';
            let stderr = '';
            (_a = npmProcess.stdout) === null || _a === void 0 ? void 0 : _a.on('data', (data) => {
                stdout += data.toString();
            });
            (_b = npmProcess.stderr) === null || _b === void 0 ? void 0 : _b.on('data', (data) => {
                stderr += data.toString();
            });
            npmProcess.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout.trim());
                }
                else {
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
    }
    catch (error) {
        // Silently fail and continue without latest version info
        return null;
    }
}
function isVersionNewer(latestVersion, currentVersions) {
    // Simple check - if the latest version is not in current versions, consider it newer
    // This is a basic implementation. For more accurate comparison, you'd need semver
    const cleanLatest = latestVersion.replace(/[\^~]/g, '');
    const cleanCurrents = currentVersions.map((v) => v.replace(/[\^~]/g, ''));
    return !cleanCurrents.includes(cleanLatest);
}
async function groupWorkspacesByLocation(targetWorkspaces, rootPath) {
    // For monorepos, we usually want to install from the root
    // But we'll also support individual workspace installation
    const groups = new Map();
    // Check if this is a monorepo (has workspaces in package.json)
    const rootPackageJsonPath = (0, path_1.join)(rootPath, 'package.json');
    if ((0, fs_1.existsSync)(rootPackageJsonPath)) {
        try {
            const rootPackageJson = JSON.parse((0, fs_1.readFileSync)(rootPackageJsonPath, 'utf-8'));
            if (rootPackageJson.workspaces) {
                // It's a monorepo, install from root
                groups.set(rootPath, targetWorkspaces);
                return Array.from(groups.entries()).map(([path, workspaces]) => ({
                    path,
                    workspaces,
                }));
            }
        }
        catch (error) {
            // Continue with individual installations
        }
    }
    // Not a monorepo, group by workspace directories
    targetWorkspaces.forEach((workspace) => {
        const workspaceDir = workspace;
        if (!groups.has(workspaceDir)) {
            groups.set(workspaceDir, []);
        }
        groups.get(workspaceDir).push(workspace);
    });
    return Array.from(groups.entries()).map(([path, workspaces]) => ({
        path,
        workspaces,
    }));
}
async function detectPackageManager() {
    // Check for lock files to determine package manager
    if ((0, fs_1.existsSync)('pnpm-lock.yaml'))
        return 'pnpm install';
    if ((0, fs_1.existsSync)('yarn.lock'))
        return 'yarn install';
    if ((0, fs_1.existsSync)('bun.lockb'))
        return 'bun install';
    return 'npm install';
}
