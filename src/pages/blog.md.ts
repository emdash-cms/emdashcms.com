import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";
import { blogMarkdown, isStaging, markdownResponse, unavailableResponse } from "../lib/markdown";

export const prerender = false;

/** The blog index as Markdown, for agents. See src/lib/markdown.ts. */
export const GET: APIRoute = async ({ cache, site, url }) => {
	const siteUrl = site ?? new URL(url.origin);
	const { entries: posts, error, cacheHint } = await getEmDashCollection("posts", {
		orderBy: { published_at: "desc" },
	});

	if (error) {
		console.error("Failed to load blog posts:", error);
		return unavailableResponse();
	}
	if (cache?.enabled) cache.set(cacheHint);

	const sorted = posts.toSorted(
		(a, b) => (b.data.publishedAt?.getTime() ?? 0) - (a.data.publishedAt?.getTime() ?? 0),
	);

	return markdownResponse(blogMarkdown(sorted, siteUrl), {
		canonical: new URL("/blog", siteUrl).href,
		noindex: await isStaging(),
	});
};
