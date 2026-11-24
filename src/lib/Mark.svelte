<script>
	/** Dobby's mark: a crooked elf cap. Colours follow the theme. */
	let { size = 28 } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
	<path d="M15 47C19 31 27 15 49 9c-8 7-10 20-4 38z" fill="var(--elf)" />
	<path d="M24 30c5-1 11 0 16 3" stroke="var(--elf-dark)" stroke-width="2.5" stroke-linecap="round" fill="none" />
	<rect x="10" y="44" width="42" height="11" rx="5.5" fill="var(--accent)" />
	<circle cx="50" cy="9" r="5" fill="var(--cream)" stroke="var(--elf-dark)" stroke-width="1.5" />
</svg>
