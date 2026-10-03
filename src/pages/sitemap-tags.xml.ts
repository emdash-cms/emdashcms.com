import type { APIRoute } from "astro";
import { getTaxonomyTermsWithCacheHint } from "emdash";

export const prerender = false;

export const GET: APIRoute = async ({ cache, site, url }) => {
	const siteUrl = site ?? new URL(url.origin);
	const { data: tags, cacheHint } = await getTaxonomyTermsWithCacheHint("tag", {
		includeCounts: false,
	});

	if (cache?.enabled) cache.set(cacheHint);

	const locations = tags.map(
		(tag) => new URL(`/blog/tag/${encodeURIComponent(tag.slug)}`, siteUrl).href,
	);
	const xml = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...locations.map((location) => `  <url><loc>${location}</loc></url>`),
		"</urlset>",
	].join("\n");

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
		},
	});
};
