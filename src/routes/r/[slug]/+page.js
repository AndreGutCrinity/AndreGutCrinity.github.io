import { error } from '@sveltejs/kit';
import { recipes } from '#lib/recipes.js';

export function entries() {
	return recipes.map((r) => ({ slug: r.slug }));
}

export function load({ params }) {
	const recipe = recipes.find((r) => r.slug === params.slug);
	if (!recipe) error(404, 'Rezept nicht gefunden');
	return { recipe };
}
