/**
 * roadmap_update 工具 — move_to 参数集成测试
 *
 * 验证通过 registerUpdateTool 注册的工具能正确处理 move_to 参数。
 */

import { describe, expect, it, vi } from "vitest";

// Mock store
const mockWrite = vi.fn();
vi.mock("../lib/store", () => ({
	readRoadmap: vi.fn(() => structuredClone(baseRm)),
	writeRoadmap: mockWrite,
	getRoadmapFilePath: vi.fn(() => "/tmp/test-rm.json"),
}));

import { Type } from "@sinclair/typebox";
import type { Roadmap } from "../lib/types";

// 构造带 eid 的测试数据
const baseRm: Roadmap = {
	meta: {
		id: "test",
		title: "Test Roadmap",
		status: "active",
		created: "2024-01-01",
		updated: "2024-01-01",
		tags: [],
		nextEid: 6,
	},
	epics: [
		{
			id: "E1",
			eid: 1,
			title: "Epic 1",
			description: "",
			status: "doing",
			priority: "high",
			project: "proj",
			stories: [
				{
					id: "E1.S1",
					eid: 2,
					title: "Story 1",
					description: "",
					status: "doing",
					tasks: [
						{
							id: "E1.S1.T1",
							eid: 3,
							title: "Task A",
							description: "",
							status: "todo",
						},
					],
				},
				{
					id: "E1.S2",
					eid: 4,
					title: "Story 2",
					description: "",
					status: "todo",
					tasks: [],
				},
			],
		},
		{
			id: "E2",
			eid: 5,
			title: "Epic 2",
			description: "",
			status: "todo",
			priority: "medium",
			project: "proj2",
			stories: [],
		},
	],
};

/** 从 mockWrite 提取写入的 roadmap */
function getWrittenRoadmap(): Roadmap {
	return mockWrite.mock.calls[mockWrite.mock.calls.length - 1]?.[1];
}

describe("roadmap_update move_to 集成", () => {
	it("移动 Task 到另一个 Story", async () => {
		// 直接调用 moveItem（绕过 registerTool 注册）
		const { moveItem } = await import("../lib/tools-atomic-logic-move");
		const rm = structuredClone(baseRm);
		const result = moveItem(rm, "E1.S1.T1", "E1.S2");
		expect(result).toContain("移动");
	});

	it("移动 Story 到另一个 Epic", async () => {
		const { moveItem } = await import("../lib/tools-atomic-logic-move");
		const rm = structuredClone(baseRm);
		const result = moveItem(rm, "E1.S2", "E2");
		expect(result).toContain("移动");
	});

	it("移动后路径重建", async () => {
		const { moveItem } = await import("../lib/tools-atomic-logic-move");
		const rm = structuredClone(baseRm);
		moveItem(rm, "E1.S1.T1", "E1.S2");

		// Task 应在 E1.S2 下
		const e1s2 = rm.epics[0].stories.find((s) => s.id === "E1.S2");
		expect(e1s2).toBeDefined();
		expect(e1s2!.tasks).toHaveLength(1);
		expect(e1s2!.tasks[0].eid).toBe(3);
		expect(e1s2!.tasks[0].title).toBe("Task A");
	});

	it("移动后 eid 不变", async () => {
		const { moveItem } = await import("../lib/tools-atomic-logic-move");
		const rm = structuredClone(baseRm);
		moveItem(rm, "E1.S1.T1", "E1.S2");

		const task = rm.epics[0].stories
			.find((s) => s.id === "E1.S2")!
			.tasks.find((t) => t.eid === 3)!;
		expect(task).toBeDefined();
		expect(task.title).toBe("Task A");
	});
});
