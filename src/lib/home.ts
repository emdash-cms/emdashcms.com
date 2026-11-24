import type { PortableTextBlock } from "emdash";

/**
 * The capabilities bento replaces the home page's features grid. Home content
 * created before the capabilities block existed still has the grid and no
 * bento, so render the bento in the first grid's place, keeping the grid's
 * stored headline and introduction so they stay editable in the admin.
 * Content that includes a capabilities block renders exactly as stored.
 *
 * This is a bridge, not a migration: while it exists, a features block can't
 * appear on a home page without a capabilities block. Once production content
 * has the capabilities block in place of the features grid, delete it.
 */
export function withCapabilities(content: PortableTextBlock[] | undefined) {
	if (!content || content.some((block) => block._type === "marketing.capabilities")) return content;
	const featuresIndex = content.findIndex((block) => block._type === "marketing.features");
	if (featuresIndex < 0) return content;
	const { headline, subheadline } = content[featuresIndex] as { headline?: unknown; subheadline?: unknown };
	const capabilities: PortableTextBlock = {
		_type: "marketing.capabilities",
		_key: "capabilities",
		...(typeof headline === "string" && { headline }),
		...(typeof subheadline === "string" && { subheadline }),
	};
	return [...content.slice(0, featuresIndex), capabilities, ...content.slice(featuresIndex + 1)];
}

export interface FaqItem {
	question: string;
	answer: string;
}

/** Questions from every FAQ block on the page, skipping half-filled ones. */
export function faqItems(content: PortableTextBlock[] | undefined): FaqItem[] {
	if (!content) return [];
	return content
		.filter((block) => block._type === "marketing.faq")
		.flatMap((block) => (Array.isArray(block.items) ? (block.items as unknown[]) : []))
		.flatMap((item) => {
			const { question, answer } = (item ?? {}) as { question?: unknown; answer?: unknown };
			return typeof question === "string" && question.trim() && typeof answer === "string" && answer.trim()
				? [{ question: question.trim(), answer: answer.trim() }]
				: [];
		});
}
