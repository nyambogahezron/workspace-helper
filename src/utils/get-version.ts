export function getVersion(version: string) {
	return version.replace(/\^|~/, "");
}
