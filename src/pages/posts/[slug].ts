import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = ({ params, redirect, url }) => {
	if (!params.slug) return redirect("/blog", 301);

	const destination = `/blog/${encodeURIComponent(params.slug)}${url.search}`;
	return redirect(destination, url.searchParams.has("_preview") ? 307 : 301);
};
