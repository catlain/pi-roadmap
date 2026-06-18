/**
 * id-utils 查找函数测试 — findItemByEid / findItemByPath / findTaskByEid / resolveItemId / resolveToEid
 */
import { describe, it, expect } from "vitest";
import {
	findItemByEid,
	findItemByPath,
	findTaskByEid,
	resolveItemId,
	resolveToEid,
} from "../lib/id-utils";
import type { RoadmapFile } from "../lib/types";

function makeRm(overrides?: Partial<RoadmapFile>): RoadmapFile {
	return {
		meta: {
			id: "test", title: "Test", status: "active",
			created: "2025-01-01", updated: "2025-01-01", tags: [], nextEid: 10,
		},
		epics: [
			{
				id: "E1", eid: 1, title: "Epic 1", description: "",
				status: "todo", priority: "high", project: "test",
				stories: [
					{
						id: "E1.S1", eid: 2, title: "Story 1", description: "", status: "todo",
						tasks: [
							{ id: "E1.S1.T1", eid: 3, title: "Task 1", status: "todo" },
							{ id: "E1.S1.T2", eid: 4, title: "Task 2", status: "todo" },
						],
					},
					{
						id: "E1.S2", eid: 5, title: "Story 2", description: "", status: "todo",
						tasks: [{ id: "E1.S2.T1", eid: 6, title: "Task 3", status: "todo" }],
					},
				],
			},
			{
				id: "E2", eid: 7, title: "Epic 2", description: "",
				status: "todo", priority: "medium", project: "test2", stories: [],
			},
		],
		...overrides,
	};
}

// ── findItemByEid ──
describe("findItemByEid", () => {
	const rm = makeRm();
	it("按 eid 查找 Epic", () => {
		const r = findItemByEid(rm, 1);
		expect(r).not.toBeNull();
		expect(r!.epic.id).toBe("E1");
		expect(r!.story).toBeUndefined();
	});
	it("按 eid 查找 Story", () => {
		const r = findItemByEid(rm, 2);
		expect(r!.epic.id).toBe("E1");
		expect(r!.story!.id).toBe("E1.S1");
	});
	it("按 eid 查找 Task", () => {
		const r = findItemByEid(rm, 3);
		expect(r!.task!.id).toBe("E1.S1.T1");
	});
	it("不存在的 eid 返回 null", () => {
		expect(findItemByEid(rm, 999)).toBeNull();
	});
});

// ── findItemByPath ──
describe("findItemByPath", () => {
	const rm = makeRm();
	it("按路径查找 Epic", () => {
		expect(findItemByPath(rm, "E1")!.epic.id).toBe("E1");
	});
	it("按路径查找 Story", () => {
		expect(findItemByPath(rm, "E1.S1")!.story!.id).toBe("E1.S1");
	});
	it("按路径查找 Task", () => {
		expect(findItemByPath(rm, "E1.S1.T2")!.task!.id).toBe("E1.S1.T2");
	});
	it("不存在的路径返回 null", () => {
		expect(findItemByPath(rm, "E99")).toBeNull();
	});
});

// ── findTaskByEid ──
describe("findTaskByEid", () => {
	const rm = makeRm();
	it("找到 Task", () => {
		const r = findTaskByEid(rm, 3);
		expect(r!.task.id).toBe("E1.S1.T1");
		expect(r!.epic.id).toBe("E1");
		expect(r!.story.id).toBe("E1.S1");
	});
	it("Epic 的 eid 不匹配 Task", () => {
		expect(findTaskByEid(rm, 1)).toBeNull();
	});
	it("不存在的 eid 返回 null", () => {
		expect(findTaskByEid(rm, 999)).toBeNull();
	});
});

// ── resolveItemId ──
describe("resolveItemId", () => {
	const rm = makeRm();
	it("按 #eid 格式解析 Epic", () => {
		expect(resolveItemId(rm, "#1")!.epic.id).toBe("E1");
	});
	it("按纯数字解析 eid", () => {
		expect(resolveItemId(rm, "3")!.task!.id).toBe("E1.S1.T1");
	});
	it("按路径 E1 解析", () => {
		expect(resolveItemId(rm, "E1")!.epic.id).toBe("E1");
	});
	it("按路径 E1.S1 解析", () => {
		expect(resolveItemId(rm, "E1.S1")!.story!.id).toBe("E1.S1");
	});
	it("按路径 E1.S1.T1 解析", () => {
		expect(resolveItemId(rm, "E1.S1.T1")!.task!.id).toBe("E1.S1.T1");
	});
	it("不存在的路径返回 null", () => {
		expect(resolveItemId(rm, "E99")).toBeNull();
	});
	it("不存在的 eid 返回 null", () => {
		expect(resolveItemId(rm, "#999")).toBeNull();
	});
	it("存在 Story 但不存在 Task 返回 null", () => {
		expect(resolveItemId(rm, "E1.S1.T99")).toBeNull();
	});
});

// ── resolveToEid ──
describe("resolveToEid", () => {
	const rm = makeRm();
	it("数字字符串返回 eid", () => {
		expect(resolveToEid(rm, "3")).toBe(3);
	});
	it("#eid 格式返回 eid", () => {
		expect(resolveToEid(rm, "#5")).toBe(5);
	});
	it("路径格式查找对应 eid", () => {
		expect(resolveToEid(rm, "E1.S2.T1")).toBe(6);
	});
	it("不存在的返回 null", () => {
		expect(resolveToEid(rm, "E99")).toBeNull();
	});
});
