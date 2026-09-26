import { readFile } from "node:fs/promises";
import { EmDashClient } from "emdash/client";
import { planHomeContent } from "./home-content-plan.mjs";

function parseArgs(args) {
	const options = {};
	for (let index = 0; index < args.length; index++) {
		const argument = args[index];
		if (argument === "--url") {
			const value = args[++index];
			if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
			options[argument.slice(2)] = value;
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}
	if (!options.url) throw new Error("Pass --url for the EmDash site to inspect");
	return options;
}

function connectionHeaders() {
	const headers = new Headers();
	for (const line of (process.env.EMDASH_HEADERS ?? "").split("\n")) {
		if (!line.trim()) continue;
		const separator = line.indexOf(":");
		if (separator < 1) throw new Error("EMDASH_HEADERS must contain one Name: Value header per line");
		headers.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
	}
	return headers;
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const site = new URL(options.url);
	if (!["http:", "https:"].includes(site.protocol) || site.pathname !== "/" || site.search || site.hash || site.username || site.password) throw new Error("--url must be an HTTP(S) site origin without a path, query, or credentials");
	const headers = connectionHeaders();
	const hasCustomHeaders = [...headers].length > 0;
	const token = process.env.EMDASH_TOKEN;
	const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(site.hostname);
	if (!isLocal && site.protocol !== "https:") throw new Error("Remote sites require HTTPS before sending credentials");
	if (!isLocal && !token) throw new Error("Remote sites require EMDASH_TOKEN; Access headers alone do not authenticate EmDash");
	if (!isLocal && headers.has("Cookie")) throw new Error("Cookie headers are only supported for localhost rehearsal");
	if (!token && !hasCustomHeaders) throw new Error("Set EMDASH_TOKEN and any required EMDASH_HEADERS before reading site content");
	const interceptors = hasCustomHeaders
		? [(request, next) => {
			const merged = new Headers(request.headers);
			for (const [name, value] of headers) merged.set(name, value);
			return next(new Request(request, { headers: merged }));
		}]
		: [];
	const client = new EmDashClient({ baseUrl: site.origin, token, interceptors });
	const seed = JSON.parse(await readFile(new URL("../seed/seed.json", import.meta.url), "utf8"));
	const seedHomes = seed.content?.pages?.filter((entry) => entry.slug === "home") ?? [];
	if (seedHomes.length !== 1) throw new Error("Expected exactly one Home page in the seed");
	const comparison = await client.compare("pages", "home");
	if (comparison.hasChanges || comparison.draft) throw new Error("Home already has an unpublished draft; review it before planning another update");
	const current = await client.get("pages", "home", { raw: true });
	const plan = planHomeContent(current, seedHomes[0]);
	console.log(JSON.stringify({
		entryId: plan.entryId,
		revision: plan.revision,
		planHash: plan.planHash,
		heroHash: plan.heroHash,
		preservedBlocks: plan.preservedBlocks,
		changes: plan.changes,
	}, null, 2));

	console.error(plan.changes.length === 0 ? "Home marketing content is already aligned." : "Read-only plan. Review the diff and make the approved changes in the Home editor.");
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : "Home content planning failed");
	process.exitCode = 1;
});
