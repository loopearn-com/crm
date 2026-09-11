import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

function major(version: string): number {
	return Number(version.replace(/^v/, "").split(".")[0]);
}

function readNodeVersion(bin: string): string | null {
	const result = Bun.spawnSync([bin, "-p", "process.versions.node"], {
		stdout: "pipe",
		stderr: "pipe",
	});
	if (result.exitCode !== 0) {
		return null;
	}
	const version = result.stdout.toString().trim();
	return version.length > 0 ? version : null;
}

function findNode24BinDir(): string | null {
	const candidates: string[] = [];
	const nvmRoot = join(homedir(), ".nvm", "versions", "node");

	if (existsSync(nvmRoot)) {
		for (const name of readdirSync(nvmRoot).toSorted().toReversed()) {
			if (!name.startsWith("v") || major(name) < 24) {
				continue;
			}
			candidates.push(join(nvmRoot, name, "bin", "node"));
		}
	}

	candidates.push("/usr/local/bin/node", "/opt/homebrew/bin/node");

	const pathNode = Bun.which("node");
	if (pathNode) {
		candidates.push(pathNode);
	}

	for (const bin of candidates) {
		if (!existsSync(bin)) {
			continue;
		}
		const version = readNodeVersion(bin);
		if (version && major(version) >= 24) {
			return dirname(bin);
		}
	}

	return null;
}

function resolveEveBin(): string {
	const local = join(import.meta.dir, "..", "node_modules", ".bin", "eve");
	if (existsSync(local)) {
		return local;
	}
	const fromPath = Bun.which("eve");
	if (fromPath) {
		return fromPath;
	}
	throw new Error("eve binary not found. Run bun install from the repo root.");
}

const nodeBinDir = findNode24BinDir();
if (!nodeBinDir) {
	console.error(
		"eve requires Node.js >=24, and none was found. Install with: nvm install 24 && nvm alias default 24",
	);
	process.exit(1);
}

const env = {
	...process.env,
	PATH: `${nodeBinDir}:${process.env.PATH ?? ""}`,
};
const args = Bun.argv.slice(2);
const proc = Bun.spawn([resolveEveBin(), ...args], {
	stdin: "inherit",
	stdout: "inherit",
	stderr: "inherit",
	env,
});

process.exit(await proc.exited);
