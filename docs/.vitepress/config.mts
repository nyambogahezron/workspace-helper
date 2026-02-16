import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: "Workspace Version Aligner",
	description: "Keep package versions in sync across your monorepo",
	base: "/",
	themeConfig: {
		socialLinks: [
			{
				icon: "github",
				link: "https://github.com/nyambogahezron/workspace-version-aligner",
			},
		],
		sidebar: [
			{ text: "Introduction", link: "/" },
			{ text: "Get Started", link: "/get-started" },
			{ text: "Releasing", link: "/release" },
		],
		nav: [
			{
				text: "Issues",
				link: "https://github.com/nyambogahezron/workspace-version-aligner/issues",
			},
		],
	},
});
