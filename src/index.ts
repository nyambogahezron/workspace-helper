#!/usr/bin/env node
import { isCancel, outro, select } from "@clack/prompts";
import AlignVersions from "./align-version";
import CreateRelease from "./create-release";
import printLogo from "./utils/logo";

async function main() {
	printLogo();

	const command = await select({
		message: "Choose a command:",
		options: [
			{ value: "manage-release", label: "Manage Releases" },
			{ value: "align-versions", label: "Align Versions" },
		],
	});

	if (isCancel(command)) {
		outro("Operation cancelled");
		process.exit(0);
	}

	if (command === "manage-release") {
		await CreateRelease();
	} else if (command === "align-versions") {
		const alignVersions = new AlignVersions();
		await alignVersions.init();
		await alignVersions.run();
	}
}

main().catch(console.error);
