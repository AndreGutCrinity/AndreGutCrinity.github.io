<script>
	import '../app.css';
	import { resolve } from '$app/paths';

	let { children } = $props();
</script>

<header class="wrap">
	<a class="brand" href={resolve('/')}>Unsere Rezepte</a>
</header>

<main class="wrap">
	{@render children()}
</main>

<style>
	header {
		padding-top: 22px;
		padding-bottom: 6px;
	}
	.brand {
		font-family: var(--serif);
		font-size: 1.15rem;
		font-weight: 600;
		color: var(--text);
		text-decoration: none;
		letter-spacing: 0.01em;
	}
	.brand::before {
		content: '';
		display: inline-block;
		width: 0.6em;
		height: 0.6em;
		margin-right: 0.45em;
		border-radius: 50%;
		background: var(--accent);
		vertical-align: 0.05em;
	}
	main {
		padding-bottom: 64px;
	}
</style>
