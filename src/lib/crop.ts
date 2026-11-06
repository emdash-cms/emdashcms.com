/** Showcase cards show screenshots at 16:10, the shape of a 1440×900 homepage. */
export const CROP_ASPECT = 16 / 10;
export const MAX_OUTPUT_WIDTH = 1440;
/** How far the crop can zoom in, relative to the largest crop the image allows. */
export const MAX_ZOOM = 4;

export interface Size {
	width: number;
	height: number;
}

export interface Point {
	x: number;
	y: number;
}

/** A 16:10 region of the source image, in source pixels. Its height always follows from its width. */
export interface Crop {
	x: number;
	y: number;
	width: number;
}

export type Corner = "nw" | "ne" | "sw" | "se";

export function cropHeight(crop: Crop): number {
	return crop.width / CROP_ASPECT;
}

export function maxCropWidth(image: Size): number {
	return Math.min(image.width, image.height * CROP_ASPECT);
}

export function minCropWidth(image: Size): number {
	return maxCropWidth(image) / MAX_ZOOM;
}

/** 1 when the crop is as large as the image allows, up to MAX_ZOOM. */
export function cropZoom(crop: Crop, image: Size): number {
	return maxCropWidth(image) / crop.width;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function clampCrop(crop: Crop, image: Size): Crop {
	const width = clamp(Number.isFinite(crop.width) ? crop.width : Infinity, minCropWidth(image), maxCropWidth(image));
	return {
		width,
		x: clamp(crop.x, 0, image.width - width),
		y: clamp(crop.y, 0, image.height - width / CROP_ASPECT),
	};
}

/** The top of a homepage carries its header and hero, so the crop starts there, as large as it fits. */
export function initialCrop(image: Size): Crop {
	const width = maxCropWidth(image);
	return { width, x: (image.width - width) / 2, y: 0 };
}

export function moveCrop(crop: Crop, dx: number, dy: number, image: Size): Crop {
	return clampCrop({ ...crop, x: crop.x + dx, y: crop.y + dy }, image);
}

/** Resizes the crop by `factor` (above 1 zooms in) while the focus point keeps its place within it. */
export function zoomCrop(crop: Crop, factor: number, image: Size, focus?: Point): Crop {
	const height = cropHeight(crop);
	const at = focus ?? { x: crop.x + crop.width / 2, y: crop.y + height / 2 };
	const width = clamp(crop.width / factor, minCropWidth(image), maxCropWidth(image));
	const ratio = width / crop.width;
	return clampCrop({ width, x: at.x - (at.x - crop.x) * ratio, y: at.y - (at.y - crop.y) * ratio }, image);
}

/** Drags one corner to `point` while the opposite corner stays put. */
export function resizeCrop(crop: Crop, corner: Corner, point: Point, image: Size): Crop {
	const east = corner.endsWith("e");
	const south = corner.startsWith("s");
	const anchor = {
		x: east ? crop.x : crop.x + crop.width,
		y: south ? crop.y : crop.y + cropHeight(crop),
	};
	const roomX = east ? image.width - anchor.x : anchor.x;
	const roomY = south ? image.height - anchor.y : anchor.y;
	const wanted = Math.max(east ? point.x - anchor.x : anchor.x - point.x, (south ? point.y - anchor.y : anchor.y - point.y) * CROP_ASPECT);
	const width = clamp(wanted, minCropWidth(image), Math.min(roomX, roomY * CROP_ASPECT, maxCropWidth(image)));
	return clampCrop(
		{
			width,
			x: east ? anchor.x : anchor.x - width,
			y: south ? anchor.y : anchor.y - width / CROP_ASPECT,
		},
		image,
	);
}

export function isCropAspect(image: Size): boolean {
	return Math.abs(image.width / image.height / CROP_ASPECT - 1) <= 0.01;
}

/** The saved size for a crop, never wider than the source region it comes from. */
export function outputSize(crop: Crop): Size {
	const width = Math.max(1, Math.min(MAX_OUTPUT_WIDTH, Math.round(crop.width)));
	return { width, height: Math.max(1, Math.round(width / CROP_ASPECT)) };
}
