import { confirm, isCancel, select, text } from "@clack/prompts";

export default async function CreateRelease() {
	// Get user's name
	const name = (await text({
		message: "What is your name?",
		placeholder: "John Doe",
	})) as string;

	// Get user's preferred framework
	const framework = await select({
		message: "Choose a framework:",
		options: [
			{ value: "react", label: "React" },
			{ value: "vue", label: "Vue" },
			{ value: "svelte", label: "Svelte" },
		],
	});

	if (isCancel(framework)) {
		console.log("Operation cancelled");
		process.exit(0);
	}

	// Confirm the selection
	const shouldProceed = await confirm({
		message: `Create a ${framework} project for ${name}?`,
	});

	if (shouldProceed) {
		console.log("Creating project...");
	}
}
