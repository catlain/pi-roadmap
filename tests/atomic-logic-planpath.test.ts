/**
 * 测试 addEpic/addStory/addTask 的 planPath 参数
 */
import { describe, expect, it } from "vitest";
import {
	addEpic,
	addStory,
	addTask,
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

// ── addEpic planPath ──

describe("addEpic planPath", () => {
	it("stores planPath when provided", () => {
		const rm = makeRoadmap();
		const { result } = addEpic(rm, "Epic", "Desc", undefined, "/proj", "E1.md");
		expect(rm.epics[0].planPath).toBe("E1.md");
		expect(result).toContain("E1.md");
	});

	it("does not set planPath when omitted", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", undefined, "/proj");
		expect(rm.epics[0].planPath).toBeUndefined();
	});
});

// ── addStory planPath ──

describe("addStory planPath", () => {
	it("stores planPath when provided", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", undefined, "/p");
		const { result } = addStory(rm, "E1", "Story", "Desc", undefined, "E1-S1.md");
		expect(rm.epics[0].stories[0].planPath).toBe("E1-S1.md");
		expect(result).toContain("E1-S1.md");
	});

	it("does not set planPath when omitted", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", undefined, "/p");
		addStory(rm, "E1", "Story", "Desc");
		expect(rm.epics[0].stories[0].planPath).toBeUndefined();
	});
});

// ── addTask planPath ──

describe("addTask planPath", () => {
	it("stores planPath when provided", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", undefined, "/p");
		addStory(rm, "E1", "Story", "Desc");
		const { result } = addTask(rm, "E1.S1", "Task", undefined, undefined, "E1-S1-T1.md");
		expect(rm.epics[0].stories[0].tasks[0].planPath).toBe("E1-S1-T1.md");
		expect(result).toContain("E1-S1-T1.md");
	});

	it("does not set planPath when omitted", () => {
		const rm = makeRoadmap();
		addEpic(rm, "Epic", "Desc", undefined, "/p");
		addStory(rm, "E1", "Story", "Desc");
		addTask(rm, "E1.S1", "Task", undefined);
		expect(rm.epics[0].stories[0].tasks[0].planPath).toBeUndefined();
	});
});
