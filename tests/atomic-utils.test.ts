/**
 * 原子操作工具单元测试
 *
 * 测试 tools-atomic-utils 中的辅助函数和原子操作逻辑
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { GLOBAL_ROADMAP_DIR, FILE_SUFFIX } from "../lib/types";
import type { RoadmapFile } from "../lib/types";
import { today, getSessionId, atomicUpdate, updateItem, updateTask } from "../lib/tools-atomic-utils";

// ── 辅助函数 ──

const TEST_RM_ID = "test-atomic";
const TEST_RM_PATH = path.join(GLOBAL_ROADMAP_DIR, `${TEST_RM_ID}${FILE_SUFFIX}`);

function createTestRoadmap(): RoadmapFile {
	return {
		meta: { id: TEST_RM_ID, title: "测试路线图", status: "active", created: "2026-01-01T00:00:00.000Z", updated: "2026-01-01T00:00:00.000Z", tags: [] },
		epics: [
			{
				id: "E1", title: "Epic 1", description: "测试Epic", status: "todo",
				priority: "high", project: "/test", createdDate: "2026-01-01",
				stories: [
					{
						id: "E1.S1", title: "Story 1", description: "测试Story", status: "todo",
						createdDate: "2026-01-01",
						tasks: [
							{ id: "E1.S1.T1", title: "Task 1", status: "todo", createdDate: "2026-01-01" },
							{ id: "E1.S1.T2", title: "Task 2", status: "done", createdDate: "2026-01-01", doneDate: "2026-01-02" },
						],
					},
					{
						id: "E1.S2", title: "Story 2", description: "已完成Story", status: "done",
						createdDate: "2026-01-01", doneDate: "2026-01-03",
						tasks: [
							{ id: "E1.S2.T1", title: "Task done", status: "done", createdDate: "2026-01-01", doneDate: "2026-01-03" },
						],
					},
				],
			},
			{
				id: "E2", title: "Epic 2（归档）", description: "已归档Epic", status: "done",
				priority: "medium", project: "/test", createdDate: "2026-01-01",
				doneDate: "2026-01-05", archived: true,
				stories: [
					{
						id: "E2.S1", title: "Archived Story", description: "", status: "done",
						createdDate: "2026-01-01", doneDate: "2026-01-05", archived: true,
						tasks: [
							{ id: "E2.S1.T1", title: "Archived Task", status: "done", createdDate: "2026-01-01", doneDate: "2026-01-05", archived: true },
						],
					},
				],
			},
		],
	};
}

function writeTestRoadmap() {
	if (!fs.existsSync(GLOBAL_ROADMAP_DIR)) fs.mkdirSync(GLOBAL_ROADMAP_DIR, { recursive: true });
	fs.writeFileSync(TEST_RM_PATH, JSON.stringify(createTestRoadmap(), null, "\t"), "utf-8");
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
		const before = readTestRoadmap()!.meta.updated;
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

// ── updateTask() ──

describe("updateTask()", () => {
	it("更新 title", () => {
		const task = { id: "E1.S1.T1", title: "Old", status: "todo" as const };
		const result = updateTask(task, { title: "New" }, "session-1");
		expect(result).toContain("title");
		expect(task.title).toBe("New");
	});

	it("status→doing 填 doingDate 和 doingSessionId", () => {
		const task = { id: "E1.S1.T1", title: "T1", status: "todo" as const };
		updateTask(task, { status: "doing" }, "session-123");
		expect(task.doingDate).toBe(today());
		expect(task.doingSessionId).toBe("session-123");
	});

	it("status→done 填 doneDate 和 doneBySessionId，清 doingSessionId", () => {
		const task = { id: "E1.S1.T1", title: "T1", status: "doing" as const, doingDate: "2026-01-01", doingSessionId: "old" };
		updateTask(task, { status: "done" }, "session-456");
		expect(task.doneDate).toBe(today());
		expect(task.doneBySessionId).toBe("session-456");
		expect(task.doingSessionId).toBeUndefined();
	});

	it("更新 note", () => {
		const task = { id: "E1.S1.T1", title: "T1", status: "todo" as const };
		updateTask(task, { note: "测试备注" }, "session-1");
		expect(task.note).toBe("测试备注");
	});
});

// ── updateItem() (Epic/Story) ──

describe("updateItem()", () => {
	it("更新 Epic title", () => {
		const epic = { id: "E1", title: "Old", description: "", status: "todo" as const, priority: "high" as const, project: "/test", stories: [] };
		updateItem(epic, { title: "New" }, "session-1");
		expect(epic.title).toBe("New");
	});

	it("status→doing 填 doingDate", () => {
		const story = { id: "E1.S1", title: "S1", description: "", status: "todo" as const, tasks: [] };
		updateItem(story, { status: "doing" }, "session-1");
		expect((story as any).doingDate).toBe(today());
	});

	it("status→done 填 doneDate", () => {
		const epic = { id: "E1", title: "E1", description: "", status: "doing" as const, priority: "high" as const, project: "/test", stories: [] };
		updateItem(epic, { status: "done" }, "session-1");
		expect(epic.doneDate).toBe(today());
	});
});
