/**
 * updateTask/updateItem 单元测试
 *
 * 测试 tools-atomic-utils 中的更新逻辑（字段更新、状态转换副作用）
 */

import { describe, expect, it } from "vitest";
import { today, updateItem, updateTask } from "../lib/tools-atomic-utils";
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
			nextEid: 100,
		},
		epics,
	};
}

// ── updateTask() ──

describe("updateTask()", () => {
	it("更新 title", () => {
		const task = {
			id: "E1.S1.T1",
			eid: 3,
			title: "Old",
			status: "todo" as const,
		};
		const result = updateTask({} as any, task, { title: "New" }, "session-1");
		expect(result).toContain("title");
		expect(task.title).toBe("New");
	});

	it("status→doing 填 doingDate 和 doingSessionId", () => {
		const task = {
			id: "E1.S1.T1",
			eid: 3,
			title: "T1",
			status: "todo" as const,
		} as unknown as Task;
		updateTask({} as any, task, { status: "doing" }, "session-123");
		expect(task.doingDate).toBe(today());
		expect(task.doingSessionId).toBe("session-123");
	});

	it("status→done 填 doneDate 和 doneBySessionId，清 doingSessionId", () => {
		const task = {
			id: "E1.S1.T1",
			eid: 3,
			title: "T1",
			status: "doing" as const,
			doingDate: "2026-01-01",
			doingSessionId: "old",
		} as unknown as Task;
		updateTask({} as any, task, { status: "done" }, "session-456");
		expect(task.doneDate).toBe(today());
		expect(task.doneBySessionId).toBe("session-456");
		expect(task.doingSessionId).toBeUndefined();
	});

	it("更新 note", () => {
		const task = {
			id: "E1.S1.T1",
			eid: 3,
			title: "T1",
			status: "todo" as const,
		} as unknown as Task;
		updateTask({} as any, task, { note: "测试备注" }, "session-1");
		expect(task.note).toBe("测试备注");
	});
});

// ── updateItem() (Epic/Story) ──

describe("updateItem()", () => {
	it("更新 Epic title", () => {
		const epic = {
			id: "E1",
			eid: 1,
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
			eid: 2,
			title: "S1",
			description: "",
			status: "todo" as const,
			tasks: [],
			...({ doingDate: undefined, doneDate: undefined, doingSessionId: undefined, doneBySessionId: undefined } as Partial<Story>),
		} as unknown as Story;
		updateItem({} as any, story, { status: "doing" }, "session-1");
		expect(story.doingDate).toBe(today());
	});

	it("status→done 填 doneDate", () => {
		const epic = {
			id: "E1",
			eid: 1,
			title: "E1",
			description: "",
			status: "doing" as const,
			priority: "high" as const,
			project: "/test",
			stories: [],
			...({ doingDate: "2026-01-01", doneDate: undefined, doingSessionId: undefined, doneBySessionId: undefined } as Partial<Epic>),
		} as unknown as Epic;
		updateItem({} as any, epic, { status: "done" }, "session-1");
		expect(epic.doneDate).toBe(today());
	});
});

// ── updateItem dependsOn ──

describe("updateItem() dependsOn", () => {
	it("设置 Epic 的 dependsOn", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1", eid: 1 }),
			makeEpic({ id: "E2", eid: 2, status: "done" }),
		]);
		const epic = rm.epics[0];
		const result = updateItem(rm, epic, { dependsOn: [2] }, "s1");
		expect(result).toContain("dependsOn");
		expect(epic.dependsOn).toEqual([2]);
	});

	it("设置 Story 的 dependsOn", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1", eid: 1 }, [
				makeStory({ id: "E1.S1", eid: 2 }),
				makeStory({ id: "E1.S2", eid: 3, status: "done" }),
			]),
		]);
		const story = rm.epics[0].stories[0];
		const result = updateItem(rm, story, { dependsOn: [3] }, "s1");
		expect(result).toContain("dependsOn");
		expect(story.dependsOn).toEqual([3]);
	});

	it("拒绝不存在的依赖 ID", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1", eid: 1 }, [makeStory({ id: "E1.S1", eid: 2 })]),
		]);
		const epic = rm.epics[0];
		const result = updateItem(rm, epic, { dependsOn: [999] }, "s1");
		expect(result).toContain("不存在");
		expect(epic.dependsOn).toBeUndefined();
	});

	it("拒绝循环依赖", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1", eid: 1 }, [makeStory({ id: "E1.S1", eid: 2 })]),
		]);
		// E1(eid=1) 依赖 E1.S1(eid=2), E1.S1(eid=2) 依赖 E1(eid=1) → 循环
		const story = rm.epics[0].stories[0];
		story.dependsOn = [1]; // story depends on epic
		const epic = rm.epics[0];
		const result = updateItem(rm, epic, { dependsOn: [2] }, "s1");
		expect(result).toContain("循环依赖");
		expect(epic.dependsOn).toBeUndefined();
	});
});

// ── updateTask dependsOn ──

describe("updateTask() dependsOn", () => {
	it("设置 Task 的 dependsOn", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1", eid: 1 }, [
				makeStory({ id: "E1.S1", eid: 2 }, [
					makeTask({ id: "E1.S1.T1", eid: 3 }),
					makeTask({ id: "E1.S1.T2", eid: 4, status: "done" }),
				]),
			]),
		]);
		const task = rm.epics[0].stories[0].tasks[0];
		const result = updateTask(rm, task, { dependsOn: [4] }, "s1");
		expect(result).toContain("dependsOn");
		expect(task.dependsOn).toEqual([4]);
	});

	it("拒绝不存在的依赖 ID", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1", eid: 1 }, [
				makeStory({ id: "E1.S1", eid: 2 }, [
					makeTask({ id: "E1.S1.T1", eid: 3 }),
				]),
			]),
		]);
		const task = rm.epics[0].stories[0].tasks[0];
		const result = updateTask(rm, task, { dependsOn: [999] }, "s1");
		expect(result).toContain("不存在");
		expect(task.dependsOn).toBeUndefined();
	});

	it("拒绝循环依赖", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1", eid: 1 }, [
				makeStory({ id: "E1.S1", eid: 2 }, [
					makeTask({ id: "E1.S1.T1", eid: 3 }),
					makeTask({ id: "E1.S1.T2", eid: 4 }),
				]),
			]),
		]);
		// T2(eid=4) 依赖 T1(eid=3), T1 依赖 T2 → 循环
		rm.epics[0].stories[0].tasks[1].dependsOn = [3];
		const task = rm.epics[0].stories[0].tasks[0];
		const result = updateTask(rm, task, { dependsOn: [4] }, "s1");
		expect(result).toContain("循环依赖");
		expect(task.dependsOn).toBeUndefined();
	});
});
