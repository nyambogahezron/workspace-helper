import pc from "picocolors";
import packageJson from "../../package.json";

function getVersion(version: string) {
	return version.replace(/\^|~/, "").split(".");
}

export const logo = `
 __      __            __                                     
/  \\    /  |          /  |                                    
$$  \\  /$$/______     $$ |__    ______   ______    ______     
 $$  \\/$$//      \\    $$    |  /      \\ /      \\  /      \\    
  $$  $$/($$$$$$  |   $$$$$$| /$$$$$$  |$$$$$$  |/$$$$$$  |   
   $$$$/  /    $$ |   $$ |  | $$    $$ |$$ |  $$/ $$    $$ |   
    $$ | /$$$$$$$ |   $$ |  | $$$$$$$$/ $$ |      $$$$$$$$/    
    $$ | $$    $$ |   $$ |  | $$       |$$ |      $$       |   
    $$/   $$$$$$$/    $$/     $$$$$$$/ $$/         $$$$$$$/    
`;

export default function printLogo() {
	const version = getVersion(packageJson.version);
	console.log(pc.cyan(pc.bold(logo)));
	console.log(pc.dim(`v${version}`));
	console.log("");
}
