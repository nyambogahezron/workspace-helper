"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictResolver = void 0;
const picocolors_1 = __importDefault(require("picocolors"));
const prompts_1 = require("@clack/prompts");
const utils_1 = require("./utils");
class ConflictResolver {
    constructor(workspaces, executeSyncVersions, installPackages) {
        this.workspaces = workspaces;
        this.executeSyncVersions = executeSyncVersions;
        this.installPackages = installPackages;
    }
    async findAndResolveConflicts() {
        const s = (0, prompts_1.spinner)();
        s.start('🔍 Analyzing package versions across workspaces...');
        // Build a comprehensive package version map
        const packageVersionMap = new Map();
        this.workspaces.forEach((workspace) => {
            const allDeps = {
                ...workspace.packageJson.dependencies,
                ...workspace.packageJson.devDependencies,
                ...workspace.packageJson.peerDependencies,
            };
            Object.entries(allDeps).forEach(([packageName, version]) => {
                if (!packageVersionMap.has(packageName)) {
                    packageVersionMap.set(packageName, new Map());
                }
                const versionMap = packageVersionMap.get(packageName);
                if (!versionMap.has(version)) {
                    versionMap.set(version, []);
                }
                versionMap.get(version).push(workspace);
            });
        });
        // Find packages with multiple versions (conflicts)
        const conflicts = Array.from(packageVersionMap.entries())
            .filter(([, versionMap]) => versionMap.size > 1)
            .sort(([a], [b]) => a.localeCompare(b));
        s.stop('✅ Analysis completed');
        if (conflicts.length === 0) {
            (0, prompts_1.note)('🎉 No version conflicts found! All packages have consistent versions across workspaces.', 'All Clear');
            process.exit(0);
        }
        // Display conflicts summary
        this.displayConflictsSummary(conflicts);
        const resolutionChoice = await (0, prompts_1.select)({
            message: 'How would you like to resolve conflicts?',
            options: [
                { value: 'all', label: '🔄 Resolve all conflicts interactively' },
                { value: 'specific', label: '🎯 Choose specific packages to resolve' },
                { value: 'auto', label: '⚡ Auto-resolve to most common versions' },
                { value: 'latest', label: '🚀 Auto-resolve all to latest versions' },
            ],
        });
        if (resolutionChoice === 'all') {
            await this.resolveAllConflicts(conflicts);
        }
        else if (resolutionChoice === 'specific') {
            await this.resolveSpecificConflicts(conflicts);
        }
        else if (resolutionChoice === 'auto') {
            await this.autoResolveToMostCommon(conflicts);
        }
        else if (resolutionChoice === 'latest') {
            await this.autoResolveToLatest(conflicts);
        }
    }
    displayConflictsSummary(conflicts) {
        let conflictsSummary = '\n';
        conflictsSummary += picocolors_1.default.red(`Found ${conflicts.length} package${conflicts.length > 1 ? 's' : ''} with version conflicts:\n\n`);
        conflicts.forEach(([packageName, versionMap]) => {
            conflictsSummary += picocolors_1.default.bold(picocolors_1.default.yellow(`📦 ${packageName}\n`));
            Array.from(versionMap.entries()).forEach(([version, workspaces]) => {
                conflictsSummary += `  ${picocolors_1.default.cyan(version)} ${picocolors_1.default.dim(`(${workspaces.length} workspace${workspaces.length > 1 ? 's' : ''})\n`)}`;
                workspaces.forEach((workspace) => {
                    conflictsSummary += `    ${picocolors_1.default.gray('├─')} ${workspace.name}\n`;
                });
            });
            conflictsSummary += '\n';
        });
        (0, prompts_1.note)(conflictsSummary, 'Version Conflicts Detected');
    }
    async resolveAllConflicts(conflicts) {
        // Prompt for bulk resolution strategy
        const bulkStrategy = await (0, prompts_1.select)({
            message: 'How would you like to resolve all conflicts?',
            options: [
                {
                    value: 'inuse',
                    label: '🎯 Choose a version in use for each package (bulk)',
                },
                { value: 'latest', label: '🚀 Use latest version from npm for all' },
                {
                    value: 'interactive',
                    label: '🛠️ Resolve each conflict interactively (default)',
                },
            ],
        });
        let affectedWorkspaces = [];
        if (bulkStrategy === 'inuse') {
            affectedWorkspaces = await this.resolveBulkInUse(conflicts);
        }
        else if (bulkStrategy === 'latest') {
            affectedWorkspaces = await this.resolveBulkLatest(conflicts);
        }
        else {
            affectedWorkspaces = await this.resolveInteractively(conflicts);
        }
        // Prompt for install ONCE for all affected workspaces
        if (affectedWorkspaces.length > 0) {
            const shouldInstall = await (0, prompts_1.confirm)({
                message: 'Install packages now? (Recommended after resolving conflicts)',
                initialValue: true,
            });
            if (shouldInstall) {
                await this.installPackages(affectedWorkspaces);
            }
        }
        process.exit(0);
    }
    async resolveBulkInUse(conflicts) {
        let affectedWorkspaces = [];
        for (const [packageName, versionMap] of conflicts) {
            // Build options: all in-use versions, plus latest and skip
            let versionOptions = Array.from(versionMap.keys()).map((version) => ({
                value: version,
                label: `${version} ${picocolors_1.default.dim(`(used in ${versionMap.get(version).length} workspace${versionMap.get(version).length > 1 ? 's' : ''})`)}`,
            }));
            versionOptions.push({
                value: 'latest',
                label: `${picocolors_1.default.green('Use latest from npm')}`,
            });
            versionOptions.push({
                value: 'skip',
                label: `${picocolors_1.default.gray('Skip (do nothing)')}`,
            });
            const chosenVersion = await (0, prompts_1.select)({
                message: `Select version to use for ${packageName}:`,
                options: versionOptions,
            });
            if (chosenVersion === 'skip') {
                (0, prompts_1.note)(`Skipped resolution for ${packageName}`, 'Skipped');
                continue;
            }
            let finalVersion = chosenVersion;
            if (chosenVersion === 'latest') {
                const latestVersion = await (0, utils_1.fetchLatestVersionSimple)(packageName);
                finalVersion = latestVersion || 'latest';
            }
            await this.executeSyncVersions(packageName, finalVersion, versionMap, false, true);
            affectedWorkspaces.push(...Array.from(versionMap.values())
                .flat()
                .map((w) => w.path));
        }
        (0, prompts_1.outro)(picocolors_1.default.green('✨ All conflicts resolved to chosen in-use versions!'));
        return [...new Set(affectedWorkspaces)];
    }
    async resolveBulkLatest(conflicts) {
        let affectedWorkspaces = [];
        for (const [packageName, versionMap] of conflicts) {
            const latestVersion = await (0, utils_1.fetchLatestVersionSimple)(packageName);
            const finalVersion = latestVersion || 'latest';
            await this.executeSyncVersions(packageName, finalVersion, versionMap, false, true);
            affectedWorkspaces.push(...Array.from(versionMap.values())
                .flat()
                .map((w) => w.path));
        }
        (0, prompts_1.outro)(picocolors_1.default.green('✨ All conflicts resolved to latest versions!'));
        return [...new Set(affectedWorkspaces)];
    }
    async resolveInteractively(conflicts) {
        let affectedWorkspaces = [];
        for (const [packageName, versionMap] of conflicts) {
            const workspacesPaths = await this.resolvePackageConflict(packageName, versionMap);
            affectedWorkspaces.push(...workspacesPaths);
        }
        (0, prompts_1.outro)(picocolors_1.default.green('✨ All conflicts resolved successfully!'));
        return [...new Set(affectedWorkspaces)];
    }
    async resolveSpecificConflicts(conflicts) {
        const selectedPackages = await (0, prompts_1.multiselect)({
            message: 'Select packages to resolve:',
            options: conflicts.map(([packageName, versionMap]) => ({
                value: packageName,
                label: `📦 ${packageName} ${picocolors_1.default.dim(`(${versionMap.size} versions)`)}`,
            })),
        });
        const selectedConflicts = conflicts.filter(([packageName]) => selectedPackages.includes(packageName));
        for (const [packageName, versionMap] of selectedConflicts) {
            await this.resolvePackageConflict(packageName, versionMap);
        }
        (0, prompts_1.outro)(picocolors_1.default.green('✨ Selected conflicts resolved successfully!'));
        process.exit(0);
    }
    async resolvePackageConflict(packageName, versionMap) {
        // Display current versions for this package
        let versionDisplay = '\n';
        versionDisplay += picocolors_1.default.bold(picocolors_1.default.cyan(`📦 Resolving: ${packageName}\n\n`));
        Array.from(versionMap.entries()).forEach(([version, workspaces]) => {
            versionDisplay += picocolors_1.default.yellow(`Version ${version}:\n`);
            workspaces.forEach((workspace) => {
                versionDisplay += `  ${picocolors_1.default.gray('├─')} ${workspace.name}\n`;
            });
            versionDisplay += '\n';
        });
        (0, prompts_1.note)(versionDisplay, `Conflict Resolution for ${packageName}`);
        // Fetch latest version from npm
        const latestVersion = await (0, utils_1.fetchLatestVersionSimple)(packageName);
        const currentVersions = Array.from(versionMap.keys());
        const isNewer = latestVersion
            ? (0, utils_1.isVersionNewer)(latestVersion, currentVersions)
            : false;
        // Display npm latest version info if available
        if (latestVersion) {
            const latestInfo = `\n📋 Latest version on npm: ${picocolors_1.default.green(latestVersion)}${isNewer
                ? picocolors_1.default.yellow(' 🆕 (newer than current versions)')
                : picocolors_1.default.gray(' (already in use)')}\n`;
            (0, prompts_1.note)(latestInfo, 'NPM Registry Info');
        }
        const resolutionOptions = [
            ...Array.from(versionMap.keys()).map((version) => ({
                value: version,
                label: `${version} ${picocolors_1.default.dim(`(used in ${versionMap.get(version).length} workspace${versionMap.get(version).length > 1 ? 's' : ''})`)}`,
            })),
            ...(latestVersion
                ? [
                    {
                        value: latestVersion,
                        label: `${latestVersion} ${picocolors_1.default.green('(latest from npm)')} ${isNewer ? picocolors_1.default.yellow('🆕') : ''}`,
                    },
                ]
                : []),
            { value: 'custom', label: '✨ Enter custom version' },
            { value: 'skip', label: '⏭️  Skip this package' },
        ];
        const targetVersion = await (0, prompts_1.select)({
            message: `Select target version for ${packageName}:`,
            options: resolutionOptions,
        });
        if (targetVersion === 'skip') {
            (0, prompts_1.note)(`Skipped resolution for ${packageName}`, 'Skipped');
            return [];
        }
        let finalVersion = targetVersion;
        if (targetVersion === 'custom') {
            const customVersion = await (0, prompts_1.text)({
                message: `Enter custom version for ${packageName}:`,
                placeholder: 'e.g., ^5.6.0, latest, ~4.0.0',
                validate: (value) => value.length === 0 ? 'Version is required' : undefined,
            });
            finalVersion = customVersion;
        }
        await this.executeSyncVersions(packageName, finalVersion, versionMap, false, true);
        return Array.from(versionMap.values())
            .flat()
            .map((w) => w.path);
    }
    async autoResolveToMostCommon(conflicts) {
        let affectedWorkspaces = [];
        for (const [packageName, versionMap] of conflicts) {
            // Find the version used by the most workspaces
            let mostCommonVersion = '';
            let maxCount = 0;
            for (const [version, workspaces] of versionMap.entries()) {
                if (workspaces.length > maxCount) {
                    maxCount = workspaces.length;
                    mostCommonVersion = version;
                }
            }
            await this.executeSyncVersions(packageName, mostCommonVersion, versionMap, false, true);
            affectedWorkspaces.push(...Array.from(versionMap.values())
                .flat()
                .map((w) => w.path));
        }
        (0, prompts_1.outro)(picocolors_1.default.green('✨ All conflicts resolved to most common versions!'));
        return [...new Set(affectedWorkspaces)];
    }
    async autoResolveToLatest(conflicts) {
        let affectedWorkspaces = [];
        for (const [packageName, versionMap] of conflicts) {
            const latestVersion = await (0, utils_1.fetchLatestVersionSimple)(packageName);
            const finalVersion = latestVersion || 'latest';
            await this.executeSyncVersions(packageName, finalVersion, versionMap, false, true);
            affectedWorkspaces.push(...Array.from(versionMap.values())
                .flat()
                .map((w) => w.path));
        }
        (0, prompts_1.outro)(picocolors_1.default.green('✨ All conflicts resolved to latest versions!'));
        return [...new Set(affectedWorkspaces)];
    }
}
exports.ConflictResolver = ConflictResolver;
