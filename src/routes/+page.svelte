<script>
	import { resolve } from '$app/paths';
	import { fold } from '#lib/format.js';

	let { data } = $props();

	let query = $state('');

	const shown = $derived.by(() => {
		const words = fold(query).split(/\s+/).filter(Boolean);
		return data.list.filter((r) => words.every((w) => r.haystack.includes(w)));
	});
</script>

<svelte:head>
	<title>Dobbys Elfenküche</title>
	<meta name="description" content="Alle Rezepte, die Dobby für uns gesammelt hat." />
</svelte:head>

<h1 class="visually-hidden">Rezepte</h1>

<div class="search">
	<input
		type="search"
		placeholder="Dobby, such mir … (Gericht oder Zutat)"
		aria-label="Rezepte durchsuchen"
		bind:value={query}
	/>
</div>

{#if query}
	<p class="count">
		{shown.length}
		{shown.length === 1 ? 'Rezept' : 'Rezepte'} gefunden
	</p>
{/if}

<ul class="grid">
	{#each shown as r (r.slug)}
		<li>
			<a class="card" href={resolve('/r/[slug]', { slug: r.slug })}>
				<h2>{r.title}</h2>
				{#if r.description}<p class="desc">{r.description}</p>{/if}
			</a>
		</li>
	{:else}
		<li class="empty">Dobby hat überall nachgeschaut, aber nichts gefunden.</li>
	{/each}
</ul>

<style>
	/* Keeps a page heading for screen readers; the logo is the visible title. */
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.search {
		margin: 18px 0 22px;
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
		margin: -8px 2px 12px;
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
	.empty {
		color: var(--muted);
	}
</style>
