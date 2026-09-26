import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { planHomeContent } from "./home-content-plan.mjs";

function fixtures() {
	const hero = { _type: "marketing.hero", _key: "live-hero", headline: "Keep this Hero", extra: "editor copy" };
	const feature = { _type: "marketing.features", _key: "live-features", headline: "Old features", features: [{ title: "Old" }] };
	const unknown = { _type: "custom.notice", _key: "custom-notice", value: { nested: "Keep this too" } };
	const testimonials = { _type: "marketing.testimonials", _key: "live-voices", testimonials: [{ author: "Old" }] };
	const faq = { _type: "marketing.faq", _key: "live-faq", items: [{ question: "Old", answer: "Old" }] };
	const currentEntry = {
		id: "entry-id",
		slug: "home",
		status: "published",
		locale: "en",
		_rev: "revision-1",
		data: { title: "Home", customField: "unchanged", content: [hero, feature, unknown, testimonials, faq] },
	};
	const seedHome = {
		data: {
			content: [
				{ _type: "marketing.hero", _key: "seed-hero", headline: "Do not use this Hero" },
				{ _type: "marketing.features", _key: "seed-features", headline: "New features" },
				{ _type: "marketing.testimonials", _key: "seed-voices", testimonials: [{ author: "New" }] },
				{ _type: "marketing.faq", _key: "seed-faq", items: [{ question: "New", answer: "New" }] },
			],
		},
	};
	return { currentEntry, seedHome, hero, unknown };
}

test("replaces only three marketing blocks and keeps the live Hero and unknown content", () => {
	const { currentEntry, seedHome, hero, unknown } = fixtures();
	const original = structuredClone(currentEntry);
	const plan = planHomeContent(currentEntry, seedHome);
	assert.deepEqual(plan.changes.map((change) => change.type), ["marketing.features", "marketing.testimonials", "marketing.faq"]);
	assert.deepEqual(plan.nextData.content[0], hero);
	assert.deepEqual(plan.nextData.content[2], unknown);
	assert.equal(plan.nextData.content[1]._key, "live-features");
	assert.equal(plan.nextData.content[1].headline, "New features");
	assert.equal(plan.nextData.customField, "unchanged");
	assert.deepEqual(plan.preservedBlocks.map((block) => [block.index, block.type, block.key]), [[0, "marketing.hero", "live-hero"], [2, "custom.notice", "custom-notice"]]);
	assert.ok(plan.preservedBlocks.every((block) => block.beforeHash === block.afterHash));
	assert.deepEqual(currentEntry, original);
});

test("a reviewed plan is stable but changes when content or revision changes", () => {
	const { currentEntry, seedHome } = fixtures();
	const baseline = planHomeContent(currentEntry, seedHome).planHash;
	assert.equal(planHomeContent(currentEntry, seedHome).planHash, baseline);
	assert.notEqual(planHomeContent({ ...currentEntry, _rev: "revision-2" }, seedHome).planHash, baseline);
	assert.notEqual(planHomeContent({ ...currentEntry, data: { ...currentEntry.data, title: "Edited" } }, seedHome).planHash, baseline);
});

test("missing or duplicate target blocks fail closed", () => {
	const { currentEntry, seedHome } = fixtures();
	const withoutFaq = { ...currentEntry, data: { ...currentEntry.data, content: currentEntry.data.content.filter((block) => block._type !== "marketing.faq") } };
	assert.throws(() => planHomeContent(withoutFaq, seedHome), /exactly one marketing\.faq/);
	const duplicateFeatures = { ...currentEntry, data: { ...currentEntry.data, content: [...currentEntry.data.content, currentEntry.data.content[1]] } };
	assert.throws(() => planHomeContent(duplicateFeatures, seedHome), /exactly one marketing\.features/);
});

test("refuses a reordered marketing layout while allowing unrelated blocks between sections", () => {
	const { currentEntry, seedHome } = fixtures();
	const [hero, features, unknown, testimonials, faq] = currentEntry.data.content;
	assert.doesNotThrow(() => planHomeContent(currentEntry, seedHome));
	const reordered = { ...currentEntry, data: { ...currentEntry.data, content: [hero, testimonials, unknown, features, faq] } };
	assert.throws(() => planHomeContent(reordered, seedHome), /marketing block order/);
});

test("refuses a non-published entry or malformed Portable Text", () => {
	const { currentEntry, seedHome } = fixtures();
	assert.throws(() => planHomeContent({ ...currentEntry, status: "draft" }, seedHome), /published Home/);
	assert.throws(() => planHomeContent({ ...currentEntry, data: { content: "not blocks" } }, seedHome), /block array/);
	assert.throws(() => planHomeContent({ ...currentEntry, data: { content: [null] } }, seedHome), /malformed block/);
});

test("refuses a scheduled Home entry before preparing a draft", () => {
	const { currentEntry, seedHome } = fixtures();
	assert.throws(() => planHomeContent({ ...currentEntry, scheduledAt: "2026-10-01T00:00:00Z" }, seedHome), /scheduled publication/);
});

test("refuses remote HTTP before sending a token", () => {
	const result = spawnSync(process.execPath, [fileURLToPath(new URL("./plan-home-content.mjs", import.meta.url)), "--url", "http://example.invalid"], {
		env: { ...process.env, EMDASH_TOKEN: "test-token", EMDASH_HEADERS: "" },
		encoding: "utf8",
		timeout: 5000,
	});
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Remote sites require HTTPS/);
});

test("the content planner rejects write flags", () => {
	const result = spawnSync(process.execPath, [fileURLToPath(new URL("./plan-home-content.mjs", import.meta.url)), "--url", "http://localhost:4333", "--apply"], {
		env: { ...process.env, EMDASH_TOKEN: "test-token", EMDASH_HEADERS: "" },
		encoding: "utf8",
		timeout: 5000,
	});
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Unknown argument: --apply/);
});
