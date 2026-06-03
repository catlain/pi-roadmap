/**
 * 原子操作工具单元测试
 *
 * 测试 tools-atomic-utils 中的辅助函数和原子操作逻辑
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { atomicUpdate, getSessionId, today } from "../lib/tools-atomic-utils";
import type { RoadmapFile } from "../lib/types";
import { FILE_SUFFIX, GLOBAL_ROADMAP_DIR } from "../lib/types";

// ── 辅助函数 ──

const TEST_RM_ID = "test-atomic";
const TEST_RM_PATH = path.join(
	GLOBAL_ROADMAP_DIR,
	`${TEST_RM_ID}${FILE_SUFFIX}`,
);

function createTestRoadmap(): RoadmapFile {
	return {
		meta: {
			id: TEST_RM_ID,
			title: "测试路线图",
			status: "active",
			created: "2026-01-01T00:00:00.000Z",
			updated: "2026-01-01T00:00:00.000Z",
			tags: [],
		},
		epics: [
			{
				id: "E1",
				title: "Epic 1",
				description: "测试Epic",
				status: "todo",
				priority: "high",
				project: "/test",
				createdDate: "2026-01-01",
				stories: [
					{
						id: "E1.S1",
						title: "Story 1",
						description: "测试Story",
						status: "todo",
						createdDate: "2026-01-01",
						tasks: [
							{
								id: "E1.S1.T1",
								title: "Task 1",
								status: "todo",
								createdDate: "2026-01-01",
							},
							{
								id: "E1.S1.T2",
								title: "Task 2",
								status: "done",
								createdDate: "2026-01-01",
								doneDate: "2026-01-02",
							},
						],
					},
					{
						id: "E1.S2",
						title: "Story 2",
						description: "已完成Story",
						status: "done",
						createdDate: "2026-01-01",
						doneDate: "2026-01-03",
						tasks: [
							{
								id: "E1.S2.T1",
								title: "Task done",
								status: "done",
								createdDate: "2026-01-01",
								doneDate: "2026-01-03",
							},
						],
					},
				],
			},
			{
				id: "E2",
				title: "Epic 2（归档）",
				description: "已归档Epic",
				status: "done",
				priority: "medium",
				project: "/test",
				createdDate: "2026-01-01",
				doneDate: "2026-01-05",
				archived: true,
				stories: [
					{
						id: "E2.S1",
						title: "Archived Story",
						description: "",
						status: "done",
						createdDate: "2026-01-01",
						doneDate: "2026-01-05",
						archived: true,
						tasks: [
							{
								id: "E2.S1.T1",
								title: "Archived Task",
								status: "done",
								createdDate: "2026-01-01",
								doneDate: "2026-01-05",
								archived: true,
							},
						],
					},
				],
			},
		],
	};
}

function writeTestRoadmap() {
	if (!fs.existsSync(GLOBAL_ROADMAP_DIR))
		fs.mkdirSync(GLOBAL_ROADMAP_DIR, { recursive: true });
	fs.writeFileSync(
		TEST_RM_PATH,
		JSON.stringify(createTestRoadmap(), null, "\t"),
		"utf-8",
	);
}

function removeTestRoadmap() {
	if (fs.existsSync(TEST_RM_PATH)) fs.unlinkSync(TEST_RM_PATH);
}

function readTestRoadmap(): RoadmapFile | null {
	if (!fs.existsSync(TEST_RM_PATH)) return null;
	return JSON.parse(fs.readFileSync(TEST_RM_PATH, "utf-8"));
}

// ── today() ──

describe("today()", () => {
	it("返回 YYYY-MM-DD 格式", () => {
		const result = today();
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

// ── getSessionId() ──

describe("getSessionId()", () => {
	it("无 ctx 时返回 unknown", () => {
		expect(getSessionId(null)).toBe("unknown");
		expect(getSessionId(undefined)).toBe("unknown");
		expect(getSessionId({})).toBe("unknown");
	});
});

// ── atomicUpdate() ──

describe("atomicUpdate()", () => {
	beforeEach(writeTestRoadmap);
	afterEach(removeTestRoadmap);

	it("不存在路线图时报错", () => {
		const result = atomicUpdate("nonexistent", () => "ok");
		expect(result).toContain("错误");
	});

	it("修改后自动更新 meta.updated", () => {
		const _before = readTestRoadmap()!.meta.updated;
		atomicUpdate(TEST_RM_ID, () => "done");
		const after = readTestRoadmap()!.meta.updated;
		// updated 应该变了（或至少不比之前早）
		expect(after).not.toBe("2026-01-01T00:00:00.000Z");
	});

	it("fn 返回值透传", () => {
		const result = atomicUpdate(TEST_RM_ID, (rm) => {
			rm.epics[0].title = "Modified";
			return "修改成功";
		});
		expect(result).toBe("修改成功");
		expect(readTestRoadmap()!.epics[0].title).toBe("Modified");
	});
});
