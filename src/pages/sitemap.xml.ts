import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";

export const prerender = false;

const staticPaths = ["/", "/blog", "/astro-cms", "/media-library", "/for-agents"];

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

export const GET: APIRoute = async ({ site, cache, locals }) => {
	const db = locals.emdash?.db;
	if (!db) return new Response("Sitemap unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
	const siteUrl = site ?? new URL("https://emdashcms.com/");
	const locations = new Set(staticPaths.map((path) => new URL(path, siteUrl).href));
	let cursor: string | undefined;
	let firstPage = true;

	try {
		do {
			const result = await getEmDashCollection("posts", {
				status: "published",
				limit: 100,
				cursor,
				orderBy: { published_at: "desc" },
			});
			if (result.error) throw result.error;
			if (firstPage && cache?.enabled) cache.set(result.cacheHint);

			const ids = result.entries.map((post) => post.data.id);
			const seoRows = ids.length > 0
				? await db.selectFrom("_emdash_seo")
						.select(["content_id", "seo_no_index", "seo_canonical"])
						.where("collection", "=", "posts")
						.where("content_id", "in", ids)
						.execute()
				: [];
			const seoById = new Map(seoRows.map((row) => [row.content_id, row]));
			for (const post of result.entries) {
				const seo = seoById.get(post.data.id);
				if (seo?.seo_no_index === 1) continue;
				const location = new URL(`/blog/${encodeURIComponent(post.id)}`, siteUrl).href;
				if (seo?.seo_canonical) {
					try {
						if (new URL(seo.seo_canonical, siteUrl).href !== location) continue;
					} catch {
						continue;
					}
				}
				locations.add(location);
			}
			if (result.nextCursor && result.nextCursor === cursor) throw new Error("Sitemap pagination did not advance");
			cursor = result.nextCursor;
			firstPage = false;
		} while (cursor);
	} catch (error) {
		console.error("Unable to generate sitemap:", error);
		return new Response("Sitemap unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
	}

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
