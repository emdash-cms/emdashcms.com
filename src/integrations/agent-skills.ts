import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import type { AstroIntegration } from "astro";
import { parse as parseYaml } from "yaml";

/**
 * Publishes EmDash's agent skills at /.well-known/agent-skills/, following the
 * Agent Skills Discovery RFC v0.2.0:
 * https://github.com/cloudflare/agent-skills-discovery-rfc
 *
 * The skills are the copies pinned in skills-lock.json and installed in
 * .agents/skills/, so the site publishes exactly the files reviewed in this
 * repository. Only skills installed from emdash-cms/skills are published;
 * skills written for this repository stay private.
 *
 * Before dev and build, this writes the index and the skill files to
 * public/.well-known/agent-skills/ (gitignored). They are then served as
 * static assets, which handle ETag, HEAD and 404 responses.
 */

const SCHEMA = "https://schemas.agentskills.io/discovery/0.2.0/schema.json";
const PUBLISHED_SOURCE = "emdash-cms/skills";
const URL_PATH = "/.well-known/agent-skills";

// Agent Skills names: 1-64 lowercase letters, digits and single hyphens.
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// A fixed timestamp keeps archive bytes, and so their digests, the same for
// the same files. npm uses the same date when it packs packages.
const ARCHIVE_MTIME = Date.UTC(1985, 9, 26, 8, 15) / 1000;

interface SkillsLock {
	skills: Record<string, { source: string }>;
}

interface SkillFile {
	path: string;
	data: Buffer;
}

interface SkillEntry {
	name: string;
	type: "skill-md" | "archive";
	description: string;
	url: string;
	digest: string;
}

export default function agentSkills(): AstroIntegration {
	return {
		name: "agent-skills",
		hooks: {
			"astro:config:setup": async ({ command, config, logger }) => {
				if (command !== "dev" && command !== "build") return;

				const skills = await publishSkills(
					fileURLToPath(config.root),
					fileURLToPath(new URL(".well-known/agent-skills/", config.publicDir)),
				);
				logger.info(`Published ${skills.length} agent skills at ${URL_PATH}/`);
			},
		},
	};
}

async function publishSkills(root: string, output: string): Promise<SkillEntry[]> {
	const lock = JSON.parse(await readFile(join(root, "skills-lock.json"), "utf8")) as SkillsLock;
	const names = Object.entries(lock.skills)
		.filter(([, skill]) => skill.source === PUBLISHED_SOURCE)
		.map(([name]) => name)
		.sort();

	await rm(output, { recursive: true, force: true });
	await mkdir(output, { recursive: true });

	const skills: SkillEntry[] = [];
	for (const name of names) {
		if (name.length > 64 || !NAME_PATTERN.test(name)) {
			throw new Error(`Agent skill "${name}" is not a valid skill name.`);
		}

		const dir = join(root, ".agents", "skills", name);
		const files: SkillFile[] = await Promise.all(
			(await listFiles(dir)).map(async (path) => ({ path, data: await readFile(join(dir, path)) })),
		);
		const skillMd = files.find((file) => file.path === "SKILL.md");
		if (!skillMd) throw new Error(`Agent skill "${name}" has no SKILL.md.`);

		const frontmatter = readFrontmatter(skillMd.data.toString("utf8"));
		if (frontmatter?.name !== name) {
			throw new Error(`${name}/SKILL.md must have "name: ${name}" in its frontmatter.`);
		}
		const description =
			typeof frontmatter.description === "string" ? frontmatter.description.trim() : "";
		if (!description || description.length > 1024) {
			throw new Error(`${name}/SKILL.md needs a description of 1 to 1024 characters.`);
		}

		// A skill that is only SKILL.md is served as is. Skills with reference
		// files are served as one archive, so relative links keep working.
		let entry: Omit<SkillEntry, "digest">;
		let artifact: Buffer;
		if (files.length === 1) {
			artifact = skillMd.data;
			entry = { name, type: "skill-md", description, url: `${URL_PATH}/${name}/SKILL.md` };
			await mkdir(join(output, name));
			await writeFile(join(output, name, "SKILL.md"), artifact);
		} else {
			artifact = createTarGz(files);
			entry = { name, type: "archive", description, url: `${URL_PATH}/${name}.tar.gz` };
			await writeFile(join(output, `${name}.tar.gz`), artifact);
		}

		skills.push({ ...entry, digest: `sha256:${createHash("sha256").update(artifact).digest("hex")}` });
	}

	await writeFile(join(output, "index.json"), `${JSON.stringify({ $schema: SCHEMA, skills }, null, "\t")}\n`);
	return skills;
}

/** Lists a skill's files as sorted, forward-slash paths, skipping dotfiles. */
async function listFiles(dir: string, base = dir): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		if (entry.name.startsWith(".")) continue;
		const path = join(dir, entry.name);
		if (entry.isSymbolicLink()) {
			throw new Error(`${relative(base, path)} in ${base} is a symlink. Skills can't contain links.`);
		}
		if (entry.isDirectory()) files.push(...(await listFiles(path, base)));
		else if (entry.isFile()) files.push(relative(base, path).split(sep).join("/"));
	}
	return files.sort();
}

function readFrontmatter(markdown: string): Record<string, unknown> | undefined {
	const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
	if (!match) return undefined;
	const data: unknown = parseYaml(match[1]);
	return data && typeof data === "object" ? (data as Record<string, unknown>) : undefined;
}

/**
 * Packs files into a gzipped ustar archive with the skill's files at the
 * root. Entries are sorted and carry fixed owners, modes and timestamps, so
 * the same files always produce the same bytes.
 */
function createTarGz(files: SkillFile[]): Buffer {
	const dirs = new Set<string>();
	for (const { path } of files) {
		const parts = path.split("/");
		for (let i = 1; i < parts.length; i++) dirs.add(`${parts.slice(0, i).join("/")}/`);
	}

	const entries: { path: string; data?: Buffer }[] = [...[...dirs].map((path) => ({ path })), ...files];
	entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

	const blocks: Buffer[] = [];
	for (const { path, data } of entries) {
		blocks.push(tarHeader(path, data));
		if (!data) continue;
		blocks.push(data);
		const padding = (512 - (data.length % 512)) % 512;
		if (padding) blocks.push(Buffer.alloc(padding));
	}
	// Two empty blocks mark the end of the archive.
	blocks.push(Buffer.alloc(1024));

	const archive = gzipSync(Buffer.concat(blocks), { level: 9 });
	// The gzip header records the build machine's OS. Mark it "unknown" so
	// macOS and Linux builds produce the same bytes.
	archive[9] = 255;
	return archive;
}

function tarHeader(path: string, data: Buffer | undefined): Buffer {
	if (Buffer.byteLength(path) > 100) {
		throw new Error(`"${path}" is longer than the 100 bytes a tar header allows.`);
	}

	const header = Buffer.alloc(512);
	header.write(path, 0, 100, "utf8");
	writeOctal(header, data ? 0o644 : 0o755, 100, 8);
	writeOctal(header, 0, 108, 8); // uid
	writeOctal(header, 0, 116, 8); // gid
	writeOctal(header, data?.length ?? 0, 124, 12);
	writeOctal(header, ARCHIVE_MTIME, 136, 12);
	header.write(data ? "0" : "5", 156, 1, "ascii"); // regular file or directory
	header.write("ustar\0" + "00", 257, 8, "ascii");

	// The checksum is computed with its own field filled with spaces.
	header.fill(" ", 148, 156);
	let checksum = 0;
	for (const byte of header) checksum += byte;
	header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
	return header;
}

function writeOctal(header: Buffer, value: number, offset: number, length: number) {
	header.write(`${value.toString(8).padStart(length - 1, "0")}\0`, offset, length, "ascii");
}
