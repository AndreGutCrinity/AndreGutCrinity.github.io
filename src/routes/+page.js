import { recipes } from '#lib/recipes.js';
import { fold } from '#lib/format.js';

export function load() {
	const list = recipes.map((r) => ({
		slug: r.slug,
		title: r.title,
		description: r.description,
		tags: r.tags,
		total: r.time?.total ?? ((r.time?.prep ?? 0) + (r.time?.cook ?? 0) || undefined),
		// Everything the search box matches against, pre-folded.
		haystack: fold(
			[r.title, r.description, ...r.tags, ...r.ingredients.flatMap((g) => g.items.map((i) => i.name))]
				.filter(Boolean)
				.join(' ')
		)
	}));
	const tags = [...new Set(recipes.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b, 'de'));
	return { list, tags };
}
