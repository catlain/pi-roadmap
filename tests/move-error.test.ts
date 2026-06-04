/**
 * Move 操作 — Story 移动 + 错误处理测试
 */

import { describe, expect, it } from "vitest";
import { moveItem } from "../lib/tools-atomic-logic-move";
import { makeMoveRoadmap } from "./helpers/move-fixtures";

describe("moveItem — Story 移动", () => {
	it("应将 Story 从一个 Epic 移到另一个 Epic", () => {
		const rm = makeMoveRoadmap();
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
		const rm = makeMoveRoadmap();
		moveItem(rm, "E2.S1", "E1");

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
		const rm = makeMoveRoadmap();
		const result = moveItem(rm, "E2.S1", "E1");

		expect(result).toContain("源 Epic 已空");
		expect(rm.epics[1].stories).toHaveLength(0);
	});
});

describe("moveItem — 错误处理", () => {
	it("应拒绝移动到自身所在位置", () => {
		const rm = makeMoveRoadmap();
		const result = moveItem(rm, "E1.S1.T1", "E1.S1");

		expect(result).toContain("无需移动");
	});

	it("应拒绝 Epic 移动", () => {
		const rm = makeMoveRoadmap();
		const result = moveItem(rm, "E1", "E2");

		expect(result).toContain("Epic 不能移动");
	});

	it("Task 移到非 Story 目标应报错", () => {
		const rm = makeMoveRoadmap();
		const result = moveItem(rm, "E1.S1.T1", "E1");

		expect(result).toContain("Task 只能移动到 Story 级别");
	});

	it("Story 移到 Story 级别应报错", () => {
		const rm = makeMoveRoadmap();
		const result = moveItem(rm, "E1.S1", "E1.S1");

		expect(result).toContain("Story 只能移动到 Epic 级别");
	});

	it("源项不存在应报错", () => {
		const rm = makeMoveRoadmap();
		const result = moveItem(rm, "E99.S1.T1", "E1.S1");

		expect(result).toContain("不存在");
	});

	it("目标不存在应报错", () => {
		const rm = makeMoveRoadmap();
		const result = moveItem(rm, "E1.S1.T1", "E99.S1");

		expect(result).toContain("不存在");
	});

	it("不存在 eid 应报错", () => {
		const rm = makeMoveRoadmap();
		const result = moveItem(rm, "#99999", "E1.S1");

		expect(result).toContain("不存在");
	});
});
