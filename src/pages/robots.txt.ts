import type { APIRoute } from "astro";

export const prerender = false;

const robots = [
	"User-agent: *",
	"Content-Signal: search=yes, ai-input=yes, ai-train=yes",
	"Allow: /_emdash/api/media/file/",
	"Disallow: /_emdash/",
	"",
	"Sitemap: https://emdashcms.com/sitemap.xml",
	"",
].join("\n");

export const GET: APIRoute = () =>
	new Response(robots, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
