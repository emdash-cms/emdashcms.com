import handler from "@astrojs/cloudflare/entrypoints/server";

export { PluginBridge } from "@emdash-cms/cloudflare/sandbox";

const CANONICAL_HOST = "emdashcms.com";
const WWW_HOST = "www.emdashcms.com";
const BETA_HOST = "beta.emdashcms.com";
const PRODUCTION_HOSTS = new Set([CANONICAL_HOST, WWW_HOST, BETA_HOST]);

function isEmDashPath(pathname: string) {
	return pathname === "/_emdash" || pathname.startsWith("/_emdash/");
}

export default {
	async fetch(request, env, context) {
		const url = new URL(request.url);

		// Only redirect production hosts so local dev (http://localhost) still works.
		if (PRODUCTION_HOSTS.has(url.hostname)) {
			const isPublicBetaPage = url.hostname === BETA_HOST && !isEmDashPath(url.pathname);
			const shouldUseCanonicalHost = url.hostname === WWW_HOST || isPublicBetaPage;
			const shouldUseHttps = url.protocol !== "https:";

			if (shouldUseCanonicalHost || shouldUseHttps) {
				if (shouldUseCanonicalHost) url.hostname = CANONICAL_HOST;
				url.protocol = "https:";
				return Response.redirect(url, 308);
			}
		}

		return handler.fetch(request, env, context);
	},
} satisfies ExportedHandler<Env>;
