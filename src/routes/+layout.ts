// Enable SSR for full-stack functionality
// Only prerender the main page for fast initial load
export const prerender = true;
import posthog from 'posthog-js';
import { browser } from '$app/environment';

export const load = async () => {
	if (browser) {
		posthog.init('phc_eQ5ZavdmhviD1240ThzAAkAq1fg0Vq8ZbMoYSj0B6BQ', {
			api_host: 'https://us.i.posthog.com',
			defaults: '2025-05-24',
			person_profiles: 'identified_only' // or 'always' to create profiles for anonymous users as well
		});
	}

	return;
};
