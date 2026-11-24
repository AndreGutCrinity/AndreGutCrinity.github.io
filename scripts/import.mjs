#!/usr/bin/env node
// Pull the machine-readable recipe (schema.org/Recipe JSON-LD) out of a web page.
//
//   npm run -s import -- <url>
//
// Prints the recipe exactly as the site publishes it: original language, raw
// ingredient lines, steps, servings, times. It does NOT write a recipe file;
// whoever runs it turns this into src/recipes/<slug>.json (in German), so the
// numbers come from the page's own data rather than from reading prose.
//
// Exit 0 = found (JSON on stdout), 2 = page has no Recipe data (read the page
// itself instead), 1 = fetch failed.

const url = process.argv[2];
if (!url || !/^https?:\/\//.test(url)) {
	console.error('Usage: npm run -s import -- <https://...>');
	process.exit(1);
}

/** @param {string} s */
function decode(s) {
	return s
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
		.replace(/[ \t]+/g, ' ')
		.trim();
}

/** @param {unknown} v @returns {string | undefined} */
function str(v) {
	if (typeof v === 'string') return decode(v) || undefined;
	if (typeof v === 'number') return String(v);
	if (Array.isArray(v)) return v.map(str).filter(Boolean).join(', ') || undefined;
	return undefined;
}

/** ISO 8601 duration ("PT1H30M", "P0DT45M") -> minutes. @param {unknown} v */
function minutes(v) {
	if (typeof v !== 'string') return undefined;
	const m = v.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/i);
	if (!m) return undefined;
	const total = (Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0);
	return total || undefined;
}

/** @param {any} node @returns {boolean} */
function isRecipe(node) {
	const t = node?.['@type'];
	return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
}

/** Find the first Recipe node anywhere in a JSON-LD blob (@graph, arrays, nesting). @param {any} node @returns {any} */
function findRecipe(node) {
	if (!node || typeof node !== 'object') return undefined;
	if (isRecipe(node)) return node;
	for (const child of Array.isArray(node) ? node : Object.values(node)) {
		const found = findRecipe(child);
		if (found) return found;
	}
	return undefined;
}

/**
 * recipeInstructions comes as a string, HowToStep[], HowToSection[] or a mix.
 * @param {any} v
 * @returns {{ section?: string, steps: string[] }[]}
 */
function instructions(v) {
	/** @type {{ section?: string, steps: string[] }[]} */
	const groups = [];
	const loose = { steps: /** @type {string[]} */ ([]) };
	/** @param {any} item @param {string[]} into */
	const step = (item, into) => {
		if (typeof item === 'string') {
			into.push(...decode(item).split(/\n+/).map((s) => s.trim()).filter(Boolean));
		} else if (item?.['@type'] === 'HowToSection' || item?.itemListElement) {
			const g = { section: str(item.name), steps: /** @type {string[]} */ ([]) };
			for (const sub of [].concat(item.itemListElement ?? [])) step(sub, g.steps);
			groups.push(g);
		} else if (item && typeof item === 'object') {
			const text = str(item.text) ?? str(item.name);
			if (text) into.push(text);
		}
	};
	for (const item of [].concat(v ?? [])) step(item, loose.steps);
	return loose.steps.length ? [loose, ...groups] : groups;
}

let html;
try {
	const res = await fetch(url, {
		headers: {
			'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
			'accept-language': 'de-CH,de;q=0.9,en;q=0.8'
		},
		redirect: 'follow',
		signal: AbortSignal.timeout(20_000)
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	html = await res.text();
} catch (e) {
	console.error(`Seite nicht abrufbar: ${/** @type {Error} */ (e).message}`);
	process.exit(1);
}

let recipe;
for (const [, body] of html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
	try {
		recipe = findRecipe(JSON.parse(body.trim()));
	} catch {
		// Some sites emit broken JSON-LD next to a valid block; keep looking.
	}
	if (recipe) break;
}

if (!recipe) {
	console.error('Kein schema.org/Recipe auf der Seite. Rezept aus dem Seitentext übernehmen.');
	process.exit(2);
}

const out = {
	url,
	name: str(recipe.name),
	description: str(recipe.description),
	author: str(recipe.author?.name ?? recipe.author),
	publisher: str(recipe.publisher?.name),
	recipeYield: str(recipe.recipeYield),
	prepMinutes: minutes(recipe.prepTime),
	cookMinutes: minutes(recipe.cookTime),
	totalMinutes: minutes(recipe.totalTime),
	category: str(recipe.recipeCategory),
	cuisine: str(recipe.recipeCuisine),
	keywords: str(recipe.keywords),
	ingredients: [].concat(recipe.recipeIngredient ?? recipe.ingredients ?? []).map(str).filter(Boolean),
	instructions: instructions(recipe.recipeInstructions)
};

console.log(JSON.stringify(out, null, 2));
