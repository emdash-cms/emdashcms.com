/** Showcase cards show screenshots at 16:10, the shape of a 1440×900 homepage. */
export const CROP_ASPECT = 16 / 10;
export const MAX_OUTPUT_WIDTH = 1440;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export interface Size {
	width: number;
	height: number;
}

export interface Rect extends Size {
	x: number;
	y: number;
}

/** Zoom is relative to the frame being exactly covered; the centre is in source pixels. */
export interface CropView {
	zoom: number;
	centerX: number;
	centerY: number;
}

/** Display pixels per source pixel at zoom 1, when the image just covers the frame. */
export function coverScale(image: Size, frame: Size): number {
	return Math.max(frame.width / image.width, frame.height / image.height);
}

function visibleSize(zoom: number, image: Size, frame: Size): Size {
	const scale = coverScale(image, frame) * zoom;
	return { width: frame.width / scale, height: frame.height / scale };
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function clampView(view: CropView, image: Size, frame: Size): CropView {
	const zoom = clamp(Number.isFinite(view.zoom) ? view.zoom : MIN_ZOOM, MIN_ZOOM, MAX_ZOOM);
	const visible = visibleSize(zoom, image, frame);
	return {
		zoom,
		centerX: clamp(view.centerX, visible.width / 2, image.width - visible.width / 2),
		centerY: clamp(view.centerY, visible.height / 2, image.height - visible.height / 2),
	};
}

export function sourceRect(view: CropView, image: Size, frame: Size): Rect {
	const visible = visibleSize(view.zoom, image, frame);
	return {
		x: view.centerX - visible.width / 2,
		y: view.centerY - visible.height / 2,
		width: visible.width,
		height: visible.height,
	};
}

/** The top of a homepage carries its header and hero, so the crop starts there. */
export function initialView(image: Size, frame: Size): CropView {
	const visible = visibleSize(MIN_ZOOM, image, frame);
	return clampView({ zoom: MIN_ZOOM, centerX: image.width / 2, centerY: visible.height / 2 }, image, frame);
}

export function isCropAspect(image: Size): boolean {
	return Math.abs(image.width / image.height / CROP_ASPECT - 1) <= 0.01;
}

/** The output size for a crop, never wider than the source region it comes from. */
export function outputSize(rect: Rect): Size {
	const width = Math.max(1, Math.min(MAX_OUTPUT_WIDTH, Math.round(rect.width)));
	return { width, height: Math.max(1, Math.round(width / CROP_ASPECT)) };
}
