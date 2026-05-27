import { createConfig } from "../vitest.config.base";

export default createConfig({
	alias: {
		"@earendil-works/pi-coding-agent": true,
	},
	include: ["tests/**/*.test.ts"],
	test: {
		testTimeout: 10000,
		fileParallelism: false,
	},
});
