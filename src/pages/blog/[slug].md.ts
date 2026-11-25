import type { APIRoute } from "astro";
import { decodeSlug, getEmDashEntry, getSeoMeta } from "emdash";
import { isStaging, markdownResponse, postMarkdown, unavailableResponse } from "../../lib/markdown";

export const prerender = false;

/** A blog post as Markdown, for agents. See src/lib/markdown.ts. */
export const GET: APIRoute = async ({ cache, params, site, url }) => {
	const siteUrl = site ?? new URL(url.origin);
	let slug: string | undefined;
	try {
		slug = decodeSlug(params.slug);
	} catch {
		// A malformed escape such as `/blog/%25.md` can't name a post.
		slug = undefined;
	}

	const result = slug ? await getEmDashEntry("posts", slug) : null;
	if (result?.error) {
		console.error(`Failed to load post ${slug}:`, result.error);
		return unavailableResponse();
	}
	const post = result?.entry;
	if (!post) {
		return new Response("Not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
	}

	if (cache?.enabled) cache.set(result.cacheHint);

	const path = `/blog/${encodeURIComponent(post.id)}`;
	const seo = getSeoMeta(post, { siteUrl: siteUrl.origin, path });
	const canonical = seo.canonical ?? new URL(path, siteUrl).href;

	return markdownResponse(postMarkdown(post, siteUrl, canonical), {
		canonical,
		noindex: Boolean(seo.robots) || (await isStaging()),
	});
};
