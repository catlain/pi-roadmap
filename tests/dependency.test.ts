/**
 * 依赖关系功能测试 — 纯函数部分
 *
 * 覆盖 findItemStatus、findItemStatusByEid、areDependenciesMet、detectCycleByEid、formatDependencies
 */

import { describe, expect, it } from "vitest";
import {
	areDependenciesMet,
	detectCycleByEid,
	findItemStatus,
	findItemStatusByEid,
	formatDependencies,
} from "../lib/dependency";
import type { Epic, RoadmapFile, Story, Task } from "../lib/types";

function makeTask(o: Partial<Task> & { id: string; eid: number }): Task {
	return { title: `Task ${o.id}`, status: "todo", ...o };
}
function makeStory(
	o: Partial<Story> & { id: string; eid: number },
	tasks: Task[] = [],
): Story {
	return {
		title: `Story ${o.id}`,
		description: "",
		status: "todo",
		tasks,
		...o,
	};
}
function makeEpic(
	o: Partial<Epic> & { id: string; eid: number },
	stories: Story[] = [],
): Epic {
	return {
		title: `Epic ${o.id}`,
		description: "",
		status: "todo",
		priority: "medium",
		project: "/test",
		stories,
		...o,
	};
}
function makeRoadmap(epics: Epic[] = []): RoadmapFile {
	return {
		meta: {
			id: "test",
			title: "Test",
			status: "active",
			created: "2025-01-01",
			updated: "2025-01-01",
			tags: [],
			nextEid: 1,
		},
		epics,
	};
}

// 带 eid 的测试数据
const DEP_RM: RoadmapFile = {
	meta: {
		id: "test",
		title: "Test",
		status: "active",
		created: "2025-01-01",
		updated: "2025-01-01",
		tags: [],
		nextEid: 10,
	},
	epics: [
		{
			eid: 1,
			id: "E1",
			title: "Epic 1",
			description: "",
			status: "doing",
			priority: "high",
			project: "/test",
			stories: [
				{
					eid: 2,
					id: "E1.S1",
					title: "Story 1",
					description: "",
					status: "doing",
					tasks: [
						{
							eid: 3,
							id: "E1.S1.T1",
							title: "Task 1",
							status: "done",
							doneDate: "2025-01-02",
						},
						{ eid: 4, id: "E1.S1.T2", title: "Task 2", status: "doing" },
						{ eid: 5, id: "E1.S1.T3", title: "Task 3", status: "todo" },
						{ eid: 6, id: "E1.S1.T4", title: "Task 4", status: "dropped" },
					],
				},
				{
					eid: 7,
					id: "E1.S2",
					title: "Story 2",
					description: "",
					status: "todo",
					tasks: [{ eid: 8, id: "E1.S2.T1", title: "Task 5", status: "done" }],
				},
			],
		},
		{
			eid: 9,
			id: "E2",
			title: "Epic 2",
			description: "",
			status: "todo",
			priority: "medium",
			project: "/test",
			stories: [
				{
					eid: 10,
					id: "E2.S1",
					title: "Story 3",
					description: "",
					status: "todo",
					tasks: [{ eid: 11, id: "E2.S1.T1", title: "Task 6", status: "todo" }],
				},
			],
		},
	],
};

describe("findItemStatus", () => {
	it("找到 task 状态", () => {
		expect(findItemStatus(DEP_RM, "E1.S1.T1")).toBe("done");
		expect(findItemStatus(DEP_RM, "E1.S1.T2")).toBe("doing");
		expect(findItemStatus(DEP_RM, "E1.S1.T3")).toBe("todo");
		expect(findItemStatus(DEP_RM, "E1.S1.T4")).toBe("dropped");
	});
	it("找到 story/epic 状态", () => {
		expect(findItemStatus(DEP_RM, "E1.S1")).toBe("doing");
		expect(findItemStatus(DEP_RM, "E2")).toBe("todo");
	});
	it("找不到不存在的 ID", () => {
		expect(findItemStatus(DEP_RM, "NONEXISTENT")).toBeNull();
		expect(findItemStatus(makeRoadmap(), "E1")).toBeNull();
	});
});

describe("findItemStatusByEid", () => {
	it("通过 eid 找到状态", () => {
		expect(findItemStatusByEid(DEP_RM, 3)).toBe("done");
		expect(findItemStatusByEid(DEP_RM, 4)).toBe("doing");
		expect(findItemStatusByEid(DEP_RM, 1)).toBe("doing");
		expect(findItemStatusByEid(DEP_RM, 2)).toBe("doing");
	});
	it("不存在的 eid 返回 null", () => {
		expect(findItemStatusByEid(DEP_RM, 999)).toBeNull();
	});
});

describe("areDependenciesMet", () => {
	it("全 done 满足", () => {
		expect(areDependenciesMet(DEP_RM, [3, 8]).met).toBe(true);
	});
	it("dropped 算满足", () => {
		expect(areDependenciesMet(DEP_RM, [6]).met).toBe(true);
	});
	it("部分未完成", () => {
		const r = areDependenciesMet(DEP_RM, [3, 4, 5]);
		expect(r.met).toBe(false);
		expect(r.unmet).toEqual([4, 5]);
	});
	it("空依赖满足", () => {
		expect(areDependenciesMet(DEP_RM, undefined).met).toBe(true);
		expect(areDependenciesMet(DEP_RM, []).met).toBe(true);
	});
	it("不存在的 eid 不满足", () => {
		expect(areDependenciesMet(DEP_RM, [3, 999]).met).toBe(false);
	});
});

describe("detectCycleByEid", () => {
	it("无环返回 null", () => {
		expect(detectCycleByEid(DEP_RM, 5, [3])).toBeNull();
	});
	it("简单环", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1", eid: 1 }, [
				makeStory({ id: "E1.S1", eid: 2 }, [
					makeTask({ id: "E1.S1.T1", eid: 3, dependsOn: [4] }),
					makeTask({ id: "E1.S1.T2", eid: 4, dependsOn: [3] }),
				]),
			]),
		]);
		const r = detectCycleByEid(rm, 3, [4]);
		expect(r).not.toBeNull();
		expect(r!.length).toBeGreaterThanOrEqual(2);
	});
	it("间接环", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1", eid: 1 }, [
				makeStory({ id: "E1.S1", eid: 2 }, [
					makeTask({ id: "E1.S1.T1", eid: 3, dependsOn: [4] }),
					makeTask({ id: "E1.S1.T2", eid: 4, dependsOn: [5] }),
					makeTask({ id: "E1.S1.T3", eid: 5, dependsOn: [3] }),
				]),
			]),
		]);
		expect(detectCycleByEid(rm, 3, [4])).not.toBeNull();
	});
	it("自环", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1", eid: 1 }, [
				makeStory({ id: "E1.S1", eid: 2 }, [
					makeTask({ id: "E1.S1.T1", eid: 3, dependsOn: [3] }),
				]),
			]),
		]);
		expect(detectCycleByEid(rm, 3, [3])).not.toBeNull();
	});
	it("空依赖无环", () => {
		expect(detectCycleByEid(DEP_RM, 5, [])).toBeNull();
	});
});

describe("formatDependencies", () => {
	it("格式化含 emoji", () => {
		const r = formatDependencies(DEP_RM, [3, 4, 5, 6]);
		expect(r).toContain("✅");
		expect(r).toContain("🔄");
		expect(r).toContain("⬜");
		expect(r).toContain("❌");
	});
	it("空依赖返回空字符串", () => {
		expect(formatDependencies(DEP_RM, undefined)).toBe("");
		expect(formatDependencies(DEP_RM, [])).toBe("");
	});
	it("不存在的 eid 显示问号", () => {
		expect(formatDependencies(DEP_RM, [999])).toContain("❓");
	});
});
