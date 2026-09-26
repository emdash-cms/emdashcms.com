import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = ({ url }) => Response.redirect(new URL("/sitemap.xml", url), 301);
