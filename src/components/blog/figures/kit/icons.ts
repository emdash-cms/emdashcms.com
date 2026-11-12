/**
 * The Phosphor icons the figures draw (regular weight, as in EmDash's admin),
 * inlined so figures need no icon build step. viewBox 0 0 256 256.
 */

const PATHS = {
	pause:
		"M216 48v160a16 16 0 0 1-16 16h-40a16 16 0 0 1-16-16V48a16 16 0 0 1 16-16h40a16 16 0 0 1 16 16M96 32H56a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h40a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16",
	play: "M240 128a15.74 15.74 0 0 1-7.6 13.51L88.32 229.65a16 16 0 0 1-16.2.3A15.86 15.86 0 0 1 64 216.13V39.87a15.86 15.86 0 0 1 8.12-13.82a16 16 0 0 1 16.2.3l144.08 88.14A15.74 15.74 0 0 1 240 128",
	replay:
		"M224 128a96 96 0 0 1-94.71 96H128a95.38 95.38 0 0 1-65.9-26.2a8 8 0 0 1 11-11.63a80 80 0 1 0-1.67-114.78a3 3 0 0 1-.26.25L44.59 96H72a8 8 0 0 1 0 16H24a8 8 0 0 1-8-8V56a8 8 0 0 1 16 0v29.8L60.25 60A96 96 0 0 1 224 128",
	check: "m229.66 77.66l-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69L218.34 66.34a8 8 0 0 1 11.32 11.32",
	floppy:
		"M219.31 72L184 36.69A15.86 15.86 0 0 0 172.69 32H48a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V83.31A15.86 15.86 0 0 0 219.31 72M168 208H88v-56h80Zm40 0h-24v-56a16 16 0 0 0-16-16H88a16 16 0 0 0-16 16v56H48V48h124.69L208 83.31ZM160 72a8 8 0 0 1-8 8H96a8 8 0 0 1 0-16h56a8 8 0 0 1 8 8",
	cloudSlash:
		"M53.92 34.62a8 8 0 1 0-11.84 10.76l39.24 43.17l-.06.12A65 65 0 0 0 72 88a64 64 0 0 0 0 128h88a87.3 87.3 0 0 0 31.8-5.93l10.28 11.31a8 8 0 1 0 11.84-10.76ZM160 200H72a48 48 0 0 1 0-96c1.1 0 2.2 0 3.3.12A88.4 88.4 0 0 0 72 128a8 8 0 0 0 16 0a72.3 72.3 0 0 1 5.06-26.54l87 95.7A71.7 71.7 0 0 1 160 200m88-72a87.9 87.9 0 0 1-22.35 58.61A8 8 0 0 1 213.71 176a72 72 0 0 0-96.34-106a8 8 0 0 1-9.48-12.89A88 88 0 0 1 248 128",
	spinner:
		"M232 128a104 104 0 0 1-208 0c0-41 23.81-78.36 60.66-95.27a8 8 0 0 1 6.68 14.54C60.15 61.59 40 93.27 40 128a88 88 0 0 0 176 0c0-34.73-20.15-66.41-51.34-80.73a8 8 0 0 1 6.68-14.54C208.19 49.64 232 87 232 128",
	checkCircle:
		"M173.66 98.34a8 8 0 0 1 0 11.32l-56 56a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L112 148.69l50.34-50.35a8 8 0 0 1 11.32 0M232 128A104 104 0 1 1 128 24a104.11 104.11 0 0 1 104 104m-16 0a88 88 0 1 0-88 88a88.1 88.1 0 0 0 88-88",
	xCircle:
		"M165.66 101.66L139.31 128l26.35 26.34a8 8 0 0 1-11.32 11.32L128 139.31l-26.34 26.35a8 8 0 0 1-11.32-11.32L116.69 128l-26.35-26.34a8 8 0 0 1 11.32-11.32L128 116.69l26.34-26.35a8 8 0 0 1 11.32 11.32M232 128A104 104 0 1 1 128 24a104.11 104.11 0 0 1 104 104m-16 0a88 88 0 1 0-88 88a88.1 88.1 0 0 0 88-88",
	arrowLeft: "M224 128a8 8 0 0 1-8 8H59.31l58.35 58.34a8 8 0 0 1-11.32 11.32l-72-72a8 8 0 0 1 0-11.32l72-72a8 8 0 0 1 11.32 11.32L59.31 120H216a8 8 0 0 1 8 8",
	lock: "M208 80h-32V56a48 48 0 0 0-96 0v24H48a16 16 0 0 0-16 16v112a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V96a16 16 0 0 0-16-16M96 56a32 32 0 0 1 64 0v24H96Zm112 152H48V96h160z",
	upload:
		"M224 144v64a8 8 0 0 1-8 8H40a8 8 0 0 1-8-8v-64a8 8 0 0 1 16 0v56h160v-56a8 8 0 0 1 16 0M93.66 77.66L120 51.31V144a8 8 0 0 0 16 0V51.31l26.34 26.35a8 8 0 0 0 11.32-11.32l-40-40a8 8 0 0 0-11.32 0l-40 40a8 8 0 0 0 11.32 11.32",
} as const;

export type IconName = keyof typeof PATHS;

/** An inline icon, `size` px square, coloured by currentColor. */
export function icon(name: IconName, size = 16, className = "fig-icon") {
	return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 256 256" aria-hidden="true" focusable="false"><path fill="currentColor" d="${PATHS[name]}"/></svg>`;
}

let marks = 0;

/** The EmDash mark (public/brand/favicon.svg) with gradient ids unique on the page. */
export function emdashMark(size = 20) {
	const id = `fig-mark${marks++}`;
	return `<svg class="fig-mark" width="${size}" height="${size}" viewBox="0 0 75 75" fill="none" aria-hidden="true" focusable="false"><rect x="3" y="3" width="69" height="69" rx="10.518" stroke="url(#${id}b)" stroke-width="6"/><rect x="18" y="34" width="39.3661" height="6.56101" fill="url(#${id}d)"/><defs><linearGradient id="${id}b" x1="-42.9996" y1="124" x2="92.4233" y2="-41.7456" gradientUnits="userSpaceOnUse"><stop stop-color="#0F006B"/><stop offset="0.0833" stop-color="#281A81"/><stop offset="0.1667" stop-color="#5D0C83"/><stop offset="0.25" stop-color="#911475"/><stop offset="0.3333" stop-color="#CE2F55"/><stop offset="0.4167" stop-color="#FF6633"/><stop offset="0.5" stop-color="#F6821F"/><stop offset="0.5833" stop-color="#FBAD41"/><stop offset="0.6667" stop-color="#FFCD89"/><stop offset="0.75" stop-color="#FFE9CB"/><stop offset="0.8333" stop-color="#FFF7EC"/><stop offset="0.9167" stop-color="#FFF8EE"/><stop offset="1" stop-color="white"/></linearGradient><linearGradient id="${id}d" x1="91.4992" y1="27.4982" x2="28.1217" y2="54.1775" gradientUnits="userSpaceOnUse"><stop stop-color="white"/><stop offset="0.1293" stop-color="#FFF8EE"/><stop offset="0.6171" stop-color="#FBAD41"/><stop offset="0.848" stop-color="#F6821F"/><stop offset="1" stop-color="#FF6633"/></linearGradient></defs></svg>`;
}
