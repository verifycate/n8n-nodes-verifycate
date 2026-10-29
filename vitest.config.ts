import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['test/**/*.test.ts'],
		setupFiles: ['./test/setup.ts'],
		coverage: {
			include: ['credentials/**/*.ts', 'nodes/**/*.ts', 'shared/**/*.ts'],
			exclude: ['shared/generated/**'],
		},
	},
});
