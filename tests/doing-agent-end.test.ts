/**
 * agent_end 行为测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupCleanDoing, cleanupDoing } from "./doing-helpers";

const createdRoadmaps: string[] = [];
beforeEach(() => setupCleanDoing());
afterEach(() => cleanupDoing(createdRoadmaps));

describe("agent_end 行为", () => {
	it("有 doing 条目时生成提醒文本", async () => {
		const { addDoing, readDoing } = await import("../lib/doing-store");
		addDoing({ roadmapId: "rm-1", taskId: "E1.S1.T1", taskTitle: "测试任务", startedAt: "2026-01-01" });

		const entries = readDoing();
		expect(entries.length).toBeGreaterThan(0);

		const taskList = entries
			.map((e) => `  - ${e.taskId}: ${e.taskTitle} (${e.roadmapId})`)
			.join("\n");
		expect(taskList).toContain("E1.S1.T1");
		expect(taskList).toContain("测试任务");
		expect(taskList).toContain("rm-1");
	});

	it("无 doing 条目时不生成提醒", async () => {
		const { readDoing } = await import("../lib/doing-store");
		expect(readDoing()).toEqual([]);
	});
});
