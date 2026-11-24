<script>
	import '../app.css';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import logo from '#lib/logo.webp';
	import logoText from '#lib/logo-text.webp';

	let { children } = $props();
	// Figure + lettering on the homepage; lettering alone elsewhere
	// (recipes show Dobby at the bottom instead).
	const home = $derived(page.route.id === '/');
</script>

<header class="wrap" class:home>
	<a class="brand" href={resolve('/')}>
		{#if home}
			<img src={logo} width="920" height="465" alt="Dobbys Elfenküche" />
		{:else}
			<img src={logoText} width="600" height="406" alt="Dobbys Elfenküche" />
		{/if}
	</a>
</header>

<main class="wrap">
	{@render children()}
</main>

<style>
	header {
		display: flex;
		justify-content: center;
		padding-top: 14px;
	}
	.brand {
		display: block;
		width: min(100%, 190px);
	}
	.home .brand {
		width: min(100%, 440px);
	}
	img {
		display: block;
		width: 100%;
		height: auto;
	}
	main {
		padding-bottom: 48px;
	}
</style>
