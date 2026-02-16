import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { confirm, isCancel, select, text } from "@clack/prompts";
import semver from "semver";
import packageJson from "../../package.json";

function findAllPackageJsons(dir: string, fileList: string[] = []): string[] {
	const files = fs.readdirSync(dir);

	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);

		if (stat.isDirectory()) {
			if (
				file !== "node_modules" &&
				file !== ".git" &&
				file !== ".release-temp" &&
				file !== "dist"
			) {
				findAllPackageJsons(filePath, fileList);
			}
		} else if (file === "package.json") {
			fileList.push(filePath);
		}
	}

	return fileList;
}

export default async function CreateRelease() {
	const gitignorePath = path.join(process.cwd(), ".gitignore");
	const releaseTempEntry = ".release-temp";

	if (fs.existsSync(gitignorePath)) {
		const content = fs.readFileSync(gitignorePath, "utf-8");
		if (!content.includes(releaseTempEntry)) {
			fs.appendFileSync(gitignorePath, `\n${releaseTempEntry}\n`);
			console.log("Added .release-temp to .gitignore");
		}
	} else {
		fs.writeFileSync(gitignorePath, `${releaseTempEntry}\n`);
		console.log("Created .gitignore with .release-temp");
	}

	const releaseTempDir = path.join(process.cwd(), ".release-temp");
	const hasPendingRelease = fs.existsSync(releaseTempDir);

	const actions = await select({
		message: "Choose a action:",
		options: [
			{ value: "new", label: "Create new release" },
			...(hasPendingRelease
				? [{ value: "resume", label: "Resume pending release" }]
				: []),
			{ value: "list", label: "List all releases" },
		],
	});

	if (isCancel(actions)) {
		console.log("Operation cancelled");
		process.exit(0);
	}

	if (actions === "new" || actions === "resume") {
		let version = "";
		let nextVersion = "";

		if (actions === "resume") {
			// Try to find the version from the existing files in .release-temp
			const files = fs.readdirSync(releaseTempDir);
			const versionFile = files.find(
				(f) => f.endsWith(".md") && !f.endsWith("-changelog.md"),
			);
			if (versionFile) {
				version = versionFile.replace(".md", "");
				console.log(`Resuming release for version: ${version}`);
			} else {
				console.error("Could not find pending release files. Starting new.");
				const currentVersion = packageJson.version;
				nextVersion = semver.inc(currentVersion, "patch") || currentVersion;
			}
		} else {
			const currentVersion = packageJson.version;
			nextVersion = semver.inc(currentVersion, "patch") || currentVersion;

			version = (await text({
				message: "Enter version",
				placeholder: nextVersion,
				validate(value) {
					if (!value) return;
					if (!semver.valid(value)) return "Invalid version";
				},
			})) as string;
		}

		// Use .release-temp directory
		if (!fs.existsSync(releaseTempDir)) {
			fs.mkdirSync(releaseTempDir, { recursive: true });
		}

		const releaseNotePath = path.join(
			releaseTempDir,
			`${version || nextVersion}.md`,
		);
		const changelogEntryPath = path.join(
			releaseTempDir,
			`${version || nextVersion}-changelog.md`,
		);

		if (!fs.existsSync(releaseNotePath)) {
			const template = `## ${version || nextVersion}\n\n### Features\n\n- \n\n### Fixes\n\n- \n`;
			fs.writeFileSync(releaseNotePath, template);
		}

		if (!fs.existsSync(changelogEntryPath)) {
			const template = `## ${version || nextVersion}\n\n### Features\n\n- \n\n### Fixes\n\n- \n`;
			fs.writeFileSync(changelogEntryPath, template);
		}

		console.log(`\nRelease notes created at: ${releaseNotePath}`);
		console.log(`Changelog entry created at: ${changelogEntryPath}`);
		console.log(
			"Please edit these files with your release notes and changelog entry.",
		);

		const cleanup = () => {
			if (fs.existsSync(releaseNotePath)) fs.unlinkSync(releaseNotePath);
			if (fs.existsSync(changelogEntryPath)) fs.unlinkSync(changelogEntryPath);
			if (fs.existsSync(releaseTempDir)) fs.rmdirSync(releaseTempDir);
		};

		const ready = await confirm({
			message: "Are you ready to continue?",
		});

		if (isCancel(ready) || !ready) {
			console.log(
				"Operation paused. Files preserved in .release-temp for resumption.",
			);
			process.exit(0);
		}

		const updateChangelog = await confirm({
			message: "Do you want to update CHANGELOG.md?",
		});

		if (isCancel(updateChangelog)) {
			console.log(
				"Operation paused. Files preserved in .release-temp for resumption.",
			);
			process.exit(0);
		}

		if (updateChangelog) {
			const changelogEntryContent = fs.readFileSync(
				changelogEntryPath,
				"utf-8",
			);
			const changelogPath = path.join(process.cwd(), "CHANGELOG.md");

			let changelogContent = "# Changelog\n\n";
			if (fs.existsSync(changelogPath)) {
				changelogContent = fs.readFileSync(changelogPath, "utf-8");
			}

			// Avoid duplicating entry if resuming
			if (!changelogContent.includes(version || nextVersion)) {
				const newChangelog = `${changelogEntryContent}\n\n${changelogContent}`;
				fs.writeFileSync(changelogPath, newChangelog);
				console.log("CHANGELOG.md updated.");
			} else {
				console.log(
					"CHANGELOG.md already contains this version. Skipping update.",
				);
			}
		}

		const release = await confirm({
			message: "Do you want to create the release (git tag & push)?",
		});

		if (isCancel(release) || !release) {
			console.log(
				"Operation paused. Files preserved in .release-temp for resumption.",
			);
			process.exit(0);
		}

		const targetVersion = version || nextVersion;
		console.log(
			`Updating all package.json files to version ${targetVersion}...`,
		);

		const allPackageJsons = findAllPackageJsons(process.cwd());

		for (const pkgPath of allPackageJsons) {
			try {
				const pkgContent = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
				pkgContent.version = targetVersion;
				fs.writeFileSync(pkgPath, `${JSON.stringify(pkgContent, null, 2)}\n`);
				console.log(`Updated ${path.relative(process.cwd(), pkgPath)}`);
			} catch (err) {
				console.error(
					`Failed to update ${path.relative(process.cwd(), pkgPath)}:`,
					err,
				);
			}
		}

		console.log("Pushing changes...");
		const packageFiles = allPackageJsons.map((p) =>
			path.relative(process.cwd(), p),
		);

		execFileSync("git", ["add", ...packageFiles, "CHANGELOG.md"], {
			stdio: "inherit",
		});
		execFileSync("git", ["commit", "-m", `chore(release): v${targetVersion}`], {
			stdio: "inherit",
		});
		execFileSync("git", ["push"], { stdio: "inherit" });
		execFileSync("git", ["tag", `v${targetVersion}`], { stdio: "inherit" });
		execFileSync("git", ["push", "origin", `v${targetVersion}`], {
			stdio: "inherit",
		});

		console.log("Creating GitHub Release...");
		execFileSync(
			"gh",
			[
				"release",
				"create",
				`v${version || nextVersion}`,
				"--title",
				`v${version || nextVersion}`,
				"--notes-file",
				releaseNotePath,
			],
			{ stdio: "inherit" },
		);

		cleanup();
		console.log(`Release v${version || nextVersion} created successfully!`);
		process.exit(0);
	}

	if (actions === "list") {
		try {
			const tagsOutput = execFileSync("git", ["tag"], { encoding: "utf-8" });
			const tags = tagsOutput
				.split("\n")
				.map((tag) => tag.trim())
				.filter((tag) => tag.length > 0);

			const validTags = tags.filter((tag) => semver.valid(semver.clean(tag)));

			if (validTags.length === 0) {
				console.log("No releases found.");
			} else {
				const sortedTags = validTags.sort((a, b) => {
					const cleanA = semver.clean(a);
					const cleanB = semver.clean(b);
					if (!cleanA || !cleanB) return 0;
					return semver.rcompare(cleanA, cleanB);
				});

				console.log("\nReleases:");
				sortedTags.forEach((tag) => {
					console.log(` - ${tag}`);
				});
			}
		} catch (error) {
			console.error(
				"Failed to list releases:",
				error instanceof Error ? error.message : String(error),
			);
		}
		process.exit(0);
	}
}
