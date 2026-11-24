import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";
import { markdownResponse, showcaseMarkdown } from "../lib/markdown";
import { toShowcaseSite, type ShowcaseSite } from "../lib/showcase";

export const prerender = false;

/** The showcase as Markdown, for agents. See src/lib/markdown.ts. */
export const GET: APIRoute = async ({ cache, site, url }) => {
	const siteUrl = site ?? new URL(url.origin);
	const { entries, error, cacheHint } = await getEmDashCollection("showcase", {
		orderBy: { published_at: "desc" },
	});

	if (error) console.error("Failed to load showcase sites:", error);
	if (cache?.enabled) cache.set(cacheHint);

	const sites = error ? [] : entries.map(toShowcaseSite).filter((item): item is ShowcaseSite => item !== null);

	return markdownResponse(showcaseMarkdown(sites, siteUrl), new URL("/showcase", siteUrl).href);
};
