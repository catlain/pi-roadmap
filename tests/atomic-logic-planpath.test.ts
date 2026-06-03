/**
 * 测试 addEpic/addStory/addTask 的 planPath 参数
 */
import { describe, expect, it } from "vitest";
import { addEpic, addStory, addTask } from "../lib/tools-atomic-logic";
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

// ── addEpic planPath ──

describe("addEpic planPath", () => {
	it("stores planPath when provided", () => {
		const rm = makeRoadmap();
		const { result, epicId } = addEpic(
			rm,
			"Epic",
			"Desc",
			undefined,
			"/proj",
			"E1.md",
		);
		expect(epicId).toBe("E1");
		expect(rm.epics[0].planPath).toBe("E1.md");
		expect(result).toContain("E1.md");
	});

	it("rejects without planPath", () => {
		const rm = makeRoadmap();
		const { result, epicId } = addEpic(rm, "Epic", "Desc", undefined, "/proj");
		expect(epicId).toBeUndefined();
		expect(rm.epics).toHaveLength(0);
		expect(result).toContain("必须关联计划文档");
	});
});

// ── addStory planPath ──

describe("addStory planPath", () => {
	it("stores planPath when provided", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", undefined, "/p", "E1.md");
		const { result, storyId } = addStory(
			rm,
			"E1",
			"Story",
			"Desc",
			undefined,
			"E1-S1.md",
		);
		expect(storyId).toBe("E1.S1");
		expect(rm.epics[0].stories[0].planPath).toBe("E1-S1.md");
		expect(result).toContain("E1-S1.md");
	});

	it("rejects without planPath", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", undefined, "/p", "E1.md");
		const { result, storyId } = addStory(rm, "E1", "Story", "Desc");
		expect(storyId).toBeUndefined();
		expect(rm.epics[0].stories).toHaveLength(0);
		expect(result).toContain("必须关联计划文档");
	});
});

// ── addTask planPath ──

describe("addTask planPath", () => {
	it("stores planPath when provided", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", undefined, "/p", "E1.md");
		addStory(rm, "E1", "Story", "Desc", undefined, "E1-S1.md");
		const { result } = addTask(
			rm,
			"E1.S1",
			"Task",
			undefined,
			undefined,
			"E1-S1-T1.md",
		);
		expect(rm.epics[0].stories[0].tasks[0].planPath).toBe("E1-S1-T1.md");
		expect(result).toContain("E1-S1-T1.md");
	});

	it("does not require planPath", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", undefined, "/p", "E1.md");
		addStory(rm, "E1", "Story", "Desc", undefined, "E1-S1.md");
		addTask(rm, "E1.S1", "Task", undefined);
		expect(rm.epics[0].stories[0].tasks[0].planPath).toBeUndefined();
	});
});
