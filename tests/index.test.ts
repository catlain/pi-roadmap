/**
 * tests index.ts — roadmapExtension 入口
 *
 * 注册函数使用真实实现（vi.importActual），store/logic 函数用 mock。
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";

// 只 mock 基础依赖，让工具注册走真实实现
vi.mock("@sinclair/typebox", () => ({ Type: { Object: () => ({}), String: () => ({}), Number: () => ({}), Boolean: () => ({}), Any: () => ({}), Optional: (t: any) => t, Union: (t: any[]) => t[0], Literal: (v: any) => ({ type: "literal", value: v }), Array: (t: any) => ({ type: "array", items: t }) } }));
vi.mock("node:fs");
vi.mock("../lib/store");
vi.mock("../lib/doing-store");
vi.mock("../lib/tools-atomic-logic");

describe("roadmapExtension", () => {
	it("注册所有 5 个工具", async () => {
		const pi = {
			registerTool: vi.fn() as any,
			on: vi.fn() as any,
			sendMessage: vi.fn() as any,
		} as ExtensionAPI;

		const mod = await import("../index");
		mod.default(pi);

		expect(pi.registerTool).toHaveBeenCalledTimes(6);
		expect(pi.on).toHaveBeenCalledWith("agent_end", expect.any(Function));
	});

	it("agent_end: 无 doing 条目时不发提醒", async () => {
		const pi = {
			registerTool: vi.fn() as any,
			on: vi.fn() as any,
			sendMessage: vi.fn() as any,
		} as ExtensionAPI;

		const mod = await import("../index");
		mod.default(pi);

		const agentEndHandler = vi.mocked(pi.on).mock.calls.find(
			c => c[0] === "agent_end",
		)?.[1] as (event: any, ctx: any) => Promise<void>;

		// 无 doing 条目
		const { listRoadmapFiles } = await import("../lib/store");
		const { readDoing } = await import("../lib/doing-store");
		vi.mocked(listRoadmapFiles).mockReturnValue([]);
		vi.mocked(readDoing).mockReturnValue([]);

		await agentEndHandler({}, { sessionManager: { getSessionFile: () => "session-abc.jsonl" } });

		// 无 doing 条目 → 不发提醒
		expect(pi.sendMessage).not.toHaveBeenCalled();
	});

	it("agent_end: 有当前会话的 doing 条目时发提醒", async () => {
		const pi = {
			registerTool: vi.fn() as any,
			on: vi.fn() as any,
			sendMessage: vi.fn() as any,
		} as ExtensionAPI;

		const mod = await import("../index");
		mod.default(pi);

		const agentEndHandler = vi.mocked(pi.on).mock.calls.find(
			c => c[0] === "agent_end",
		)?.[1] as (event: any, ctx: any) => Promise<void>;

		const { listRoadmapFiles, readRoadmap } = await import("../lib/store");
		const { readDoing, syncDoing } = await import("../lib/doing-store");
		vi.mocked(listRoadmapFiles).mockReturnValue(["/fake/test.roadmap.json"]);
		vi.mocked(readRoadmap).mockReturnValue({
			meta: { id: "test", title: "测试", status: "active" },
			epics: [],
		} as any);
		vi.mocked(syncDoing).mockImplementation(() => {});
		// 当前会话有 doing 条目
		const doingEntry = {
			roadmapId: "test", taskId: "E1.S1.T1", taskTitle: "做某事",
			startedAt: "2026-01-01", sessionId: "session-abc",
		};
		vi.mocked(readDoing).mockReturnValue([doingEntry]);

		await agentEndHandler({}, { sessionManager: { getSessionFile: () => "session-abc.jsonl" } });

		expect(pi.sendMessage).toHaveBeenCalledWith(
			expect.objectContaining({ customType: "roadmap-doing-reminder" }),
		);
	});

	it("agent_end: 过滤其他会话的 doing 条目", async () => {
		const pi = {
			registerTool: vi.fn() as any,
			on: vi.fn() as any,
			sendMessage: vi.fn() as any,
		} as ExtensionAPI;

		const mod = await import("../index");
		mod.default(pi);

		const agentEndHandler = vi.mocked(pi.on).mock.calls.find(
			c => c[0] === "agent_end",
		)?.[1] as (event: any, ctx: any) => Promise<void>;

		const { listRoadmapFiles, readRoadmap } = await import("../lib/store");
		const { readDoing, syncDoing } = await import("../lib/doing-store");
		vi.mocked(listRoadmapFiles).mockReturnValue([]);
		vi.mocked(syncDoing).mockImplementation(() => {});
		// 其他会话的 doing 条目
		vi.mocked(readDoing).mockReturnValue([
			{ roadmapId: "test", taskId: "E1.S1.T1", taskTitle: "做某事", startedAt: "2026-01-01", sessionId: "other-session" },
		]);

		await agentEndHandler({}, { sessionManager: { getSessionFile: () => "session-abc.jsonl" } });

		expect(pi.sendMessage).not.toHaveBeenCalled();
	});

	it("agent_end: 无 sessionManager 时显示所有 doing 条目", async () => {
		const pi = {
			registerTool: vi.fn() as any,
			on: vi.fn() as any,
			sendMessage: vi.fn() as any,
		} as ExtensionAPI;

		const mod = await import("../index");
		mod.default(pi);

		const agentEndHandler = vi.mocked(pi.on).mock.calls.find(
			c => c[0] === "agent_end",
		)?.[1] as (event: any, ctx: any) => Promise<void>;

		const { listRoadmapFiles, readRoadmap } = await import("../lib/store");
		const { readDoing, syncDoing } = await import("../lib/doing-store");
		vi.mocked(listRoadmapFiles).mockReturnValue([]);
		vi.mocked(syncDoing).mockImplementation(() => {});
		// 有 doing 条目
		vi.mocked(readDoing).mockReturnValue([
			{ roadmapId: "test", taskId: "E1.S1.T1", taskTitle: "做某事", startedAt: "2026-01-01", sessionId: "unknown" },
		]);

		// ctx 没有 sessionManager → currentSessionId = "" → 返回 allDoing → 发提醒
		await agentEndHandler({}, {});

		expect(pi.sendMessage).toHaveBeenCalledWith(
			expect.objectContaining({ customType: "roadmap-doing-reminder" }),
		);
	});

	it("agent_end: sendMessage 异常被捕获", async () => {
		const pi = {
			registerTool: vi.fn() as any,
			on: vi.fn() as any,
			sendMessage: vi.fn(() => { throw new Error("session closed"); }) as any,
		} as ExtensionAPI;

		const mod = await import("../index");
		mod.default(pi);

		const agentEndHandler = vi.mocked(pi.on).mock.calls.find(
			c => c[0] === "agent_end",
		)?.[1] as (event: any, ctx: any) => Promise<void>;

		const { listRoadmapFiles, readRoadmap } = await import("../lib/store");
		const { readDoing, syncDoing } = await import("../lib/doing-store");
		vi.mocked(listRoadmapFiles).mockReturnValue([]);
		vi.mocked(syncDoing).mockImplementation(() => {});
		vi.mocked(readDoing).mockReturnValue([
			{ roadmapId: "test", taskId: "E1.S1.T1", taskTitle: "做某事", startedAt: "2026-01-01", sessionId: "session-abc" },
		]);

		await expect(
			agentEndHandler({}, { sessionManager: { getSessionFile: () => "session-abc.jsonl" } }),
		).resolves.not.toThrow();
	});
});
