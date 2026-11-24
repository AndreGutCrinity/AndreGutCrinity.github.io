# Dobbys Elfenküche

Our recipe collection, kept by Dobby (the Hermes agent on our home server), live at **https://andregutcrinity.github.io**.

A static SvelteKit site. Each recipe is one JSON file in
[`src/recipes/`](src/recipes/); every push to `main` validates them, builds the
site and deploys it to GitHub Pages (about 1–2 minutes). Recipes are added and
edited mostly by the Hermes agent on dobby, but editing a file by hand on
GitHub works the same way.

## Adding or changing a recipe

1. Create or edit `src/recipes/<slug>.json`. The slug is the URL
   (`/r/<slug>`): lowercase, `a-z`, `0-9`, single hyphens, umlauts written
   out (`aelplermagronen`).
2. `npm run validate`, which must print `✓`.
3. Commit and push to `main`.

If a recipe is invalid, the deploy fails at the validate step and the live
site keeps the previous version.

**Content rules:** German. Text only, no images. Steps are written in our own
words, keeping every quantity, temperature and time from the original.
`source.url` links back to the original.

## Format

The schema with comments is [`src/lib/schema.js`](src/lib/schema.js), and
[`src/recipes/shakshuka.json`](src/recipes/shakshuka.json) is a complete
example. In short:

```jsonc
{
  "title": "Shakshuka",
  "description": "optional, 1–2 Sätze",
  "source": { "url": "https://…", "name": "Fooby" },   // optional
  "servings": 2,                     // every amount is for this many
  "servingsLabel": "Personen",       // optional: "Stück", "Blech", "Zopf"
  "time": { "prep": 10, "cook": 25, "total": 35 },      // minutes, each optional
  "tags": ["Vegetarisch", "Schnell"],  // not shown, only searched
  "ingredients": [
    { "title": "Sauce",              // group title optional
      "items": [
        { "amount": 2, "amountMax": 3, "name": "Knoblauchzehen", "note": "gepresst" },
        { "amount": 400, "unit": "g", "name": "gehackte Tomaten" },
        { "name": "Salz und Pfeffer" }   // no amount = "nach Belieben"
      ] }
  ],
  "steps": [ { "title": "optional", "items": ["Schritt 1 …", "Schritt 2 …"] } ],
  "notes": ["optional"],
  "added": "2026-11-24",
  "updated": "2026-11-30"            // optional
}
```

Amounts are plain numbers (`0.5`, not `"½"`); the site shows them as `½` and
scales them with the servings buttons.

## Importing from a link

```bash
npm run -s import -- https://fooby.ch/de/rezepte/…
```

This prints the recipe data that the page itself publishes (schema.org
`Recipe`): raw ingredient lines, steps, servings, times. It does not write a
file; it gives you exact numbers to build one from. Exit code `2` means the
page has no such data (Swissmilk, for example), so read the page itself.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # type check
npm run build      # static site in build/
```
