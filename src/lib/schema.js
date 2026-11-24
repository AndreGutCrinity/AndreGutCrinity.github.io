// The recipe format. One file per recipe: src/recipes/<slug>.json.
// Used by the site build and by `npm run validate`, so a file that passes
// validate also builds. Keys are English, content is German.

import { z } from 'zod';

/** Filenames: lowercase ASCII, digits and single hyphens ("aelplermagronen"). */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const text = z.string().trim().min(1);
const minutes = z.number().int().positive();
const isoDate = z.iso.date(); // YYYY-MM-DD

export const Ingredient = z
	.strictObject({
		/** Quantity for `servings`. Omit for "nach Belieben", "etwas". */
		amount: z.number().positive().optional(),
		/** Upper end of a range: "2–3 EL" is amount 2, amountMax 3. */
		amountMax: z.number().positive().optional(),
		/** "g", "ml", "EL", "TL", "Prise", "Bund", ... Omit for counted items ("2 Eier"). */
		unit: text.optional(),
		/** "Mehl", "Eier", "Zwiebel" */
		name: text,
		/** "fein gehackt", "zimmerwarm", "nach Belieben" */
		note: text.optional()
	})
	.refine((i) => i.amountMax === undefined || (i.amount !== undefined && i.amountMax > i.amount), {
		message: 'amountMax braucht amount und muss grösser als amount sein',
		path: ['amountMax']
	});

/** A titled (or untitled) group: "Teig", "Füllung", "Sauce". */
const group = (/** @type {z.ZodType} */ item) =>
	z.strictObject({
		title: text.optional(),
		items: z.array(item).min(1)
	});

export const Recipe = z.strictObject({
	title: text,
	/** One or two sentences: what it is and why it's good. */
	description: text.optional(),
	/** Where it came from. Omit for family recipes. */
	source: z
		.strictObject({
			url: z.url({ protocol: /^https?$/ }),
			/** "Swissmilk", "Betty Bossi", "Grosi" */
			name: text.optional()
		})
		.optional(),
	/** Every amount is for this many servings; the page scales from here. */
	servings: z.number().int().positive(),
	/** What a serving is. Default "Personen"; e.g. "Stück", "Blech", "Gläser". */
	servingsLabel: text.optional(),
	time: z
		.strictObject({
			prep: minutes.optional(),
			cook: minutes.optional(),
			/** Including resting/rising time, so it can exceed prep + cook. */
			total: minutes.optional()
		})
		.optional(),
	/** Short, capitalised: "Vegetarisch", "Pasta", "Ofen", "Dessert". */
	tags: z.array(text).default([]),
	ingredients: z.array(group(Ingredient)).min(1),
	steps: z.array(group(text)).min(1),
	notes: z.array(text).optional(),
	added: isoDate,
	updated: isoDate.optional()
});

/** @typedef {z.infer<typeof Recipe> & { slug: string }} RecipeEntry */

/**
 * Validate one recipe file's parsed JSON.
 * @param {string} slug filename without .json
 * @param {unknown} data
 * @returns {{ ok: true, recipe: RecipeEntry } | { ok: false, errors: string[] }}
 */
export function parseRecipe(slug, data) {
	const errors = [];
	if (!SLUG.test(slug)) {
		errors.push(`Dateiname "${slug}.json": nur a-z, 0-9 und einzelne Bindestriche erlaubt`);
	}
	const result = Recipe.safeParse(data);
	if (!result.success) {
		for (const issue of result.error.issues) {
			const where = issue.path.length ? issue.path.join('.') : '(Datei)';
			errors.push(`${where}: ${issue.message}`);
		}
	}
	if (errors.length || !result.success) return { ok: false, errors };
	return { ok: true, recipe: { slug, ...result.data } };
}
