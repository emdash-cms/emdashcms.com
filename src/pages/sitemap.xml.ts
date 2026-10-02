import type { APIRoute } from "astro";

export const prerender = false;

const sitemapPaths = ["/sitemap-static.xml", "/sitemap-posts.xml", "/sitemap-tags.xml"];

export const GET: APIRoute = ({ site }) => {
	const siteUrl = site ?? new URL("https://emdashcms.com/");
	const locations = sitemapPaths.map((path) => new URL(path, siteUrl).href);
	const xml = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...locations.map((location) => `  <sitemap><loc>${location}</loc></sitemap>`),
		"</sitemapindex>",
	].join("\n");

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};
