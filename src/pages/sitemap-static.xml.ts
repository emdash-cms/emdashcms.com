import type { APIRoute } from "astro";

export const prerender = false;

const routes = ["/", "/blog", "/blog/tags"];

export const GET: APIRoute = ({ site }) => {
	const siteUrl = site ?? new URL("https://emdashcms.com/");
	const locations = routes.map((route) => new URL(route, siteUrl).href);
	const xml = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...locations.map((location) => `  <url><loc>${location}</loc></url>`),
		"</urlset>",
	].join("\n");

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};
