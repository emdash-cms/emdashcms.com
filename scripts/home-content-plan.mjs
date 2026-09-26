import { createHash } from "node:crypto";

const replacementTypes = ["marketing.features", "marketing.testimonials", "marketing.faq"];
const marketingTypes = ["marketing.hero", ...replacementTypes];

function digest(value) {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function contentBlocks(entry) {
	const blocks = entry?.data?.content;
	if (!Array.isArray(blocks)) throw new Error("Home content must be a Portable Text block array");
	if (blocks.some((block) => !block || typeof block !== "object" || typeof block._type !== "string")) throw new Error("Home content contains a malformed block");
	return blocks;
}

function onlyBlock(blocks, type) {
	const matches = blocks.filter((block) => block && typeof block === "object" && block._type === type);
	if (matches.length !== 1) throw new Error(`Expected exactly one ${type} block; found ${matches.length}`);
	return matches[0];
}

export function planHomeContent(currentEntry, seedHome) {
	if (currentEntry?.slug !== "home" || currentEntry?.status !== "published") throw new Error("Expected the published Home entry");
	if (!currentEntry.id || !currentEntry._rev) throw new Error("Home entry needs an ID and revision token");
	if (!Object.hasOwn(currentEntry, "draftRevisionId")) throw new Error("Home draft state is hidden; use an account that can read drafts");
	if (currentEntry.draftRevisionId) throw new Error("Home already has an unpublished draft; review it first");
	if (currentEntry.scheduledAt) throw new Error("Home has a scheduled publication; clear or review it before updating");

	const currentBlocks = contentBlocks(currentEntry);
	const seedBlocks = contentBlocks(seedHome);
	const hero = onlyBlock(currentBlocks, "marketing.hero");
	const desiredBlocks = new Map(replacementTypes.map((type) => [type, onlyBlock(seedBlocks, type)]));
	for (const type of replacementTypes) onlyBlock(currentBlocks, type);
	const marketingOrder = (blocks) => blocks.filter((block) => marketingTypes.includes(block?._type)).map((block) => block._type);
	if (JSON.stringify(marketingOrder(currentBlocks)) !== JSON.stringify(marketingOrder(seedBlocks))) throw new Error("Home marketing block order differs from the seed; review the layout before applying");

	const changes = [];
	const nextBlocks = currentBlocks.map((block) => {
		const desired = block && typeof block === "object" ? desiredBlocks.get(block._type) : undefined;
		if (!desired) return block;
		const replacement = { ...desired, _key: block._key ?? desired._key };
		if (JSON.stringify(block) !== JSON.stringify(replacement)) changes.push({ type: block._type, before: block, after: replacement });
		return replacement;
	});

	if (JSON.stringify(onlyBlock(nextBlocks, "marketing.hero")) !== JSON.stringify(hero)) throw new Error("Hero must remain unchanged");

	const nextData = { ...currentEntry.data, content: nextBlocks };
	const preservedBlocks = currentBlocks.flatMap((block, index) => replacementTypes.includes(block._type) ? [] : [{
		index,
		type: block._type,
		key: block._key ?? null,
		beforeHash: digest(block),
		afterHash: digest(nextBlocks[index]),
	}]);
	return {
		entryId: currentEntry.id,
		locale: currentEntry.locale ?? undefined,
		revision: currentEntry._rev,
		heroHash: digest(hero),
		preservedBlocks,
		planHash: digest({ entryId: currentEntry.id, revision: currentEntry._rev, before: currentEntry.data, after: nextData }),
		changes,
		nextData,
	};
}
