/**
 * store.ts 补充测试 — archive / normalize / 边界路径
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
	archiveRoadmap,
	unarchiveRoadmap,
	normalizeProjectPaths,
	getRoadmapFilePath,
} from "../lib/store";
import type { RoadmapFile } from "../lib/types";

const ROADMAPS_DIR = path.resolve(__dirname, "..", "..", "roadmaps");

describe("normalizeProjectPaths", () => {
	it("归一化 Windows 反斜杠路径", () => {
		const rm: RoadmapFile = {
			meta: {
				id: "t", title: "T", status: "active",
				created: "", updated: "",
			},
			epics: [{
				id: "E1", eid: 1, title: "E", description: "",
				status: "todo", priority: "high",
				project: "C:\\Users\\test\\project",
				stories: [],
			}],
		};
		const result = normalizeProjectPaths(rm);
		expect(result.epics[0].project).toBe(
			path.normalize("C:\\Users\\test\\project"),
		);
	});
});

describe("archiveRoadmap / unarchiveRoadmap", () => {
	const testId = "__test_archive_rm__";

	beforeEach(() => {
		// 清理
		const src = getRoadmapFilePath(testId);
		const archiveDir = path.join(ROADMAPS_DIR, "archive");
		const dst = path.join(archiveDir, `${testId}.json`);
		if (fs.existsSync(src)) fs.unlinkSync(src);
		if (fs.existsSync(dst)) fs.unlinkSync(dst);
	});

	afterEach(() => {
		// 清理
		const src = getRoadmapFilePath(testId);
		const archiveDir = path.join(ROADMAPS_DIR, "archive");
		const dst = path.join(archiveDir, `${testId}.json`);
		if (fs.existsSync(src)) fs.unlinkSync(src);
		if (fs.existsSync(dst)) fs.unlinkSync(dst);
	});

	it("归档不存在的 roadmap 返回 false", () => {
		expect(archiveRoadmap(testId)).toBe(false);
	});

	it("恢复不存在的归档返回 false", () => {
		expect(unarchiveRoadmap(testId)).toBe(false);
	});
});
