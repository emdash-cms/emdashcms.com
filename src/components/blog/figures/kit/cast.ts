/**
 * The people in every figure, as in the launch video. `id` is the user ID
 * EmDash's generated avatar hashes, chosen so each lands on the palette named
 * in `palette`.
 *
 * `caret` is the palette's saturated stop: a 2px caret or a packet dot keeps
 * 3:1 against card and stage surfaces in light and dark. `flag` is a darker
 * pair of the same hue so 11-12px semibold white type on a name flag keeps
 * 4.5:1 at both ends of the gradient.
 */

export type PersonKey = "noah" | "matt" | "ana" | "maya";

export interface Person {
	name: string;
	id: string;
	palette: string;
	caret: string;
	flag: readonly [string, string];
}

export const PEOPLE: Record<PersonKey, Person> = {
	noah: { name: "Noah", id: "user_noah_22", palette: "Lagoon", caret: "#058eaf", flag: ["#036f8b", "#0a7d98"] },
	matt: { name: "Matt", id: "user_matt_14", palette: "Iris", caret: "#8a66d9", flag: ["#7353c4", "#7f5dcb"] },
	ana: { name: "Ana", id: "user_ana_8", palette: "Apricot", caret: "#dd6301", flag: ["#a94b00", "#b45309"] },
	maya: { name: "Maya", id: "user_maya_3", palette: "Rose", caret: "#d04a69", flag: ["#b8385a", "#c04262"] },
};

/** CSS custom properties that colour a person's caret, flag, packets and highlights. */
export function personStyle(who: PersonKey) {
	const p = PEOPLE[who];
	return `--who:${p.caret};--who-flag:linear-gradient(90deg, ${p.flag[0]}, ${p.flag[1]})`;
}
