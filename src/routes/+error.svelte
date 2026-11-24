<script>
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Nicht gefunden · Dobbys Elfenküche</title></svelte:head>

{#if page.status === 404}
	<h1>Dobby findet dieses Rezept nicht</h1>
	<p>Er hat in jeder Schublade nachgeschaut. Vielleicht wurde es umbenannt oder gelöscht.</p>
{:else}
	<h1>Da ist Dobby etwas angebrannt</h1>
	<p>{page.error?.message}</p>
{/if}
<p><a href={resolve('/')}>Zurück in die Küche</a></p>
