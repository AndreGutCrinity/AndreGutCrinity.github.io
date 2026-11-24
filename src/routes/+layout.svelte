<script>
	import '../app.css';
	import { resolve } from '$app/paths';
	import Mark from '#lib/Mark.svelte';

	let { children } = $props();
</script>

<header class="wrap">
	<a class="brand" href={resolve('/')}>
		<Mark size={30} />
		<span>Dobbys Elfenküche</span>
	</a>
</header>

<main class="wrap">
	{@render children()}
</main>

<footer class="wrap">
	<p>Gesammelt und sauber aufgeschrieben von Dobby, dem Küchenelf.</p>
</footer>

<style>
	header {
		padding-top: 22px;
		padding-bottom: 6px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-family: var(--serif);
		font-size: 1.2rem;
		font-weight: 600;
		color: var(--text);
		text-decoration: none;
		letter-spacing: 0.01em;
	}
	.brand :global(svg) {
		transform: rotate(-8deg);
		transition: transform 0.25s;
	}
	.brand:hover :global(svg) {
		transform: rotate(6deg);
	}
	main {
		padding-bottom: 48px;
	}
	footer p {
		margin: 0;
		padding: 22px 0 36px;
		border-top: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.85rem;
	}
</style>
