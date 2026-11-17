// Publishes the EmDash agent skills at /.well-known/agent-skills/ following
// the Agent Skills Discovery RFC v0.2.0:
// https://github.com/cloudflare/agent-skills-discovery-rfc
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const SKILLS_TARBALL = "https://codeload.github.com/emdash-cms/skills/tar.gz/refs/heads/main";
const SCHEMA = "https://schemas.agentskills.io/discovery/0.2.0/schema.json";
const BASE_PATH = "/.well-known/agent-skills";

function frontmatterField(markdown, field) {
	const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1] ?? "";
	const value = new RegExp(`^${field}:[ \\t]*(.+)$`, "m").exec(block)?.[1]?.trim() ?? "";
	return value.replace(/^(["'])(.*)\1$/, "$2");
}

async function sha256(path) {
	return `sha256:${createHash("sha256").update(await readFile(path)).digest("hex")}`;
}

/** Writes `index.json` and one artifact per skill into `<outDir>/.well-known/agent-skills/`. */
export async function writeAgentSkills(outDir) {
	const work = await mkdtemp(join(tmpdir(), "agent-skills-"));
	try {
		const response = await fetch(SKILLS_TARBALL);
		if (!response.ok) throw new Error(`Downloading ${SKILLS_TARBALL} failed with ${response.status}`);
		await writeFile(join(work, "skills.tar.gz"), Buffer.from(await response.arrayBuffer()));
		await run("tar", ["-xzf", "skills.tar.gz", "--strip-components=1"], { cwd: work });

		const sourceDir = join(work, "skills");
		const targetDir = join(outDir, BASE_PATH);
		await mkdir(targetDir, { recursive: true });

		const skills = [];
		const entries = await readdir(sourceDir, { withFileTypes: true });
		for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
			if (!entry.isDirectory()) continue;
			const skillDir = join(sourceDir, entry.name);
			const markdown = await readFile(join(skillDir, "SKILL.md"), "utf8");
			const name = frontmatterField(markdown, "name") || entry.name;
			const description = frontmatterField(markdown, "description");
			const files = await readdir(skillDir);

			let type;
			let path;
			if (files.length === 1) {
				type = "skill-md";
				path = `${name}/SKILL.md`;
				await mkdir(join(targetDir, name), { recursive: true });
				await copyFile(join(skillDir, "SKILL.md"), join(targetDir, path));
			} else {
				type = "archive";
				path = `${name}.tar.gz`;
				await run("tar", ["-czf", join(targetDir, path), "-C", skillDir, ...files]);
			}

			skills.push({
				name,
				type,
				description,
				url: `${BASE_PATH}/${path}`,
				digest: await sha256(join(targetDir, path)),
			});
		}

		await writeFile(join(targetDir, "index.json"), `${JSON.stringify({ $schema: SCHEMA, skills }, null, "\t")}\n`);
		return skills.length;
	} finally {
		await rm(work, { recursive: true, force: true });
	}
}
