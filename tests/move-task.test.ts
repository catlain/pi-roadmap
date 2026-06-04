/**
 * Move 操作 — Task 移动测试
 */

import { describe, expect, it } from "vitest";
import { moveItem } from "../lib/tools-atomic-logic-move";
import { makeMoveRoadmap } from "./helpers/move-fixtures";

describe("moveItem — Task 移动", () => {
	it("应将 Task 从一个 Story 移到另一个 Story", () => {
		const rm = makeMoveRoadmap();
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
		const rm = makeMoveRoadmap();
		const result = moveItem(rm, "#200", "E1.S2");

		expect(result).toContain("✅ 移动完成");
		expect(rm.epics[1].stories[0].tasks).toHaveLength(2);
		expect(rm.epics[0].stories[1].tasks).toHaveLength(2);
	});

	it("移动后所有路径应正确重建", () => {
		const rm = makeMoveRoadmap();
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
		const rm = makeMoveRoadmap();
		moveItem(rm, "E2.S1.T2", "E1.S2");

		const movedTask = rm.epics[0].stories[1].tasks.find(
			(t) => t.eid === 201,
		);
		expect(movedTask).toBeDefined();
		expect(movedTask!.title).toBe("Task Y");
	});

	it("源 Story 变空时应提示", () => {
		const rm = makeMoveRoadmap();
		const result = moveItem(rm, "E1.S2.T1", "E1.S1");

		expect(result).toContain("源 Story 已空");
		expect(rm.epics[0].stories[1].tasks).toHaveLength(0);
	});

	it("源 Story 剩余数量应正确", () => {
		const rm = makeMoveRoadmap();
		const result = moveItem(rm, "E2.S1.T1", "E1.S1");

		expect(result).toContain("剩余 2 个 Task");
	});
});
