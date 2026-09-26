import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const outputDirectory = new URL("../public/social/", import.meta.url);
const manifestUrl = new URL("./social-cards.manifest.json", import.meta.url);
const checkOnly = process.argv.includes("--check");
const digest = (value) => createHash("sha256").update(value).digest("hex");

const escapeXml = (text) =>
	text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function homeScene() {
	return `
		<rect width="450" height="340" rx="22" fill="#1b1c20"/>
		<circle cx="225" cy="170" r="145" stroke="#ffffff20" stroke-dasharray="2 9"/>
		<rect x="128" y="73" width="194" height="194" rx="28" fill="#24252b" stroke="url(#orange-mark)" stroke-width="10"/>
		<path d="M166 170h118" stroke="url(#orange-mark)" stroke-width="10" stroke-linecap="round"/>
		<g transform="rotate(-5 82 88)"><rect x="19" y="60" width="137" height="56" rx="10" fill="#2d2e34" stroke="#ffffff45"/><text x="39" y="94" fill="#f7f7f8" font-size="17" font-weight="600">Human editor</text></g>
		<g transform="rotate(5 370 255)"><rect x="321" y="230" width="112" height="54" rx="10" fill="#2d2e34" stroke="#ffffff45"/><text x="341" y="264" fill="#f7f7f8" font-size="17" font-weight="600">Agent</text></g>
		<path d="M23 170h80m244 0h81" stroke="#ff9568" stroke-width="2" stroke-dasharray="3 8"/>`;
}

function astroScene() {
	return `
		<rect width="450" height="340" rx="22" fill="#f5f4f2" stroke="#e7e6e4"/>
		<path d="M160 148h130" stroke="#bd5b31" stroke-width="2" stroke-dasharray="4 7"/>
		<g transform="rotate(-3 135 155)"><rect x="20" y="38" width="246" height="230" rx="14" fill="#fff" stroke="#deddda"/><path d="M20 80h246" stroke="#e7e6e4"/><text x="40" y="66" fill="#1b1c20" font-size="17" font-weight="700">{ }  seed.json / posts</text>
			<text x="42" y="108" fill="#64676d" font-family="monospace" font-size="13">01  {</text>
			<text x="42" y="129" fill="#bd5b31" font-family="monospace" font-size="13">02    "slug": "posts",</text>
			<text x="42" y="150" fill="#64676d" font-family="monospace" font-size="13">03    "label": "Posts",</text>
			<text x="42" y="171" fill="#64676d" font-family="monospace" font-size="13">04    "fields": [</text>
			<text x="42" y="192" fill="#bd5b31" font-family="monospace" font-size="13">05      { "slug": "title",</text>
			<text x="42" y="213" fill="#64676d" font-family="monospace" font-size="13">06        "type": "string" }</text>
			<text x="42" y="234" fill="#64676d" font-family="monospace" font-size="13">07    ]</text>
			<text x="42" y="255" fill="#64676d" font-family="monospace" font-size="13">08  }</text></g>
		<g transform="rotate(4 340 223)"><rect x="235" y="148" width="194" height="144" rx="14" fill="#fff" stroke="#deddda"/><path d="M235 188h194" stroke="#e7e6e4"/><text x="254" y="175" fill="#bd5b31" font-size="14">Astro page</text><text x="254" y="225" fill="#1b1c20" font-size="23" font-weight="700">A new chapter</text><path d="M254 248h149m-149 14h108" stroke="#d9d9d7" stroke-width="5" stroke-linecap="round"/></g>`;
}

function mediaScene() {
	return `
		<rect width="450" height="340" rx="22" fill="#f5f4f2" stroke="#e7e6e4"/>
		<rect x="19" y="26" width="412" height="287" rx="13" fill="#fff" stroke="#deddda"/><path d="M19 70h412" stroke="#e7e6e4"/>
		<text x="38" y="56" fill="#1b1c20" font-size="18" font-weight="700">Media Library</text><rect x="295" y="39" width="116" height="22" rx="5" fill="#ff6d35"/><text x="313" y="55" fill="#171717" font-size="12" font-weight="700">+ Upload Files</text>
		<rect x="37" y="86" width="286" height="30" rx="6" fill="#fafafa" stroke="#e4e3e1"/><circle cx="55" cy="100" r="6" stroke="#8a8d90"/><path d="m59 104 5 5" stroke="#8a8d90"/><text x="75" y="106" fill="#8a8d90" font-size="14">Search files...</text>
		<text x="37" y="146" fill="#1b1c20" font-size="16" font-weight="700">Folders</text><rect x="37" y="157" width="128" height="36" rx="6" fill="#fff" stroke="#e4e3e1"/><text x="50" y="180" fill="#a94b25" font-size="14">▱</text><text x="74" y="181" fill="#1b1c20" font-size="14" font-weight="600">Campaign</text><rect x="174" y="157" width="115" height="36" rx="6" fill="#fff" stroke="#e4e3e1"/><text x="188" y="181" fill="#1b1c20" font-size="14">Editorial</text>
		<text x="37" y="225" fill="#1b1c20" font-size="16" font-weight="700">Files</text><g><rect x="37" y="236" width="122" height="61" rx="6" fill="#e8ddd0"/><circle cx="135" cy="251" r="9" fill="#ff7840"/><path d="M37 288 77 251l28 25 18-17 36 37H37Z" fill="#687767"/></g><g><rect x="170" y="236" width="122" height="61" rx="6" fill="#d9d9c7"/><path d="M182 280h98v17h-98Z" fill="#314635"/><circle cx="263" cy="253" r="12" fill="#ff7840"/></g>
		<g transform="rotate(4 352 236)"><rect x="300" y="192" width="124" height="105" rx="10" fill="#fff" stroke="#e4e3e1"/><text x="312" y="215" fill="#1b1c20" font-size="12" font-weight="700">landscape.jpg</text><rect x="312" y="228" width="100" height="42" rx="4" fill="#e8ddd0"/><path d="M312 266 342 238l24 20 18-14 28 26H312Z" fill="#687767"/><text x="312" y="286" fill="#a94b25" font-size="10">ALT TEXT</text></g>`;
}

function agentsScene() {
	return `
		<rect width="450" height="340" rx="22" fill="#1b1c20"/>
		<path d="M136 138h61m117 66h53" stroke="#ff9568" stroke-width="2" stroke-dasharray="4 8"/>
		<g transform="rotate(-3 116 100)"><rect x="25" y="42" width="224" height="116" rx="12" fill="#2a2b31" stroke="#ffffff30"/><text x="43" y="70" fill="#ff9568" font-size="15">✳  Agent via MCP</text><text x="43" y="105" fill="#f7f7f8" font-size="17" font-weight="600">Create a draft in Posts</text><text x="43" y="132" fill="#b9bbbf" font-size="13">Keep it unpublished</text></g>
		<g transform="rotate(3 292 199)"><rect x="181" y="126" width="242" height="161" rx="13" fill="#f9f9f8" stroke="#e5e4e2"/><text x="201" y="153" fill="#a94b25" font-size="14">EMDASH / POSTS</text><text x="378" y="153" fill="#a94b25" font-size="13">Draft</text><text x="201" y="194" fill="#1b1c20" font-size="22" font-weight="700">A new chapter</text><path d="M201 216h185m-185 15h146" stroke="#d9d9d7" stroke-width="5" stroke-linecap="round"/><text x="201" y="263" fill="#65676b" font-size="14">Editor review next →</text></g>
		<g transform="rotate(-4 114 260)"><rect x="28" y="233" width="169" height="75" rx="10" fill="#2a2b31" stroke="#ffffff30"/><text x="45" y="261" fill="#ff9568" font-size="13">◎  Human editor</text><text x="45" y="286" fill="#f7f7f8" font-size="15" font-weight="600">Review and publish</text></g>`;
}

const cards = [
	{
		name: "home",
		kicker: "A CMS FOR HUMANS + AGENTS",
		lines: ["A CMS for humans", "and agents"],
		description: ["Code the site. Edit content.", "Let agents help."],
		scene: homeScene(),
	},
	{
		name: "astro-cms",
		kicker: "ASTRO-NATIVE CMS",
		lines: ["Build in Astro.", "Edit in EmDash."],
		description: ["Your routes and design stay in Astro.", "Content gets a real editor."],
		scene: astroScene(),
	},
	{
		name: "media-library",
		kicker: "MEDIA LIBRARY",
		lines: ["A media library", "for the whole story."],
		description: ["Organize, describe, and trace assets", "alongside the content that uses them."],
		scene: mediaScene(),
		fontSize: 56,
	},
	{
		name: "for-agents",
		kicker: "A CMS FOR AGENTS",
		lines: ["Let agents work.", "Keep the content", "yours."],
		description: ["Give authorized agents content tools.", "Keep review and publishing in your hands."],
		scene: agentsScene(),
		fontSize: 56,
	},
];

function renderCard(card) {
	const fontSize = card.fontSize ?? 62;
	const firstTitlePosition = card.lines.length === 3 ? 247 : 263;
	const titleLines = card.lines
		.map((line, lineIndex) => `<text x="80" y="${firstTitlePosition + lineIndex * 72}" fill="#1b1c20" font-size="${fontSize}" font-weight="700" letter-spacing="-2.8">${escapeXml(line)}</text>`)
		.join("");
	const descriptionLines = card.description
		.map((line, lineIndex) => `<text x="80" y="${447 + lineIndex * 31}" fill="#5d6166" font-size="22">${escapeXml(line)}</text>`)
		.join("");

	return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" fill="none" font-family="Inter, Arial, sans-serif">
		<title>${escapeXml(card.lines.join(" "))} — EmDash</title>
		<defs><linearGradient id="orange-mark" x1="0%" y1="100%" x2="100%" y2="0%"><stop stop-color="#ff5e1f"/><stop offset="0.6" stop-color="#ffae58"/><stop offset="1" stop-color="#fff2e3"/></linearGradient></defs>
		<rect width="1200" height="630" fill="#f7f7f6"/>
		<rect x="28" y="28" width="1144" height="574" rx="28" fill="#fff" stroke="#e4e4e1" stroke-width="2"/>
		<rect x="80" y="72" width="34" height="34" rx="6" stroke="#ff7a42" stroke-width="3"/><path d="M88 89h18" stroke="#ff7a42" stroke-width="3" stroke-linecap="round"/>
		<text x="128" y="100" fill="#1b1c20" font-size="28" font-weight="700" letter-spacing="-1">EmDash</text>
		<text x="80" y="185" fill="#a94b25" font-family="monospace" font-size="16" font-weight="700" letter-spacing="1.2">${escapeXml(card.kicker)}</text>
		${titleLines}${descriptionLines}
		<g transform="translate(690 162)">${card.scene}</g>
		<path d="M80 530h1040" stroke="#e8e8e5" stroke-width="2"/>
		<text x="80" y="566" fill="#6f7377" font-family="monospace" font-size="17">emdashcms.com</text>
		<text x="1120" y="566" fill="#a94b25" font-family="monospace" font-size="17" text-anchor="end">${escapeXml(card.name === "home" ? "OPEN SOURCE CMS" : card.kicker)}</text>
	</svg>`;
}

if (!checkOnly) await mkdir(outputDirectory, { recursive: true });

const assetHashes = {};

for (const card of cards) {
	const svg = renderCard(card);
	const svgUrl = new URL(`${card.name}.svg`, outputDirectory);
	const pngUrl = new URL(`${card.name}.png`, outputDirectory);
	let png;

	if (checkOnly) {
		const storedSvg = await readFile(svgUrl);
		if (!storedSvg.equals(Buffer.from(svg))) throw new Error(`${card.name}.svg is out of date; run pnpm generate:social`);
		png = await readFile(pngUrl);
	} else {
		png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
		await writeFile(svgUrl, svg);
		await writeFile(pngUrl, png);
	}

	const metadata = await sharp(png).metadata();
	if (metadata.format !== "png" || metadata.width !== 1200 || metadata.height !== 630) throw new Error(`${card.name}.png must be 1200x630`);
	assetHashes[card.name] = { svg: digest(svg), png: digest(png) };
}

const manifest = {
	generator: digest(await readFile(fileURLToPath(import.meta.url))),
	cards: assetHashes,
};

if (checkOnly) {
	const recordedManifest = JSON.parse(await readFile(manifestUrl, "utf8"));
	if (JSON.stringify(recordedManifest) !== JSON.stringify(manifest)) throw new Error("Social card assets are out of date; run pnpm generate:social");
} else {
	await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
}
