/**
 * Move 操作核心逻辑测试
 */

import { describe, expect, it } from "vitest";
import { moveItem } from "../lib/tools-atomic-logic-move";
import type { RoadmapFile } from "../lib/types";

/** 创建测试用 roadmap */
function makeRoadmap(): RoadmapFile {
	return {
		meta: {
			id: "test-rm",
			title: "测试路线图",
			status: "active",
			created: "2026-01-01",
			updated: "2026-01-01",
			tags: [],
			nextEid: 100,
		},
		epics: [
			{
				id: "E1",
				eid: 1,
				title: "Epic 1",
				description: "",
				status: "todo",
				priority: "high",
				project: "proj-a",
				stories: [
					{
						id: "E1.S1",
						eid: 10,
						title: "Story 1-1",
						description: "",
						status: "todo",
						tasks: [
							{ id: "E1.S1.T1", eid: 100, title: "Task A", status: "todo" },
							{ id: "E1.S1.T2", eid: 101, title: "Task B", status: "todo" },
						],
					},
					{
						id: "E1.S2",
						eid: 11,
						title: "Story 1-2",
						description: "",
						status: "todo",
						tasks: [
							{ id: "E1.S2.T1", eid: 102, title: "Task C", status: "todo" },
						],
					},
				],
			},
			{
				id: "E2",
				eid: 2,
				title: "Epic 2",
				description: "",
				status: "todo",
				priority: "medium",
				project: "proj-b",
				stories: [
					{
						id: "E2.S1",
						eid: 20,
						title: "Story 2-1",
						description: "",
						status: "todo",
						tasks: [
							{ id: "E2.S1.T1", eid: 200, title: "Task X", status: "todo" },
							{ id: "E2.S1.T2", eid: 201, title: "Task Y", status: "doing" },
							{ id: "E2.S1.T3", eid: 202, title: "Task Z", status: "todo" },
						],
					},
				],
			},
		],
	};
}

describe("moveItem — Task 移动", () => {
	it("应将 Task 从一个 Story 移到另一个 Story", () => {
		const rm = makeRoadmap();
		const result = moveItem(rm, "E2.S1.T1", "E1.S1");

		expect(result).toContain("✅ 移动完成");
		expect(result).toContain("Task X");
		expect(result).toContain("#200");
		expect(result).toContain("E2.S1.T1 → E1.S1.T3");

		// 源 Story 少了一个 Task
		expect(rm.epics[1].stories[0].tasks).toHaveLength(2);
		// 目标 Story 多了一个 Task
		expect(rm.epics[0].stories[0].tasks).toHaveLength(3);
	});

	it("应支持用 #eid 格式指定源项", () => {
		const rm = makeRoadmap();
		const result = moveItem(rm, "#200", "E1.S2");

		expect(result).toContain("✅ 移动完成");
		expect(rm.epics[1].stories[0].tasks).toHaveLength(2);
		expect(rm.epics[0].stories[1].tasks).toHaveLength(2);
	});

	it("移动后所有路径应正确重建", () => {
		const rm = makeRoadmap();
		moveItem(rm, "E2.S1.T1", "E1.S1");

		// E2.S1 剩下的两个 Task 路径应为 T1, T2
		expect(rm.epics[1].stories[0].tasks[0].id).toBe("E2.S1.T1");
		expect(rm.epics[1].stories[0].tasks[0].eid).toBe(201);
		expect(rm.epics[1].stories[0].tasks[1].id).toBe("E2.S1.T2");
		expect(rm.epics[1].stories[0].tasks[1].eid).toBe(202);

		// E1.S1 应有 3 个 Task
		expect(rm.epics[0].stories[0].tasks[2].id).toBe("E1.S1.T3");
		expect(rm.epics[0].stories[0].tasks[2].eid).toBe(200);
	});

	it("移动后 eid 不变", () => {
		const rm = makeRoadmap();
		moveItem(rm, "E2.S1.T2", "E1.S2");

		// Task Y 的 eid 仍然是 201
		const movedTask = rm.epics[0].stories[1].tasks.find(
			(t) => t.eid === 201,
		);
		expect(movedTask).toBeDefined();
		expect(movedTask!.title).toBe("Task Y");
	});

	it("源 Story 变空时应提示", () => {
		const rm = makeRoadmap();
		// E1.S2 只有一个 Task，移走它
		const result = moveItem(rm, "E1.S2.T1", "E1.S1");

		expect(result).toContain("源 Story 已空");
		expect(rm.epics[0].stories[1].tasks).toHaveLength(0);
	});

	it("源 Story 剩余数量应正确", () => {
		const rm = makeRoadmap();
		const result = moveItem(rm, "E2.S1.T1", "E1.S1");

		expect(result).toContain("剩余 2 个 Task");
	});
});

describe("moveItem — Story 移动", () => {
	it("应将 Story 从一个 Epic 移到另一个 Epic", () => {
		const rm = makeRoadmap();
		const result = moveItem(rm, "E2.S1", "E1");

		expect(result).toContain("✅ 移动完成");
		expect(result).toContain("Story 2-1");
		expect(result).toContain("#20");
		expect(result).toContain("含 3 个 Task");

		// E2 无 Story 了
		expect(rm.epics[1].stories).toHaveLength(0);
		// E1 有 3 个 Story
		expect(rm.epics[0].stories).toHaveLength(3);
	});

	it("移动后 Story 内 Task 路径应正确重建", () => {
		const rm = makeRoadmap();
		moveItem(rm, "E2.S1", "E1");

		// Story 2-1 变成了 E1.S3，其 Task 应为 E1.S3.T1/T2/T3
		const movedStory = rm.epics[0].stories[2];
		expect(movedStory.id).toBe("E1.S3");
		expect(movedStory.tasks[0].id).toBe("E1.S3.T1");
		expect(movedStory.tasks[1].id).toBe("E1.S3.T2");
		expect(movedStory.tasks[2].id).toBe("E1.S3.T3");

		// eid 不变
		expect(movedStory.eid).toBe(20);
		expect(movedStory.tasks[0].eid).toBe(200);
	});

	it("源 Epic 变空时应提示", () => {
		const rm = makeRoadmap();
		const result = moveItem(rm, "E2.S1", "E1");

		expect(result).toContain("源 Epic 已空");
		expect(rm.epics[1].stories).toHaveLength(0);
	});
});

describe("moveItem — 错误处理", () => {
	it("应拒绝移动到自身所在位置", () => {
		const rm = makeRoadmap();
		const result = moveItem(rm, "E1.S1.T1", "E1.S1");

		expect(result).toContain("无需移动");
	});

	it("应拒绝 Epic 移动", () => {
		const rm = makeRoadmap();
		const result = moveItem(rm, "E1", "E2");

		expect(result).toContain("Epic 不能移动");
	});

	it("Task 移到非 Story 目标应报错", () => {
		const rm = makeRoadmap();
		const result = moveItem(rm, "E1.S1.T1", "E1");

		expect(result).toContain("Task 只能移动到 Story 级别");
	});

	it("Story 移到 Story 级别应报错", () => {
		const rm = makeRoadmap();
		const result = moveItem(rm, "E1.S1", "E1.S1");

		expect(result).toContain("Story 只能移动到 Epic 级别");
	});

	it("源项不存在应报错", () => {
		const rm = makeRoadmap();
		const result = moveItem(rm, "E99.S1.T1", "E1.S1");

		expect(result).toContain("不存在");
	});

	it("目标不存在应报错", () => {
		const rm = makeRoadmap();
		const result = moveItem(rm, "E1.S1.T1", "E99.S1");

		expect(result).toContain("不存在");
	});

	it("不存在 eid 应报错", () => {
		const rm = makeRoadmap();
		const result = moveItem(rm, "#99999", "E1.S1");

		expect(result).toContain("不存在");
	});
});
