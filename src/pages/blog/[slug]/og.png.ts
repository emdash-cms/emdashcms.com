/**
 * A post's share image: its halftone cover art as a PNG. The post page
 * points og:image here when the post has no featured image.
 */
import type { APIRoute } from "astro";
import { decodeSlug, getEmDashEntry } from "emdash";
import { postArtPng } from "../../../lib/post-art-png";

export const GET: APIRoute = async ({ params, cache }) => {
	let slug: string | undefined;
	try {
		slug = decodeSlug(params.slug);
	} catch {
		slug = undefined;
	}
	if (!slug) return new Response("Not found", { status: 404 });

	// Only published posts get an image, so the route can't be used to render arbitrary slugs.
	const { entry: post, error, cacheHint } = await getEmDashEntry("posts", slug);
	if (!post) {
		// A missing post is reported as an error too; only other errors are failures.
		if (error && error.name !== "LiveEntryNotFoundError") {
			console.error("Failed to load post for share image:", error);
			return new Response("Could not load the post", { status: 500 });
		}
		return new Response("Not found", { status: 404 });
	}

	if (cache?.enabled) cache.set(cacheHint);

	// Seed with the entry's slug, as the page's cover does, so the two always match.
	const png = await postArtPng(post.id);
	return new Response(png, {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "public, max-age=86400",
		},
	});
};
