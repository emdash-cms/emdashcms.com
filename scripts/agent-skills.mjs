#!/usr/bin/env node
/**
 * Publishes EmDash's agent skills at /.well-known/agent-skills/, following the
 * Agent Skills Discovery RFC v0.2.0:
 * https://github.com/cloudflare/agent-skills-discovery-rfc
 *
 * Run it with `pnpm agent-skills`. Workers Builds runs it before `pnpm build`,
 * so ordinary local builds and dev servers skip it.
 *
 * The skills are the copies pinned in skills-lock.json and installed in
 * .agents/skills/, so the site publishes exactly the files reviewed in this
 * repository. Only skills installed from emdash-cms/skills are published;
 * skills written for this repository stay private.
 *
 * It writes the index and the skill files to public/.well-known/agent-skills/
 * (gitignored). Astro copies them into the build, and they are served as
 * static assets, which handle ETag, HEAD and 404 responses.
 */

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { parse as parseYaml } from "yaml";

const SCHEMA = "https://schemas.agentskills.io/discovery/0.2.0/schema.json";
const PUBLISHED_SOURCE = "emdash-cms/skills";
const URL_PATH = "/.well-known/agent-skills";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUTPUT = join(ROOT, "public", ".well-known", "agent-skills");

// Agent Skills names: 1-64 lowercase letters, digits and single hyphens.
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// A fixed timestamp keeps the tar contents the same for the same files, so
// digests only change when a skill does. npm uses the same date when packing.
const ARCHIVE_MTIME = Date.UTC(1985, 9, 26, 8, 15) / 1000;

const skills = await publishSkills();
console.log(`Published ${skills.length} agent skills at ${URL_PATH}/`);

/**
 * @typedef {{ path: string, data: Buffer }} SkillFile
 * @typedef {{ name: string, type: "skill-md" | "archive", description: string, url: string, digest: string }} SkillEntry
 */

/** @returns {Promise<SkillEntry[]>} */
async function publishSkills() {
	/** @type {{ skills: Record<string, { source: string }> }} */
	const lock = JSON.parse(await readFile(join(ROOT, "skills-lock.json"), "utf8"));
	const names = Object.entries(lock.skills)
		.filter(([, skill]) => skill.source === PUBLISHED_SOURCE)
		.map(([name]) => name)
		.sort();

	await rm(OUTPUT, { recursive: true, force: true });
	await mkdir(OUTPUT, { recursive: true });

	/** @type {SkillEntry[]} */
	const entries = [];
	for (const name of names) {
		if (name.length > 64 || !NAME_PATTERN.test(name)) {
			throw new Error(`Agent skill "${name}" is not a valid skill name.`);
		}

		const dir = join(ROOT, ".agents", "skills", name);
		/** @type {SkillFile[]} */
		const files = await Promise.all(
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
		let type, url, artifact;
		if (files.length === 1) {
			type = "skill-md";
			url = `${URL_PATH}/${name}/SKILL.md`;
			artifact = skillMd.data;
			await mkdir(join(OUTPUT, name));
			await writeFile(join(OUTPUT, name, "SKILL.md"), artifact);
		} else {
			type = "archive";
			url = `${URL_PATH}/${name}.tar.gz`;
			artifact = createTarGz(files);
			await writeFile(join(OUTPUT, `${name}.tar.gz`), artifact);
		}

		const digest = `sha256:${createHash("sha256").update(artifact).digest("hex")}`;
		entries.push({ name, type, description, url, digest });
	}

	const index = JSON.stringify({ $schema: SCHEMA, skills: entries }, null, "\t");
	await writeFile(join(OUTPUT, "index.json"), `${index}\n`);
	return entries;
}

/**
 * Lists a skill's files as sorted, forward-slash paths, skipping dotfiles.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function listFiles(dir, base = dir) {
	/** @type {string[]} */
	const files = [];
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

/**
 * @param {string} markdown
 * @returns {Record<string, unknown> | undefined}
 */
function readFrontmatter(markdown) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
	if (!match) return undefined;
	const data = parseYaml(match[1]);
	return data && typeof data === "object" ? data : undefined;
}

/**
 * Packs files into a gzipped ustar archive with the skill's files at the
 * root. Entries are sorted and carry fixed owners, modes and timestamps, so
 * the same files always produce the same tar. The gzip bytes can still differ
 * between machines, because Node's zlib output varies by platform. That is
 * fine: the index's digests come from the bytes written in the same run.
 * @param {SkillFile[]} files
 */
function createTarGz(files) {
	const dirs = new Set();
	for (const { path } of files) {
		const parts = path.split("/");
		for (let i = 1; i < parts.length; i++) dirs.add(`${parts.slice(0, i).join("/")}/`);
	}

	/** @type {{ path: string, data?: Buffer }[]} */
	const entries = [...[...dirs].map((path) => ({ path })), ...files];
	entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

	/** @type {Buffer[]} */
	const blocks = [];
	for (const { path, data } of entries) {
		blocks.push(tarHeader(path, data));
		if (!data) continue;
		blocks.push(data);
		const padding = (512 - (data.length % 512)) % 512;
		if (padding) blocks.push(Buffer.alloc(padding));
	}
	// Two empty blocks mark the end of the archive.
	blocks.push(Buffer.alloc(1024));

	return gzipSync(Buffer.concat(blocks), { level: 9 });
}

/**
 * @param {string} path
 * @param {Buffer | undefined} data A file's contents, or undefined for a directory.
 */
function tarHeader(path, data) {
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

/**
 * @param {Buffer} header
 * @param {number} value
 * @param {number} offset
 * @param {number} length
 */
function writeOctal(header, value, offset, length) {
	header.write(`${value.toString(8).padStart(length - 1, "0")}\0`, offset, length, "ascii");
}
