/**
 * 依赖关系功能测试 — 纯函数部分
 *
 * 覆盖 findItemStatus、areDependenciesMet、detectCycle、formatDependencies
 */

import { describe, expect, it } from "vitest";
import {
	areDependenciesMet,
	detectCycle,
	findItemStatus,
	formatDependencies,
} from "../lib/dependency";
import type { Epic, RoadmapFile, Story, Task } from "../lib/types";

function makeTask(o: Partial<Task> & { id: string }): Task {
	return { title: `Task ${o.id}`, status: "todo", ...o };
}
function makeStory(o: Partial<Story> & { id: string }, tasks: Task[] = []): Story {
	return { title: `Story ${o.id}`, description: "", status: "todo", tasks, ...o };
}
function makeEpic(o: Partial<Epic> & { id: string }, stories: Story[] = []): Epic {
	return { title: `Epic ${o.id}`, description: "", status: "todo", priority: "medium", project: "/test", stories, ...o };
}
function makeRoadmap(epics: Epic[] = []): RoadmapFile {
	return { meta: { id: "test", title: "Test", status: "active", created: "2025-01-01", updated: "2025-01-01", tags: [] }, epics };
}

const DEP_RM: RoadmapFile = {
	meta: { id: "test", title: "Test", status: "active", created: "2025-01-01", updated: "2025-01-01", tags: [] },
	epics: [
		{
			id: "E1", title: "Epic 1", description: "", status: "doing", priority: "high", project: "/test",
			stories: [
				{ id: "E1.S1", title: "Story 1", description: "", status: "doing", tasks: [
					{ id: "E1.S1.T1", title: "Task 1", status: "done", doneDate: "2025-01-02" },
					{ id: "E1.S1.T2", title: "Task 2", status: "doing" },
					{ id: "E1.S1.T3", title: "Task 3", status: "todo" },
					{ id: "E1.S1.T4", title: "Task 4", status: "dropped" },
				] },
				{ id: "E1.S2", title: "Story 2", description: "", status: "todo", tasks: [{ id: "E1.S2.T1", title: "Task 5", status: "done" }] },
			],
		},
		{ id: "E2", title: "Epic 2", description: "", status: "todo", priority: "medium", project: "/test", stories: [{ id: "E2.S1", title: "Story 3", description: "", status: "todo", tasks: [{ id: "E2.S1.T1", title: "Task 6", status: "todo" }] }] },
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

describe("areDependenciesMet", () => {
	it("全 done 满足", () => {
		expect(areDependenciesMet(DEP_RM, ["E1.S1.T1", "E1.S2.T1"]).met).toBe(true);
	});
	it("dropped 算满足", () => {
		expect(areDependenciesMet(DEP_RM, ["E1.S1.T4"]).met).toBe(true);
	});
	it("部分未完成", () => {
		const r = areDependenciesMet(DEP_RM, ["E1.S1.T1", "E1.S1.T2", "E1.S1.T3"]);
		expect(r.met).toBe(false);
		expect(r.unmet).toEqual(["E1.S1.T2", "E1.S1.T3"]);
	});
	it("空依赖满足", () => {
		expect(areDependenciesMet(DEP_RM, undefined).met).toBe(true);
		expect(areDependenciesMet(DEP_RM, []).met).toBe(true);
	});
	it("不存在的 ID 不满足", () => {
		expect(areDependenciesMet(DEP_RM, ["E1.S1.T1", "GHOST"]).met).toBe(false);
	});
});

describe("detectCycle", () => {
	it("无环返回 null", () => {
		expect(detectCycle(DEP_RM, "E1.S1.T3", ["E1.S1.T1"])).toBeNull();
	});
	it("简单环", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" }, [
			makeTask({ id: "E1.S1.T1", dependsOn: ["E1.S1.T2"] }),
			makeTask({ id: "E1.S1.T2", dependsOn: ["E1.S1.T1"] }),
		])])]);
		const r = detectCycle(rm, "E1.S1.T1", ["E1.S1.T2"]);
		expect(r).not.toBeNull();
		expect(r!.length).toBeGreaterThanOrEqual(2);
	});
	it("间接环", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" }, [
			makeTask({ id: "E1.S1.T1", dependsOn: ["E1.S1.T2"] }),
			makeTask({ id: "E1.S1.T2", dependsOn: ["E1.S1.T3"] }),
			makeTask({ id: "E1.S1.T3", dependsOn: ["E1.S1.T1"] }),
		])])]);
		expect(detectCycle(rm, "E1.S1.T1", ["E1.S1.T2"])).not.toBeNull();
	});
	it("自环", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" }, [
			makeTask({ id: "E1.S1.T1", dependsOn: ["E1.S1.T1"] }),
		])])]);
		expect(detectCycle(rm, "E1.S1.T1", ["E1.S1.T1"])).not.toBeNull();
	});
	it("空依赖无环", () => {
		expect(detectCycle(DEP_RM, "E1.S1.T3", [])).toBeNull();
	});
});

describe("formatDependencies", () => {
	it("格式化含 emoji", () => {
		const r = formatDependencies(DEP_RM, ["E1.S1.T1", "E1.S1.T2", "E1.S1.T3", "E1.S1.T4"]);
		expect(r).toContain("✅");
		expect(r).toContain("🔄");
		expect(r).toContain("⬜");
		expect(r).toContain("❌");
	});
	it("空依赖返回空字符串", () => {
		expect(formatDependencies(DEP_RM, undefined)).toBe("");
		expect(formatDependencies(DEP_RM, [])).toBe("");
	});
	it("不存在的 ID 显示问号", () => {
		expect(formatDependencies(DEP_RM, ["GHOST"])).toContain("❓");
	});
});
