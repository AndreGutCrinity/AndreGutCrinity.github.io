#!/usr/bin/env node
// Check recipe files against the schema, with the same rules the build uses.
//
//   npm run validate                       all of src/recipes/
//   npm run validate -- src/recipes/x.json just these files
//
// Exit 0 = all valid, 1 = at least one problem (each one printed).

import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseRecipe } from '#lib/schema.js';

const DIR = 'src/recipes';
const files = process.argv.length > 2
	? process.argv.slice(2)
	: readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => join(DIR, f));

let bad = 0;
const titles = new Map();

for (const file of files) {
	const slug = basename(file, '.json');
	let data;
	try {
		data = JSON.parse(readFileSync(file, 'utf8'));
	} catch (e) {
		console.error(`✗ ${file}\n  kein gültiges JSON: ${/** @type {Error} */ (e).message}`);
		bad++;
		continue;
	}
	const result = parseRecipe(slug, data);
	if (!result.ok) {
		console.error(`✗ ${file}\n  ${result.errors.join('\n  ')}`);
		bad++;
		continue;
	}
	const key = result.recipe.title.toLowerCase();
	if (titles.has(key)) {
		console.error(`✗ ${file}\n  gleicher Titel wie ${titles.get(key)}`);
		bad++;
	}
	titles.set(key, file);
}

if (bad) {
	console.error(`\n${bad} von ${files.length} Dateien fehlerhaft.`);
	process.exit(1);
}
console.log(`✓ ${files.length} ${files.length === 1 ? 'Rezept' : 'Rezepte'} gültig.`);
