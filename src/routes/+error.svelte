<script>
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Nicht gefunden · Unsere Rezepte</title></svelte:head>

<h1>{page.status === 404 ? 'Nicht gefunden' : 'Fehler'}</h1>
<p>{page.error?.message}</p>
<p><a href={resolve('/')}>Zu allen Rezepten</a></p>
