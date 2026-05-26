import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		// doing 测试共享 doing.json，需要串行避免跨文件干扰
		fileParallelism: false,
	},
});
