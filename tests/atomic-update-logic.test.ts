/**
 * updateTask/updateItem 单元测试
 *
 * 测试 tools-atomic-utils 中的更新逻辑（字段更新、状态转换副作用）
 */

import { describe, expect, it } from "vitest";
import { today, updateItem, updateTask } from "../lib/tools-atomic-utils";
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

// ── updateTask() ──

describe("updateTask()", () => {
	it("更新 title", () => {
		const task = { id: "E1.S1.T1", title: "Old", status: "todo" as const };
		const result = updateTask({} as any, task, { title: "New" }, "session-1");
		expect(result).toContain("title");
		expect(task.title).toBe("New");
	});

	it("status→doing 填 doingDate 和 doingSessionId", () => {
		const task = { id: "E1.S1.T1", title: "T1", status: "todo" as const };
		updateTask({} as any, task, { status: "doing" }, "session-123");
		expect(task.doingDate).toBe(today());
		expect(task.doingSessionId).toBe("session-123");
	});

	it("status→done 填 doneDate 和 doneBySessionId，清 doingSessionId", () => {
		const task = {
			id: "E1.S1.T1",
			title: "T1",
			status: "doing" as const,
			doingDate: "2026-01-01",
			doingSessionId: "old",
		};
		updateTask({} as any, task, { status: "done" }, "session-456");
		expect(task.doneDate).toBe(today());
		expect(task.doneBySessionId).toBe("session-456");
		expect(task.doingSessionId).toBeUndefined();
	});

	it("更新 note", () => {
		const task = { id: "E1.S1.T1", title: "T1", status: "todo" as const };
		updateTask({} as any, task, { note: "测试备注" }, "session-1");
		expect(task.note).toBe("测试备注");
	});
});

// ── updateItem() (Epic/Story) ──

describe("updateItem()", () => {
	it("更新 Epic title", () => {
		const epic = {
			id: "E1",
			title: "Old",
			description: "",
			status: "todo" as const,
			priority: "high" as const,
			project: "/test",
			stories: [],
		};
		updateItem({} as any, epic, { title: "New" }, "session-1");
		expect(epic.title).toBe("New");
	});

	it("status→doing 填 doingDate", () => {
		const story = {
			id: "E1.S1",
			title: "S1",
			description: "",
			status: "todo" as const,
			tasks: [],
		};
		updateItem({} as any, story, { status: "doing" }, "session-1");
		expect(story.doingDate).toBe(today());
	});

	it("status→done 填 doneDate", () => {
		const epic = {
			id: "E1",
			title: "E1",
			description: "",
			status: "doing" as const,
			priority: "high" as const,
			project: "/test",
			stories: [],
		};
		updateItem({} as any, epic, { status: "done" }, "session-1");
		expect(epic.doneDate).toBe(today());
	});
});

// ── updateItem dependsOn ──

describe("updateItem() dependsOn", () => {
	it("设置 Epic 的 dependsOn", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1" }),
			makeEpic({ id: "E2", status: "done" }),
		]);
		const epic = rm.epics[0];
		const result = updateItem(rm, epic, { dependsOn: ["E2"] }, "s1");
		expect(result).toContain("dependsOn");
		expect(epic.dependsOn).toEqual(["E2"]);
	});

	it("设置 Story 的 dependsOn", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [
			makeStory({ id: "E1.S1" }),
			makeStory({ id: "E1.S2", status: "done" }),
		])]);
		const story = rm.epics[0].stories[0];
		const result = updateItem(rm, story, { dependsOn: ["E1.S2"] }, "s1");
		expect(result).toContain("dependsOn");
		expect(story.dependsOn).toEqual(["E1.S2"]);
	});

	it("拒绝不存在的依赖 ID", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [
			makeStory({ id: "E1.S1" }),
		])]);
		const epic = rm.epics[0];
		const result = updateItem(rm, epic, { dependsOn: ["NONEXISTENT"] }, "s1");
		expect(result).toContain("不存在");
		expect(epic.dependsOn).toBeUndefined();
	});

	it("拒绝循环依赖", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [
			makeStory({ id: "E1.S1" }),
		])]);
		// E1 依赖 E1.S1, E1.S1 依赖 E1 → 循环
		const story = rm.epics[0].stories[0];
		// 先给 Story 设置 dependsOn E1
		story.dependsOn = ["E1"];
		const epic = rm.epics[0];
		const result = updateItem(rm, epic, { dependsOn: ["E1.S1"] }, "s1");
		expect(result).toContain("循环依赖");
		expect(epic.dependsOn).toBeUndefined();
	});
});

// ── updateTask dependsOn ──

describe("updateTask() dependsOn", () => {
	it("设置 Task 的 dependsOn", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" }, [
			makeTask({ id: "E1.S1.T1" }),
			makeTask({ id: "E1.S1.T2", status: "done" }),
		])])]);
		const task = rm.epics[0].stories[0].tasks[0];
		const result = updateTask(rm, task, { dependsOn: ["E1.S1.T2"] }, "s1");
		expect(result).toContain("dependsOn");
		expect(task.dependsOn).toEqual(["E1.S1.T2"]);
	});

	it("拒绝不存在的依赖 ID", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" }, [
			makeTask({ id: "E1.S1.T1" }),
		])])]);
		const task = rm.epics[0].stories[0].tasks[0];
		const result = updateTask(rm, task, { dependsOn: ["NONEXISTENT"] }, "s1");
		expect(result).toContain("不存在");
		expect(task.dependsOn).toBeUndefined();
	});

	it("拒绝循环依赖", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" }, [
			makeTask({ id: "E1.S1.T1" }),
			makeTask({ id: "E1.S1.T2" }),
		])])]);
		// E1.S1.T1 依赖 E1.S1.T2, E1.S1.T2 依赖 E1.S1.T1 → 循环
		rm.epics[0].stories[0].tasks[1].dependsOn = ["E1.S1.T1"];
		const task = rm.epics[0].stories[0].tasks[0];
		const result = updateTask(rm, task, { dependsOn: ["E1.S1.T2"] }, "s1");
		expect(result).toContain("循环依赖");
		expect(task.dependsOn).toBeUndefined();
	});
});
