<script>
	import { resolve } from '$app/paths';
	import { formatAmount, formatMinutes } from '#lib/format.js';

	let { data } = $props();
	const r = $derived(data.recipe);

	// Resets to the recipe's own count when navigating to another recipe.
	let servings = $derived(r.servings);
	const factor = $derived(servings / r.servings);

	// Steps tapped as done, keyed "group-index".
	let done = $state(new Set());

	/** @param {Set<string>} set @param {string} key */
	function flip(set, key) {
		const next = new Set(set);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		return next;
	}

	/** @param {import('#lib/schema.js').RecipeEntry['ingredients'][number]['items'][number]} i */
	function quantity(i) {
		if (i.amount === undefined) return '';
		const a = formatAmount(i.amount * factor);
		const range = i.amountMax !== undefined ? `–${formatAmount(i.amountMax * factor)}` : '';
		return `${a}${range}${i.unit ? ` ${i.unit}` : ''}`;
	}

	/** @type {[string, number][]} */
	const timeParts = $derived(
		/** @type {[string, number | undefined][]} */ ([
			['Vorbereitung', r.time?.prep],
			['Kochen/Backen', r.time?.cook],
			['Gesamt', r.time?.total]
		]).filter(/** @returns {p is [string, number]} */ (p) => p[1] !== undefined)
	);

	/** @param {string} iso */
	const date = (iso) => new Date(iso).toLocaleDateString('de-CH');
</script>

<svelte:head>
	<title>{r.title} · Unsere Rezepte</title>
	{#if r.description}<meta name="description" content={r.description} />{/if}
</svelte:head>

<a class="back" href={resolve('/')}>← Alle Rezepte</a>

<article>
	<h1>{r.title}</h1>
	{#if r.description}<p class="lead">{r.description}</p>{/if}

	<div class="facts">
		{#each timeParts as [label, value] (label)}
			<div><span>{label}</span>{formatMinutes(value)}</div>
		{/each}
		{#if r.source}
			<div>
				<span>Quelle</span>
				<a href={r.source.url} rel="noopener noreferrer" target="_blank">
					{r.source.name ?? new URL(r.source.url).hostname.replace(/^www\./, '')} ↗
				</a>
			</div>
		{/if}
	</div>

	<div class="cols">
		<section class="ingredients">
			<div class="head">
				<h2>Zutaten</h2>
				<div class="stepper" role="group" aria-label="Portionen">
					<button aria-label="Weniger" disabled={servings <= 1} onclick={() => servings--}>−</button>
					<output aria-live="polite">{servings} {r.servingsLabel ?? 'Personen'}</output>
					<button aria-label="Mehr" onclick={() => servings++}>+</button>
				</div>
			</div>
			{#if servings !== r.servings}
				<p class="scaled">
					Umgerechnet von {r.servings}.
					<button class="link" onclick={() => (servings = r.servings)}>Zurücksetzen</button>
				</p>
			{/if}

			{#each r.ingredients as g, gi (gi)}
				{#if g.title}<h3>{g.title}</h3>{/if}
				<ul>
					{#each g.items as i, ii (ii)}
						<li>
							<span class="qty">{quantity(i)}</span>
							<span>{i.name}{#if i.note}<span class="note">, {i.note}</span>{/if}</span>
						</li>
					{/each}
				</ul>
			{/each}
		</section>

		<section class="steps">
			<h2>Zubereitung</h2>
			{#each r.steps as g, gi (gi)}
				{#if g.title}<h3>{g.title}</h3>{/if}
				<ol>
					{#each g.items as step, si (si)}
						{@const key = `${gi}-${si}`}
						<li class:done={done.has(key)}>
							<button class="step" onclick={() => (done = flip(done, key))}>{step}</button>
						</li>
					{/each}
				</ol>
			{/each}

			{#if r.notes?.length}
				<h2 class="notes-h">Tipps</h2>
				<ul class="notes">
					{#each r.notes as note, ni (ni)}<li>{note}</li>{/each}
				</ul>
			{/if}
		</section>
	</div>

	<p class="added">
		Hinzugefügt am {date(r.added)}{#if r.updated}, geändert am {date(r.updated)}{/if}
	</p>
</article>

<style>
	.back {
		display: inline-block;
		margin: 14px 0 4px;
		color: var(--muted);
		text-decoration: none;
		font-size: 0.92rem;
	}
	h1 {
		margin: 10px 0 8px;
		font-size: clamp(1.9rem, 5vw, 2.6rem);
	}
	.lead {
		margin: 0 0 18px;
		color: var(--muted);
		font-size: 1.05rem;
		max-width: 62ch;
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 10px 28px;
		padding: 14px 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		font-size: 0.95rem;
	}
	.facts span {
		display: block;
		color: var(--muted);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.cols {
		display: grid;
		gap: 12px 40px;
		margin-top: 10px;
	}
	@media (min-width: 760px) {
		.cols {
			grid-template-columns: minmax(260px, 2fr) 3fr;
		}
		.ingredients {
			position: sticky;
			top: 12px;
			align-self: start;
		}
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	h2 {
		margin: 22px 0 10px;
		font-size: 1.4rem;
	}
	h3 {
		margin: 18px 0 6px;
		font-family: var(--sans);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--accent);
	}
	ul,
	ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.stepper {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--surface);
	}
	.stepper button {
		width: 38px;
		height: 36px;
		border: 0;
		background: none;
		font-size: 1.2rem;
		cursor: pointer;
	}
	.stepper button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.stepper output {
		min-width: 7.5em;
		text-align: center;
		font-size: 0.92rem;
		font-variant-numeric: tabular-nums;
	}
	.scaled {
		margin: 0 0 4px;
		color: var(--muted);
		font-size: 0.85rem;
	}
	.link {
		border: 0;
		padding: 0;
		background: none;
		color: var(--accent);
		text-decoration: underline;
		cursor: pointer;
	}
	.ingredients li {
		display: grid;
		grid-template-columns: 5.4em 1fr;
		gap: 10px;
		align-items: baseline;
		padding: 7px 0;
		border-bottom: 1px solid var(--line);
	}
	.qty {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.note {
		color: var(--muted);
	}
	.steps ol {
		counter-reset: step;
	}
	.steps ol li {
		counter-increment: step;
		position: relative;
		padding-left: 44px;
		margin-bottom: 6px;
	}
	.steps ol li::before {
		content: counter(step);
		position: absolute;
		left: 0;
		top: 9px;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: var(--accent-soft);
		color: var(--accent);
		font-weight: 700;
		font-size: 0.9rem;
		display: grid;
		place-items: center;
	}
	.step {
		display: block;
		width: 100%;
		padding: 10px 0;
		border: 0;
		background: none;
		text-align: left;
		line-height: 1.6;
		cursor: pointer;
	}
	.done .step {
		color: var(--done);
	}
	.steps ol li.done::before {
		content: '✓';
	}
	.notes-h {
		margin-top: 30px;
	}
	.notes li {
		padding: 10px 14px;
		margin-bottom: 8px;
		border-left: 3px solid var(--accent);
		background: var(--surface);
		border-radius: 0 8px 8px 0;
	}
	.added {
		margin-top: 40px;
		color: var(--muted);
		font-size: 0.82rem;
	}
</style>
