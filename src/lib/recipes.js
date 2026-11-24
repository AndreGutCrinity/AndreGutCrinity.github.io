// Loads and validates every recipe at build time. One invalid file fails the
// build, so a bad edit never reaches the live site.

import { parseRecipe } from '#lib/schema.js';

const files = import.meta.glob('/src/recipes/*.json', { eager: true, import: 'default' });

/** @type {import('#lib/schema.js').RecipeEntry[]} */
export const recipes = Object.entries(files)
	.map(([path, data]) => {
		const slug = path.slice(path.lastIndexOf('/') + 1, -'.json'.length);
		const result = parseRecipe(slug, data);
		if (!result.ok) throw new Error(`${path}:\n  ${result.errors.join('\n  ')}`);
		return result.recipe;
	})
	.sort((a, b) => a.title.localeCompare(b.title, 'de'));
