function escapeXml(value) {
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

export function renderSitemap(entries) {
	const urls = entries.map(({ location, lastmod, image }) => [
		"  <url>",
		`    <loc>${escapeXml(location)}</loc>`,
		lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : null,
		image ? `    <image:image><image:loc>${escapeXml(image)}</image:loc></image:image>` : null,
		"  </url>",
	].filter(Boolean).join("\n"));
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
		...urls,
		"</urlset>",
	].join("\n");
}
