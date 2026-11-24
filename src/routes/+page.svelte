<script>
	import { resolve } from '$app/paths';
	import { fold, formatMinutes } from '#lib/format.js';

	let { data } = $props();

	let query = $state('');

	const shown = $derived.by(() => {
		const words = fold(query).split(/\s+/).filter(Boolean);
		return data.list.filter((r) => words.every((w) => r.haystack.includes(w)));
	});
</script>

<svelte:head>
	<title>Unsere Rezepte</title>
</svelte:head>

<div class="search">
	<input
		type="search"
		placeholder="Suchen – Gericht oder Zutat …"
		aria-label="Rezepte durchsuchen"
		bind:value={query}
	/>
</div>

<p class="count">
	{shown.length}
	{shown.length === 1 ? 'Rezept' : 'Rezepte'}{#if query}&nbsp;gefunden{/if}
</p>

<ul class="grid">
	{#each shown as r (r.slug)}
		<li>
			<a class="card" href={resolve('/r/[slug]', { slug: r.slug })}>
				<h2>{r.title}</h2>
				{#if r.description}<p class="desc">{r.description}</p>{/if}
				<p class="meta">
					{#if r.total}<span>{formatMinutes(r.total)}</span>{/if}
				</p>
			</a>
		</li>
	{:else}
		<li class="empty">Nichts gefunden.</li>
	{/each}
</ul>

<style>
	.search {
		margin: 18px 0 14px;
	}
	input {
		width: 100%;
		padding: 13px 16px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		font-size: 1rem;
	}
	.count {
		margin: 18px 2px 10px;
		color: var(--muted);
		font-size: 0.9rem;
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 14px;
	}
	.card {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 18px 20px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		color: inherit;
		text-decoration: none;
		transition: border-color 0.15s, transform 0.15s;
	}
	.card:hover {
		border-color: var(--accent);
		transform: translateY(-1px);
	}
	h2 {
		margin: 0 0 6px;
		font-size: 1.25rem;
	}
	.desc {
		margin: 0 0 12px;
		color: var(--muted);
		font-size: 0.93rem;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.meta {
		margin: auto 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		font-size: 0.8rem;
	}
	.meta span {
		padding: 2px 8px;
		border-radius: 6px;
		background: var(--accent-soft);
	}
	.empty {
		color: var(--muted);
	}
</style>
