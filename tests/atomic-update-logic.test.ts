/**
 * updateTask/updateItem 单元测试
 *
 * 测试 tools-atomic-utils 中的更新逻辑（字段更新、状态转换副作用）
 */

import { describe, expect, it } from "vitest";
import { today, updateItem, updateTask } from "../lib/tools-atomic-utils";

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
		const task = {
			id: "E1.S1.T1",
			title: "T1",
			status: "doing" as const,
			doingDate: "2026-01-01",
			doingSessionId: "old",
		};
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
		const epic = {
			id: "E1",
			title: "Old",
			description: "",
			status: "todo" as const,
			priority: "high" as const,
			project: "/test",
			stories: [],
		};
		updateItem(epic, { title: "New" }, "session-1");
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
		updateItem(story, { status: "doing" }, "session-1");
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
		updateItem(epic, { status: "done" }, "session-1");
		expect(epic.doneDate).toBe(today());
	});
});
