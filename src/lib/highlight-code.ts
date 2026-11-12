import astro from "@shikijs/langs/astro";
import css from "@shikijs/langs/css";
import diff from "@shikijs/langs/diff";
import html from "@shikijs/langs/html";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import jsonc from "@shikijs/langs/jsonc";
import jsx from "@shikijs/langs/jsx";
import markdown from "@shikijs/langs/markdown";
import shellscript from "@shikijs/langs/shellscript";
import sql from "@shikijs/langs/sql";
import toml from "@shikijs/langs/toml";
import tsx from "@shikijs/langs/tsx";
import typescript from "@shikijs/langs/typescript";
import yaml from "@shikijs/langs/yaml";
import githubLight from "@shikijs/themes/github-light";
import vesper from "@shikijs/themes/vesper";
import { createHighlighterCore } from "shiki/core";
// Shiki's default Oniguruma engine is WebAssembly, which Workers can't compile at runtime.
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

const PLAINTEXT = "text";

// Names Shiki's grammars don't alias themselves.
const LANGUAGE_ALIASES: Record<string, string> = {
	console: "shellscript",
	terminal: "shellscript",
	txt: PLAINTEXT,
};

let highlighterPromise: ReturnType<typeof createHighlighterCore> | undefined;

function getHighlighter() {
	highlighterPromise ??= createHighlighterCore({
		themes: [githubLight, vesper],
		langs: [astro, css, diff, html, javascript, json, jsonc, jsx, markdown, shellscript, sql, toml, tsx, typescript, yaml],
		// Skip a grammar regex the JS engine can't compile instead of failing the whole block.
		engine: createJavaScriptRegexEngine({ forgiving: true }),
	});
	return highlighterPromise;
}

function resolveLanguage(loaded: string[], language: string | undefined): string {
	const normalized = language?.trim().toLowerCase();
	if (!normalized) return PLAINTEXT;
	const mapped = LANGUAGE_ALIASES[normalized] ?? normalized;
	return loaded.includes(mapped) ? mapped : PLAINTEXT;
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

/**
 * A `<pre class="shiki">` whose tokens carry `--shiki-light` and `--shiki-dark`
 * custom properties. The post stylesheet picks one per color scheme. Shiki
 * escapes the source, so the result is safe for `set:html`.
 */
export async function highlightCode(code: string, language: string | undefined): Promise<string> {
	try {
		const highlighter = await getHighlighter();
		return highlighter.codeToHtml(code, {
			lang: resolveLanguage(highlighter.getLoadedLanguages(), language),
			themes: { light: "github-light", dark: "vesper" },
			defaultColor: false,
		});
	} catch (error) {
		console.error("Code highlighting failed:", error);
		return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
	}
}
