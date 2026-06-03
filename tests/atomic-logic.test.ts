/**
 * 测试 tools-atomic-logic.ts — 纯逻辑函数（无 pi API 依赖）
 */

import { describe, expect, it } from "vitest";
import {
	addEpic,
	addStory,
	addTask,
	archiveAllDone,
	archiveEpic,
	checkArchiveableEpics,
	createRoadmap,
	getArchivedEpics,
	markTaskDone,
} from "../lib/tools-atomic-logic";
import type { RoadmapFile } from "../lib/types";

function makeRoadmap(): RoadmapFile {
	return {
		meta: {
			id: "test",
			title: "Test",
			status: "active",
			created: "2025-01-01T00:00:00Z",
			updated: "2025-01-01T00:00:00Z",
			tags: [],
		},
		epics: [],
	};
}

function makeRoadmapWithDoneTasks(): RoadmapFile {
	const rm = makeRoadmap();
	rm.epics.push({
		id: "E1",
		title: "Done Epic",
		description: "",
		status: "todo",
		priority: "medium",
		project: "/test",
		createdDate: "2025-01-01",
		stories: [
			{
				id: "E1.S1",
				title: "Done Story",
				description: "",
				status: "todo",
				createdDate: "2025-01-01",
				tasks: [
					{
						id: "E1.S1.T1",
						title: "Done Task",
						status: "done",
						doneDate: "2025-01-02",
					},
					{
						id: "E1.S1.T2",
						title: "Done Task 2",
						status: "done",
						doneDate: "2025-01-02",
					},
				],
			},
		],
	});
	rm.epics.push({
		id: "E2",
		title: "Active Epic",
		description: "",
		status: "doing",
		priority: "high",
		project: "/test",
		createdDate: "2025-01-01",
		stories: [
			{
				id: "E2.S1",
				title: "Active Story",
				description: "",
				status: "todo",
				createdDate: "2025-01-01",
				tasks: [{ id: "E2.S1.T1", title: "Active Task", status: "todo" }],
			},
		],
	});
	return rm;
}

// ── createRoadmap ──

describe("createRoadmap", () => {
	it("creates a roadmap with correct meta", () => {
		const rm = createRoadmap("my-plan", "My Plan", ["tag1"]);
		expect(rm.meta.id).toBe("my-plan");
		expect(rm.meta.title).toBe("My Plan");
		expect(rm.meta.tags).toEqual(["tag1"]);
		expect(rm.meta.status).toBe("active");
		expect(rm.epics).toEqual([]);
	});

	it("defaults tags to empty array", () => {
		const rm = createRoadmap("x", "X");
		expect(rm.meta.tags).toEqual([]);
	});
});

// ── addEpic ──

describe("addEpic", () => {
	it("adds first epic with ID E1", () => {
		const rm = makeRoadmap();
		const { result, epicId } = addEpic(
			rm,
			"Build feature",
			"Description",
			"high",
			"/proj",
			"E1.md",
		);
		expect(epicId).toBe("E1");
		expect(result).toContain("E1");
		expect(rm.epics).toHaveLength(1);
		expect(rm.epics[0].title).toBe("Build feature");
		expect(rm.epics[0].priority).toBe("high");
		expect(rm.epics[0].project).toBe("/proj");
		expect(rm.epics[0].createdDate).toBeTruthy();
	});

	it("auto-increments epic ID", () => {
		const rm = makeRoadmap();
		addEpic(rm, "First", "", undefined, "/p", "E1.md");
		const { epicId } = addEpic(rm, "Second", "", undefined, "/p", "E2.md");
		expect(epicId).toBe("E2");
	});

	it("defaults priority to medium", () => {
		const rm = makeRoadmap();
		addEpic(rm, "E", "", undefined, "/p", "E.md");
		expect(rm.epics[0].priority).toBe("medium");
	});
});

// ── addStory ──

describe("addStory", () => {
	it("adds story to correct epic", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "", undefined, "/p", "E.md");
		const { result, storyId } = addStory(
			rm,
			"E1",
			"Story 1",
			"Desc",
			undefined,
			"S.md",
		);
		expect(storyId).toBe("E1.S1");
		expect(result).toContain("E1.S1");
		expect(rm.epics[0].stories).toHaveLength(1);
		expect(rm.epics[0].stories[0].createdDate).toBeTruthy();
	});

	it("auto-increments story ID", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "", undefined, "/p", "E.md");
		addStory(rm, "E1", "S1", "", undefined, "S1.md");
		const { storyId } = addStory(rm, "E1", "S2", "", undefined, "S2.md");
		expect(storyId).toBe("E1.S2");
	});

	it("returns error for non-existent epic", () => {
		const rm = makeRoadmap();
		const { result } = addStory(rm, "E99", "Story", "", undefined, "S.md");
		expect(result).toContain("错误");
	});

	it("rejects adding story to archived epic", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", "medium", "project", "E.md");
		rm.epics[0].archived = true;
		const { result } = addStory(rm, "E1", "Story", "", undefined, "S.md");
		expect(result).toContain("已归档");
		expect(rm.epics[0].stories).toHaveLength(0);
	});

	it("allows adding story to done epic (not archived)", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", "medium", "project", "E.md");
		rm.epics[0].status = "done";
		const { result } = addStory(rm, "E1", "Story", "", undefined, "S.md");
		expect(result).toContain("已添加");
		expect(rm.epics[0].stories).toHaveLength(1);
	});

	it("rejects adding story to dropped epic", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", "medium", "project", "E.md");
		rm.epics[0].status = "dropped";
		const { result } = addStory(rm, "E1", "Story", "", undefined, "S.md");
		expect(result).toContain("dropped");
		expect(rm.epics[0].stories).toHaveLength(0);
	});

	it("warns when adding story with duplicate title", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", "medium", "/p", "E.md");
		addStory(rm, "E1", "Same Title", "First", undefined, "S1.md");
		const { result, storyId } = addStory(
			rm,
			"E1",
			"Same Title",
			"Second",
			undefined,
			"S2.md",
		);
		// 警告信息
		expect(result).toContain("E1 下已存在同名 Story");
		expect(result).toContain("Same Title");
		// 但不阻止添加
		expect(storyId).toBe("E1.S2");
		expect(result).toContain("✅");
		expect(rm.epics[0].stories).toHaveLength(2);
	});
});

// ── addTask ──

describe("addTask", () => {
	it("adds task to correct story", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "", undefined, "/p", "E.md");
		addStory(rm, "E1", "Story", "", undefined, "S.md");
		const { result, taskId } = addTask(rm, "E1.S1", "Do thing", "high");
		expect(taskId).toBe("E1.S1.T1");
		expect(result).toContain("E1.S1.T1");
		expect(rm.epics[0].stories[0].tasks).toHaveLength(1);
		expect(rm.epics[0].stories[0].tasks[0].priority).toBe("high");
		expect(rm.epics[0].stories[0].tasks[0].createdDate).toBeTruthy();
	});

	it("auto-increments task ID", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "", undefined, "/p", "E.md");
		addStory(rm, "E1", "Story", "", undefined, "S.md");
		addTask(rm, "E1.S1", "T1", undefined);
		const { taskId } = addTask(rm, "E1.S1", "T2", undefined);
		expect(taskId).toBe("E1.S1.T2");
	});

	it("returns error for non-existent story", () => {
		const rm = makeRoadmap();
		const { result } = addTask(rm, "E1.S99", "Task", undefined);
		expect(result).toContain("错误");
	});

	it("rejects adding task to archived story", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", "medium", "project", "E.md");
		addStory(rm, "E1", "Story", "", undefined, "S.md");
		rm.epics[0].stories[0].archived = true;
		const { result } = addTask(rm, "E1.S1", "Task", undefined);
		expect(result).toContain("已归档");
		expect(rm.epics[0].stories[0].tasks).toHaveLength(0);
	});

	it("allows adding task to done story (not archived)", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", "medium", "project", "E.md");
		addStory(rm, "E1", "Story", "", undefined, "S.md");
		rm.epics[0].stories[0].status = "done";
		const { result } = addTask(rm, "E1.S1", "Task", undefined);
		expect(result).toContain("已添加");
		expect(rm.epics[0].stories[0].tasks).toHaveLength(1);
	});

	it("rejects adding task when parent epic is archived", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", "medium", "project", "E.md");
		addStory(rm, "E1", "Story", "", undefined, "S.md");
		rm.epics[0].archived = true;
		const { result } = addTask(rm, "E1.S1", "Task", undefined);
		expect(result).toContain("Epic");
		expect(result).toContain("已归档");
		expect(rm.epics[0].stories[0].tasks).toHaveLength(0);
	});

	it("allows adding task when parent epic is done (not archived)", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", "medium", "project", "E.md");
		addStory(rm, "E1", "Story", "", undefined, "S.md");
		rm.epics[0].status = "done";
		const { result } = addTask(rm, "E1.S1", "Task", undefined);
		expect(result).toContain("已添加");
		expect(rm.epics[0].stories[0].tasks).toHaveLength(1);
	});

	it("warns when adding task with duplicate title", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", "medium", "/p", "E.md");
		addStory(rm, "E1", "Story", "", undefined, "S.md");
		addTask(rm, "E1.S1", "Same Task", undefined);
		const { result, taskId } = addTask(rm, "E1.S1", "Same Task", undefined);
		// 警告信息
		expect(result).toContain("E1.S1 下已存在同名 Task");
		expect(result).toContain("Same Task");
		// 但不阻止添加
		expect(taskId).toBe("E1.S1.T2");
		expect(result).toContain("✅");
		expect(rm.epics[0].stories[0].tasks).toHaveLength(2);
	});
});

// ── archiveEpic ──

describe("archiveEpic", () => {
	it("archives a done epic and all its children", () => {
		const rm = makeRoadmapWithDoneTasks();
		// 先标记 E1 story 为 done
		rm.epics[0].status = "done";
		const { result, archivedIds } = archiveEpic(rm, "E1");
		expect(archivedIds).toEqual(["E1"]);
		expect(rm.epics[0].archived).toBe(true);
		expect(rm.epics[0].stories[0].archived).toBe(true);
		expect(rm.epics[0].stories[0].tasks[0].archived).toBe(true);
	});

	it("refuses to archive a non-done epic", () => {
		const rm = makeRoadmapWithDoneTasks();
		const { result, archivedIds } = archiveEpic(rm, "E2");
		expect(archivedIds).toHaveLength(0);
		expect(rm.epics[1].archived).toBeUndefined();
	});

	it("returns error for non-existent epic", () => {
		const rm = makeRoadmap();
		const { result } = archiveEpic(rm, "E99");
		expect(result).toContain("错误");
	});
});

// ── archiveAllDone ──

describe("archiveAllDone", () => {
	it("archives all fully done epics", () => {
		const rm = makeRoadmapWithDoneTasks();
		const { result, archivedIds } = archiveAllDone(rm);
		expect(archivedIds).toContain("E1: Done Epic");
		expect(rm.epics[0].archived).toBe(true);
		// E2 is not done
		expect(rm.epics[1].archived).toBeUndefined();
	});

	it("skips already archived epics", () => {
		const rm = makeRoadmapWithDoneTasks();
		rm.epics[0].archived = true;
		const { archivedIds } = archiveAllDone(rm);
		expect(archivedIds).toHaveLength(0);
	});

	it("returns message when nothing to archive", () => {
		const rm = makeRoadmap();
		const { result } = archiveAllDone(rm);
		expect(result).toContain("没有可归档");
	});
});

// ── getArchivedEpics ──

describe("getArchivedEpics", () => {
	it("lists archived epics", () => {
		const rm = makeRoadmapWithDoneTasks();
		rm.epics[0].archived = true;
		const lines = getArchivedEpics(rm);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain("E1");
		expect(lines[0]).toContain("Done Epic");
	});

	it("returns empty when none archived", () => {
		const rm = makeRoadmapWithDoneTasks();
		expect(getArchivedEpics(rm)).toHaveLength(0);
	});
});

// ── markTaskDone ──

describe("markTaskDone", () => {
	it("marks a task done with timestamps", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "", undefined, "/p", "E.md");
		addStory(rm, "E1", "Story", "", undefined, "S.md");
		addTask(rm, "E1.S1", "Task 1", undefined);

		const { result, doneTaskId, cascadeInfo } = markTaskDone(
			rm,
			"E1.S1.T1",
			"sess-123",
		);
		expect(doneTaskId).toBe("E1.S1.T1");
		expect(result).toContain("已完成");
		const task = rm.epics[0].stories[0].tasks[0];
		expect(task.status).toBe("done");
		expect(task.doneDate).toBeTruthy();
		expect(task.doneBySessionId).toBe("sess-123");
		expect(cascadeInfo).toHaveLength(2); // story + epic cascade
		expect(cascadeInfo[0]).toContain("Story E1.S1");
		expect(cascadeInfo[1]).toContain("Epic E1");
	});

	it("marks task done without cascade when other tasks remain", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "", undefined, "/p", "E.md");
		addStory(rm, "E1", "Story", "", undefined, "S.md");
		addTask(rm, "E1.S1", "Task 1", undefined);
		addTask(rm, "E1.S1", "Task 2", undefined);

		const { cascadeInfo } = markTaskDone(rm, "E1.S1.T1", "sess");
		expect(cascadeInfo).toHaveLength(0);
		expect(rm.epics[0].status).toBe("todo");
	});

	it("returns error for non-existent task", () => {
		const rm = makeRoadmap();
		const { result } = markTaskDone(rm, "E99.S1.T1", "sess");
		expect(result).toContain("错误");
	});

	it("clears doingSessionId on done", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "", undefined, "/p", "E.md");
		addStory(rm, "E1", "Story", "", undefined, "S.md");
		addTask(rm, "E1.S1", "Task 1", undefined);
		rm.epics[0].stories[0].tasks[0].doingSessionId = "sess-old";

		markTaskDone(rm, "E1.S1.T1", "sess-new");
		const task = rm.epics[0].stories[0].tasks[0];
		expect(task.doingSessionId).toBeUndefined();
		expect(task.doneBySessionId).toBe("sess-new");
	});
});

// ── checkArchiveableEpics ──
describe("checkArchiveableEpics", () => {
	const baseEpic2 = {
		id: "E1",
		title: "Test Epic",
		description: "",
		status: "todo" as const,
		priority: "medium" as const,
		project: "/test",
		stories: [] as any[],
	};
	const baseStory2 = {
		id: "E1.S1",
		title: "Test Story",
		description: "",
		status: "todo" as const,
		tasks: [] as any[],
	};
	const baseTask2 = {
		id: "E1.S1.T1",
		title: "Test Task",
		status: "todo" as const,
	};

	it("无可归档项时返回 undefined", () => {
		const result = checkArchiveableEpics([
			{
				epics: [
					{
						...baseEpic2,
						status: "doing",
						stories: [
							{
								...baseStory2,
								status: "doing",
								tasks: [{ ...baseTask2, status: "doing" }],
							},
						],
					},
				],
			},
		]);
		expect(result).toBeUndefined();
	});

	it("全部完成的 Epic 返回归档提示", () => {
		const result = checkArchiveableEpics([
			{
				epics: [
					{
						...baseEpic2,
						id: "E1",
						title: "已完成 Epic",
						stories: [
							{
								...baseStory2,
								status: "done",
								tasks: [{ ...baseTask2, status: "done" }],
							},
						],
					},
				],
			},
		]);
		expect(result).toContain("E1: 已完成 Epic");
		expect(result).toContain("roadmap_archive");
	});

	it("已归档的 Epic 不提示", () => {
		const result = checkArchiveableEpics([
			{
				epics: [
					{
						...baseEpic2,
						archived: true,
						stories: [
							{
								...baseStory2,
								status: "done",
								tasks: [{ ...baseTask2, status: "done" }],
							},
						],
					},
				],
			},
		]);
		expect(result).toBeUndefined();
	});

	it("部分完成的 Epic 不提示", () => {
		const result = checkArchiveableEpics([
			{
				epics: [
					{
						...baseEpic2,
						stories: [
							{
								...baseStory2,
								status: "done",
								tasks: [{ ...baseTask2, status: "done" }],
							},
							{
								...baseStory2,
								id: "E1.S2",
								status: "doing",
								tasks: [{ ...baseTask2, id: "E1.S2.T1", status: "doing" }],
							},
						],
					},
				],
			},
		]);
		expect(result).toBeUndefined();
	});

	it("空 Epic（0 tasks）不提示", () => {
		const result = checkArchiveableEpics([
			{
				epics: [{ ...baseEpic2, stories: [] }],
			},
		]);
		expect(result).toBeUndefined();
	});
});
