import pc from "picocolors";
import packageJson from "../../package.json";
import { getVersion } from "./get-version";

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
	console.log(pc.dim(`                                     v${version}`));
	console.log("");
}
