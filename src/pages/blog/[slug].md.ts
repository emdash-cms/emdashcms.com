import type { APIRoute } from "astro";
import { decodeSlug, getEmDashEntry } from "emdash";
import { markdownResponse, postMarkdown } from "../../lib/markdown";

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

	const { entry: post, cacheHint } = slug ? await getEmDashEntry("posts", slug) : { entry: null, cacheHint: null };
	if (!post) {
		return new Response("Not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
	}

	if (cache?.enabled && cacheHint) cache.set(cacheHint);

	return markdownResponse(
		postMarkdown(post, siteUrl),
		new URL(`/blog/${encodeURIComponent(post.id)}`, siteUrl).href,
	);
};
