import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			// Every page is prerendered; 404.html is what GitHub Pages serves for unknown paths.
			adapter: adapter({ fallback: '404.html' })
		})
	]
});
