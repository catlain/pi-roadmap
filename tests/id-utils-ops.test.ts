/**
 * id-utils 操作函数测试 — allocateEid / rebuildPaths / buildEidPathIndex
 */
import { describe, it, expect } from "vitest";
import { allocateEid, rebuildPaths, buildEidPathIndex, ensureNextEid } from "../lib/id-utils";
import type { RoadmapFile, Epic } from "../lib/types";

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

// ── allocateEid ──
describe("allocateEid", () => {
	it("分配并递增 nextEid", () => {
		const rm = makeRm();
		expect(allocateEid(rm.meta)).toBe(10);
		expect(rm.meta.nextEid).toBe(11);
	});
	it("连续分配递增", () => {
		const rm = makeRm();
		allocateEid(rm.meta);
		expect(allocateEid(rm.meta)).toBe(11);
	});
	it("nextEid 未设置时从 1 开始", () => {
		const rm = makeRm({ meta: { id: "test", title: "T", status: "active", created: "", updated: "" } as any });
		expect(allocateEid(rm.meta)).toBe(1);
		expect(rm.meta.nextEid).toBe(2);
	});
});

// ── rebuildPaths ──
describe("rebuildPaths", () => {
	it("重建后 path 正确反映位置", () => {
		const rm: RoadmapFile = {
			meta: {
				id: "test", title: "Test", status: "active",
				created: "2025-01-01", updated: "2025-01-01", tags: [], nextEid: 5,
			},
			epics: [{
				id: "WRONG", eid: 1, title: "Epic", description: "",
				status: "todo", priority: "high", project: "p",
				stories: [{
					id: "WRONG.S", eid: 2, title: "Story", description: "", status: "todo",
					tasks: [{ id: "WRONG.S.T", eid: 3, title: "Task", status: "todo" }],
				}],
			}],
		};
		rebuildPaths(rm);
		expect(rm.epics[0].id).toBe("E1");
		expect(rm.epics[0].stories[0].id).toBe("E1.S1");
		expect(rm.epics[0].stories[0].tasks[0].id).toBe("E1.S1.T1");
	});

	it("多个 epic/story/task 编号正确", () => {
		const rm: RoadmapFile = {
			meta: {
				id: "test", title: "Test", status: "active",
				created: "2025-01-01", updated: "2025-01-01", tags: [], nextEid: 10,
			},
			epics: [
				{
					id: "X", eid: 1, title: "E1", description: "",
					status: "todo", priority: "high", project: "p",
					stories: [{
						id: "X.Y", eid: 2, title: "S1", description: "", status: "todo",
						tasks: [
							{ id: "a.b.c", eid: 3, title: "T1", status: "todo" },
							{ id: "d.e.f", eid: 4, title: "T2", status: "done" },
						],
					}],
				},
				{
					id: "Z", eid: 5, title: "E2", description: "",
					status: "todo", priority: "medium", project: "p2", stories: [],
				},
			],
		};
		rebuildPaths(rm);
		expect(rm.epics[0].id).toBe("E1");
		expect(rm.epics[0].stories[0].id).toBe("E1.S1");
		expect(rm.epics[0].stories[0].tasks[0].id).toBe("E1.S1.T1");
		expect(rm.epics[0].stories[0].tasks[1].id).toBe("E1.S1.T2");
		expect(rm.epics[1].id).toBe("E2");
	});
});

// ── buildEidPathIndex ──
describe("buildEidPathIndex", () => {
	it("构建正确的 path→eid 映射", () => {
		const rm = makeRm();
		const index = buildEidPathIndex(rm);
		expect(index.get("E1")).toBe(1);
		expect(index.get("E1.S1")).toBe(2);
		expect(index.get("E1.S1.T1")).toBe(3);
		expect(index.get("E1.S1.T2")).toBe(4);
		expect(index.get("E1.S2")).toBe(5);
		expect(index.get("E1.S2.T1")).toBe(6);
		expect(index.get("E2")).toBe(7);
	});

	it("无 eid 的项不包含在索引中", () => {
		const rm = makeRm({
			epics: [{
				...({ id: "E1", eid: undefined, title: "No Eid", description: "",
				status: "todo", priority: "high", project: "p", stories: [] } as any),
				// eid 删除以测试无 eid 情况
			} as unknown as Epic],
		});
		expect(buildEidPathIndex(rm).size).toBe(0);
	});
});

describe("ensureNextEid", () => {
	it("nextEid 未设置时初始化为 1", () => {
		const meta = { id: "t", title: "T", status: "active", created: "", updated: "" } as any;
		ensureNextEid(meta);
		expect(meta.nextEid).toBe(1);
	});
	it("nextEid 已设置时不覆盖", () => {
		const meta = { id: "t", title: "T", status: "active", created: "", updated: "", nextEid: 42 } as any;
		ensureNextEid(meta);
		expect(meta.nextEid).toBe(42);
	});
});