import { recipes } from '#lib/recipes.js';
import { fold } from '#lib/format.js';

export function load() {
	const list = recipes.map((r) => ({
		slug: r.slug,
		title: r.title,
		description: r.description,
		// Everything the search box matches against, pre-folded.
		haystack: fold(
			[r.title, r.description, ...r.tags, ...r.ingredients.flatMap((g) => g.items.map((i) => i.name))]
				.filter(Boolean)
				.join(' ')
		)
	}));
	return { list };
}
