/**
 * 状态机转换测试
 *
 * 测试 VALID_TRANSITIONS 表约束下的 updateTask/updateItem 状态转换行为
 */

import { describe, expect, it } from "vitest";
import { today, updateItem, updateTask } from "../lib/tools-atomic-utils";

// ── 合法转换 ──

describe("状态机：合法转换", () => {
	it.each([
		["todo", "doing"],
		["todo", "dropped"],
		["doing", "todo"],
		["doing", "done"],
		["doing", "blocked"],
		["doing", "dropped"],
		["done", "todo"],
		["blocked", "doing"],
		["blocked", "dropped"],
		["dropped", "todo"],
	] as [string, string][])("%s → %s 应成功", (from, to) => {
		const task = {
			id: "E1.S1.T1",
			title: "T1",
			status: from as any,
		};
		const result = updateTask({} as any, task, { status: to }, "session-1");
		expect(result).not.toContain("不合法");
		expect(task.status).toBe(to);
	});
});

// ── 非法转换 ──

describe("状态机：非法转换", () => {
	it.each([
		["todo", "done"],
		["todo", "blocked"],
		["done", "doing"],
		["done", "blocked"],
		["done", "dropped"],
		["blocked", "done"],
		["blocked", "todo"],
		["dropped", "doing"],
		["dropped", "done"],
		["dropped", "blocked"],
	] as [string, string][])("%s → %s 应被拒绝", (from, to) => {
		const task = {
			id: "E1.S1.T1",
			title: "T1",
			status: from as any,
		};
		const result = updateTask({} as any, task, { status: to }, "session-1");
		expect(result).toContain("不合法");
		expect(task.status).toBe(from); // 状态未变
	});
});

// ── 字段清理 ──

describe("状态机：字段清理", () => {
	it("doing→done 清除 doingDate/doingSessionId，填 doneDate/doneBySessionId", () => {
		const task = {
			id: "E1.S1.T1",
			title: "T1",
			status: "doing" as const,
			doingDate: "2026-01-01",
			doingSessionId: "old-session",
		};
		updateTask({} as any, task, { status: "done" }, "session-1");
		expect(task.doingDate).toBeUndefined();
		expect(task.doingSessionId).toBeUndefined();
		expect(task.doneDate).toBe(today());
	});

	it("done→todo 清除 doneDate/doneBySessionId", () => {
		const task = {
			id: "E1.S1.T1",
			title: "T1",
			status: "done" as const,
			doneDate: "2026-01-01",
			doneBySessionId: "old-session",
		};
		updateTask({} as any, task, { status: "todo" }, "session-1");
		expect(task.doneDate).toBeUndefined();
		expect(task.doneBySessionId).toBeUndefined();
	});

	it("doing→blocked 清除 doingDate", () => {
		const task = {
			id: "E1.S1.T1",
			title: "T1",
			status: "doing" as const,
			doingDate: "2026-01-01",
			doingSessionId: "session-1",
		};
		updateTask({} as any, task, { status: "blocked" }, "session-1");
		expect(task.doingDate).toBeUndefined();
		expect(task.doingSessionId).toBeUndefined();
	});

	it("Epic doing→done 清除 doingDate，填 doneDate", () => {
		const epic = {
			id: "E1",
			title: "E1",
			description: "",
			status: "doing" as const,
			priority: "high" as const,
			project: "/test",
			stories: [],
			doingDate: "2026-01-01",
		};
		updateItem({} as any, epic, { status: "done" }, "session-1");
		expect(epic.doingDate).toBeUndefined();
		expect(epic.doneDate).toBe(today());
	});

	it("相同状态不报错也不改字段", () => {
		const task = {
			id: "E1.S1.T1",
			title: "T1",
			status: "doing" as const,
			doingDate: "2026-01-01",
			doingSessionId: "session-1",
		};
		const result = updateTask({} as any, task, { status: "doing" }, "session-2");
		expect(result).not.toContain("不合法");
		expect(task.doingDate).toBe("2026-01-01"); // 未变
	});
});
