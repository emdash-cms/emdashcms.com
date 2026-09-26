import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";

export const prerender = false;

const staticPaths = ["/", "/blog", "/media-library", "/for-agents"];

function escapeXml(value: string) {
	return value.replace(/[&<>"']/g, (character) => {
		switch (character) {
			case "&": return "&amp;";
			case "<": return "&lt;";
			case ">": return "&gt;";
			case '"': return "&quot;";
			default: return "&apos;";
		}
	});
}

export const GET: APIRoute = async ({ site, cache }) => {
	const siteUrl = site ?? new URL("https://emdashcms.com/");
	const locations = new Set(staticPaths.map((path) => new URL(path, siteUrl).href));
	let cursor: string | undefined;
	let firstPage = true;

	do {
		const result = await getEmDashCollection("posts", {
			status: "published",
			limit: 100,
			cursor,
			orderBy: { published_at: "desc" },
		});
		if (result.error) {
			console.error("Unable to generate sitemap:", result.error);
			return new Response("Sitemap unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
		}
		if (firstPage && cache?.enabled) cache.set(result.cacheHint);
		for (const post of result.entries) {
			locations.add(new URL(`/blog/${encodeURIComponent(post.id)}`, siteUrl).href);
		}
		if (result.nextCursor && result.nextCursor === cursor) {
			return new Response("Sitemap pagination failed", { status: 503, headers: { "Cache-Control": "no-store" } });
		}
		cursor = result.nextCursor;
		firstPage = false;
	} while (cursor);

	const xml = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...[...locations].map((location) => `  <url><loc>${escapeXml(location)}</loc></url>`),
		"</urlset>",
	].join("\n");

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=300",
		},
	});
};
