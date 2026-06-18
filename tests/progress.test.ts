/**
 * 测试 progress.ts — 进度计算与任务提取
 */

import { describe, expect, it } from "vitest";
import {
	calcEpicProgress,
	calcProgress,
	calcStoryProgress,
	findEpic,
	findStory,
	findTask,
	getNextTasks,
	getStoriesForProject,
} from "../lib/progress";
import type { Epic, RoadmapFile, Story, Task } from "../lib/types";

function makeTask(overrides: Partial<Task> & { id: string }): Task {
	return { title: `Task ${overrides.id}`, status: "todo", eid: 1, ...overrides };
}

function makeStory(
	overrides: Partial<Story> & { id: string },
	tasks: Task[] = [],
): Story {
	return {
		title: `Story ${overrides.id}`,
		description: "",
		status: "todo",
		createdDate: "2025-01-01",
		tasks,
		eid: 1,
		...overrides,
	};
}

function makeEpic(
	overrides: Partial<Epic> & { id: string },
	stories: Story[] = [],
): Epic {
	return {
		title: `Epic ${overrides.id}`,
		description: "",
		status: "todo",
		priority: "medium",
		project: "/test",
		createdDate: "2025-01-01",
		stories,
		eid: 1,
		...overrides,
	};
}

function makeRoadmap(epics: Epic[] = []): RoadmapFile {
	return {
		meta: {
			id: "test",
			title: "Test",
			status: "active",
			created: "2025-01-01T00:00:00Z",
			updated: "2025-01-01T00:00:00Z",
			tags: [],
			nextEid: 100,
		},
		epics,
	};
}

// ── calcProgress ──

describe("calcProgress", () => {
	it("returns 0% for empty roadmap", () => {
		expect(calcProgress(makeRoadmap())).toEqual({
			total: 0,
			done: 0,
			percent: 0,
		});
	});

	it("calculates correct progress", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1" }, [
				makeStory({ id: "E1.S1" }, [
					makeTask({ id: "E1.S1.T1", status: "done" }),
					makeTask({ id: "E1.S1.T2", status: "todo" }),
					makeTask({ id: "E1.S1.T3", status: "done" }),
				]),
			]),
		]);
		expect(calcProgress(rm)).toEqual({ total: 3, done: 2, percent: 67 });
	});
});

// ── calcEpicProgress ──

describe("calcEpicProgress", () => {
	it("returns 0% for empty epic", () => {
		expect(calcEpicProgress(makeEpic({ id: "E1" }))).toEqual({
			total: 0,
			done: 0,
			percent: 0,
		});
	});

	it("calculates epic progress", () => {
		const epic = makeEpic({ id: "E1" }, [
			makeStory({ id: "E1.S1" }, [
				makeTask({ id: "E1.S1.T1", status: "done" }),
				makeTask({ id: "E1.S1.T2", status: "done" }),
			]),
			makeStory({ id: "E1.S2" }, [
				makeTask({ id: "E1.S2.T1", status: "todo" }),
			]),
		]);
		expect(calcEpicProgress(epic)).toEqual({ total: 3, done: 2, percent: 67 });
	});
});

// ── calcStoryProgress ──

describe("calcStoryProgress", () => {
	it("returns 100% when all done", () => {
		const story = makeStory({ id: "E1.S1" }, [
			makeTask({ id: "E1.S1.T1", status: "done" }),
			makeTask({ id: "E1.S1.T2", status: "done" }),
		]);
		expect(calcStoryProgress(story)).toEqual({
			total: 2,
			done: 2,
			percent: 100,
		});
	});
});

// ── getNextTasks ──

describe("getNextTasks", () => {
	it("returns empty for empty roadmap", () => {
		expect(getNextTasks(makeRoadmap())).toEqual([]);
	});

	it("returns doing tasks before todo", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1" }, [
				makeStory({ id: "E1.S1" }, [
					makeTask({ id: "E1.S1.T1", status: "todo", priority: "high" }),
					makeTask({ id: "E1.S1.T2", status: "doing" }),
				]),
			]),
		]);
		const next = getNextTasks(rm, 5);
		expect(next[0].id).toBe("E1.S1.T2"); // doing first
		expect(next[1].id).toBe("E1.S1.T1");
	});

	it("skips done/dropped epics and stories", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1", status: "done" }, [
				makeStory({ id: "E1.S1" }, [
					makeTask({ id: "E1.S1.T1", status: "todo" }),
				]),
			]),
			makeEpic({ id: "E2" }, [
				makeStory({ id: "E2.S1", status: "dropped" }, [
					makeTask({ id: "E2.S1.T1", status: "todo" }),
				]),
				makeStory({ id: "E2.S2" }, [
					makeTask({ id: "E2.S2.T1", status: "todo" }),
				]),
			]),
		]);
		const next = getNextTasks(rm, 5);
		expect(next).toHaveLength(1);
		expect(next[0].id).toBe("E2.S2.T1");
	});

	it("respects limit", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1" }, [
				makeStory({ id: "E1.S1" }, [
					makeTask({ id: "E1.S1.T1", status: "todo" }),
					makeTask({ id: "E1.S1.T2", status: "todo" }),
					makeTask({ id: "E1.S1.T3", status: "todo" }),
				]),
			]),
		]);
		expect(getNextTasks(rm, 2)).toHaveLength(2);
	});
});

// ── findTask / findStory / findEpic ──

describe("findTask", () => {
	it("finds existing task", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1" }, [
				makeStory({ id: "E1.S1" }, [makeTask({ id: "E1.S1.T1" })]),
			]),
		]);
		const found = findTask(rm, "E1.S1.T1");
		expect(found).not.toBeNull();
		expect(found!.task.id).toBe("E1.S1.T1");
		expect(found!.epic.id).toBe("E1");
	});

	it("returns null for missing task", () => {
		expect(findTask(makeRoadmap(), "E1.S1.T1")).toBeNull();
	});
});

describe("findStory", () => {
	it("finds existing story", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" })]),
		]);
		const found = findStory(rm, "E1.S1");
		expect(found).not.toBeNull();
		expect(found!.story.id).toBe("E1.S1");
	});
});

describe("findEpic", () => {
	it("finds existing epic", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" })]);
		expect(findEpic(rm, "E1")).not.toBeNull();
		expect(findEpic(rm, "E99")).toBeNull();
	});
});

// ── getStoriesForProject ──

describe("getStoriesForProject", () => {
	it("returns stories for matching project", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1", project: "/proj-a" }, [
				makeStory({ id: "E1.S1" }),
				makeStory({ id: "E1.S2" }),
			]),
			makeEpic({ id: "E2", project: "/proj-b" }, [makeStory({ id: "E2.S1" })]),
		]);
		const stories = getStoriesForProject(rm, "/proj-a");
		expect(stories).toHaveLength(2);
		expect(stories[0].id).toBe("E1.S1");
	});

	it("returns empty for non-matching project", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1", project: "/proj-a" })]);
		expect(getStoriesForProject(rm, "/proj-b")).toHaveLength(0);
	});
});
