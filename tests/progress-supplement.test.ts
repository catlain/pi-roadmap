/**
 * 补充 progress.ts 测试 — getAllNextTasks / findTask / findStory / getStoriesForProject
 */
import { describe, expect, it } from "vitest";
import {
	calcEpicProgress,
	calcStoryProgress,
	findTask,
	getAllNextTasks,
	getNextTasks,
	getStoriesForProject,
} from "../lib/progress";
import type { RoadmapFile } from "../lib/types";
import { comparePriority, getEffectivePriority } from "../lib/types";

// 辅助构建函数
function makeTask(overrides: any = {}): any {
	return { id: "T1", title: "Task", status: "todo", ...overrides };
}
function makeStory(overrides: any = {}, tasks: any[] = []): any {
	return {
		id: "E1.S1",
		title: "Story",
		description: "",
		status: "todo",
		tasks,
		...overrides,
	};
}
function makeEpic(overrides: any = {}, stories: any[] = []): any {
	return {
		id: "E1",
		title: "Epic",
		description: "",
		status: "todo",
		priority: "medium",
		project: "/test",
		stories,
		...overrides,
	};
}

function makeRoadmap(epics: any[] = []): RoadmapFile {
	return {
		meta: {
			id: "test",
			title: "Test",
			status: "active",
			created: "2026-01-01",
			updated: "2026-01-01",
			tags: [],
		},
		epics,
	} as RoadmapFile;
}

describe("calcEpicProgress", () => {
	it("仅有 done 的 epic", () => {
		const epic = makeEpic({}, [makeStory({}, [makeTask({ status: "done" })])]);
		expect(calcEpicProgress(epic as any)).toEqual({
			total: 1,
			done: 1,
			percent: 100,
		});
	});
});

describe("calcStoryProgress", () => {
	it("空 story 返回 0%", () => {
		const story = makeStory({}, []);
		expect(calcStoryProgress(story as any)).toEqual({
			total: 0,
			done: 0,
			percent: 0,
		});
	});

	it("部分完成", () => {
		const story = makeStory({}, [
			makeTask({ status: "done" }),
			makeTask({ status: "todo" }),
		]);
		expect(calcStoryProgress(story as any)).toEqual({
			total: 2,
			done: 1,
			percent: 50,
		});
	});
});

describe("getAllNextTasks", () => {
	it("空数组返回空", () => {
		expect(getAllNextTasks([])).toEqual([]);
	});

	it("跳过非 active 的路线图", () => {
		const pausedRm = makeRoadmap([makeEpic({}, [makeStory({}, [makeTask()])])]);
		pausedRm.meta.status = "paused" as any;
		expect(getAllNextTasks([pausedRm])).toEqual([]);
	});

	it("从多个 active roadmap 合并", () => {
		const rm1 = makeRoadmap([
			makeEpic({ id: "E1" }, [
				makeStory({}, [makeTask({ id: "T1", status: "doing" })]),
			]),
		]);
		const rm2 = makeRoadmap([
			makeEpic({ id: "E2" }, [
				makeStory({}, [makeTask({ id: "T2", status: "todo" })]),
			]),
		]);
		rm2.meta.id = "rm2";
		const next = getAllNextTasks([rm1, rm2], 5);
		expect(next).toHaveLength(2);
	});

	it("按 limit 截断", () => {
		const rm = makeRoadmap([
			makeEpic({}, [
				makeStory({}, [
					makeTask({ id: "T1" }),
					makeTask({ id: "T2" }),
					makeTask({ id: "T3" }),
				]),
			]),
		]);
		expect(getAllNextTasks([rm], 2)).toHaveLength(2);
	});
});

describe("getNextTasks 优先级排序", () => {
	it("doing 优先于 todo", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1" }, [
				makeStory({ id: "E1.S1" }, [
					makeTask({ id: "E1.S1.T1", status: "todo", priority: "high" }),
					makeTask({ id: "E1.S1.T2", status: "doing", priority: "low" }),
				]),
			]),
		]);
		const tasks = getNextTasks(rm, 5);
		expect(tasks[0].id).toBe("E1.S1.T2"); // doing first
	});

	it("同 status 按有效优先级排序", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1" }, [
				makeStory({ id: "E1.S1" }, [
					makeTask({ id: "E1.S1.T1", status: "todo", priority: "low" }),
					makeTask({ id: "E1.S1.T2", status: "todo", priority: "high" }),
				]),
			]),
		]);
		const tasks = getNextTasks(rm, 5);
		expect(tasks[0].id).toBe("E1.S1.T2"); // high first
		expect(tasks[1].id).toBe("E1.S1.T1"); // low second
	});

	it("跳过 done/dropped 的 epic", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1", status: "done" }, [makeStory({}, [makeTask()])]),
		]);
		expect(getNextTasks(rm, 5)).toHaveLength(0);
	});

	it("跳过 done/dropped 的 story", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1" }, [
				makeStory({ id: "E1.S1", status: "done" }, [makeTask()]),
				makeStory({ id: "E1.S2" }, [makeTask({ id: "T1" })]),
			]),
		]);
		const tasks = getNextTasks(rm, 5);
		expect(tasks).toHaveLength(1);
		expect(tasks[0].id).toBe("T1");
	});
});

describe("findTask", () => {
	it("返回找到的 task 及其所在位置", () => {
		const rm = makeRoadmap([
			makeEpic({}, [makeStory({}, [makeTask({ id: "T1" })])]),
		]);
		const found = findTask(rm, "T1");
		expect(found).not.toBeNull();
		expect(found!.epic.id).toBe("E1");
		expect(found!.task.id).toBe("T1");
	});

	it("在多个 epic 中查找", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1" }, [makeStory({}, [makeTask({ id: "T1" })])]),
			makeEpic({ id: "E2" }, [makeStory({}, [makeTask({ id: "T2" })])]),
		]);
		expect(findTask(rm, "T2")?.epic.id).toBe("E2");
	});
});

describe("getStoriesForProject", () => {
	it("从多个 epic 中收集 project 匹配的 story", () => {
		const rm = makeRoadmap([
			makeEpic({ project: "/a" }, [
				makeStory({ id: "E1.S1" }),
				makeStory({ id: "E1.S2" }),
			]),
			makeEpic({ id: "E2", project: "/b" }, [makeStory({ id: "E2.S1" })]),
		]);
		const stories = getStoriesForProject(rm, "/a");
		expect(stories).toHaveLength(2);
		expect(stories[0].id).toBe("E1.S1");
	});
});

describe("getEffectivePriority / comparePriority", () => {
	it("own 优先于 parent", () => {
		expect(getEffectivePriority("high", "low")).toBe("high");
	});

	it("无 own 和 parent 时返回 medium", () => {
		expect(getEffectivePriority(undefined, undefined)).toBe("medium");
	});

	it("comparePriority: high < medium < low", () => {
		expect(comparePriority("high", "low")).toBeLessThan(0);
		expect(comparePriority("low", "high")).toBeGreaterThan(0);
		expect(comparePriority("medium", "medium")).toBe(0);
	});
});
