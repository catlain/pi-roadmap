/**
 * tests tools-atomic.ts — registerUpdateTool + registerArchiveTool
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRoadmapFilePath, readRoadmap, writeRoadmap } from "../lib/store";
import {
	archiveAllDone as _archiveAllDone,
	archiveEpic as _archiveEpic,
	getArchivedEpics as _getArchivedEpics,
} from "../lib/tools-atomic-logic";
import { registerArchiveTool, registerUpdateTool } from "../lib/tools-atomic";
import {
	atomicUpdate,
	getSessionId,
	updateItem,
	updateTask,
} from "../lib/tools-atomic-utils";
import type { Epic, RoadmapFile, Story } from "../lib/types";

vi.mock("@sinclair/typebox", () => ({ Type: { Object: () => ({}), String: () => ({}), Number: () => ({}), Boolean: () => ({}), Any: () => ({}), Optional: (t: any) => t, Union: (t: any[]) => t[0], Literal: (v: any) => ({ type: "literal", value: v }), Array: (t: any) => ({ type: "array", items: t }) } }));
vi.mock("../lib/store");
vi.mock("../lib/tools-atomic-logic");
vi.mock("../lib/tools-atomic-utils");

function makeMockPi(): ExtensionAPI {
	return { registerTool: vi.fn() as any, on: vi.fn() as any } as any;
}

function getExecute(fn: (pi: ExtensionAPI) => void) {
	const pi = makeMockPi();
	fn(pi);
	return vi.mocked(pi.registerTool).mock.calls[0][0].execute as any;
}

const MOCK_RM: RoadmapFile = {
	meta: { id: "test", title: "测试", status: "active", created: "2026-01-01", updated: "2026-01-01", tags: [] },
	epics: [
		{
			id: "E1", title: "Epic 1", description: "测试", status: "todo", priority: "high",
			project: "/test", stories: [
				{
					id: "E1.S1", title: "Story 1", description: "", status: "todo",
					tasks: [{ id: "E1.S1.T1", title: "Task 1", status: "todo" }],
				},
			],
		},
	],
};

// ── registerUpdateTool ──

describe("registerUpdateTool", () => {
	const execute = getExecute(registerUpdateTool);

	beforeEach(() => vi.clearAllMocks());

	it("更新 Epic 属性", async () => {
		vi.mocked(atomicUpdate).mockImplementation((_id, fn) => {
			const rm = JSON.parse(JSON.stringify(MOCK_RM)) as RoadmapFile;
			return fn(rm);
		});
		vi.mocked(getSessionId).mockReturnValue("session-1");
		vi.mocked(updateItem).mockReturnValue("✅ E1 已更新：title, status: todo → doing。");

		const result = await execute("call-1", {
			roadmapId: "test", item_id: "E1", updates: { title: "新标题", status: "doing" },
		}, undefined, undefined, {} as any);
		expect(result.content[0].text).toContain("已更新");
		expect(updateItem).toHaveBeenCalled();
	});

	it("更新 Story 属性", async () => {
		vi.mocked(atomicUpdate).mockImplementation((_id, fn) => {
			const rm = JSON.parse(JSON.stringify(MOCK_RM)) as RoadmapFile;
			return fn(rm);
		});
		vi.mocked(getSessionId).mockReturnValue("session-1");
		vi.mocked(updateItem).mockReturnValue("✅ E1.S1 已更新：description。");

		const result = await execute("call-1", {
			roadmapId: "test", item_id: "E1.S1", updates: { description: "新描述" },
		}, undefined, undefined, {} as any);
		expect(result.content[0].text).toContain("已更新");
	});

	it("更新 Task 属性", async () => {
		vi.mocked(atomicUpdate).mockImplementation((_id, fn) => {
			const rm = JSON.parse(JSON.stringify(MOCK_RM)) as RoadmapFile;
			return fn(rm);
		});
		vi.mocked(getSessionId).mockReturnValue("session-1");
		vi.mocked(updateTask).mockReturnValue("✅ E1.S1.T1 已更新：status: todo → doing。");

		const result = await execute("call-1", {
			roadmapId: "test", item_id: "E1.S1.T1", updates: { status: "doing" },
		}, undefined, undefined, {} as any);
		expect(result.content[0].text).toContain("已更新");
	});

	it("Epic 不存在时返回错误", async () => {
		vi.mocked(atomicUpdate).mockImplementation((_id, fn) => {
			const rm = JSON.parse(JSON.stringify(MOCK_RM)) as RoadmapFile;
			return fn(rm);
		});
		vi.mocked(getSessionId).mockReturnValue("session-1");

		const result = await execute("call-1", {
			roadmapId: "test", item_id: "E99", updates: { title: "X" },
		}, undefined, undefined, {} as any);
		expect(result.content[0].text).toContain("错误");
	});

	it("Story 不存在时返回错误", async () => {
		vi.mocked(atomicUpdate).mockImplementation((_id, fn) => {
			const rm = JSON.parse(JSON.stringify(MOCK_RM)) as RoadmapFile;
			return fn(rm);
		});
		vi.mocked(getSessionId).mockReturnValue("session-1");

		const result = await execute("call-1", {
			roadmapId: "test", item_id: "E1.S99", updates: { title: "X" },
		}, undefined, undefined, {} as any);
		expect(result.content[0].text).toContain("错误");
	});

	it("Task 不存在时返回错误", async () => {
		vi.mocked(atomicUpdate).mockImplementation((_id, fn) => {
			const rm = JSON.parse(JSON.stringify(MOCK_RM)) as RoadmapFile;
			return fn(rm);
		});
		vi.mocked(getSessionId).mockReturnValue("session-1");

		const result = await execute("call-1", {
			roadmapId: "test", item_id: "E1.S1.T999", updates: { title: "X" },
		}, undefined, undefined, {} as any);
		expect(result.content[0].text).toContain("错误");
	});
});

// ── registerArchiveTool ──

describe("registerArchiveTool", () => {
	const execute = getExecute(registerArchiveTool);

	beforeEach(() => vi.clearAllMocks());

	it("查看已归档 Epic 模式（show_archived=true）", async () => {
		vi.mocked(getRoadmapFilePath).mockReturnValue("/fake/path");
		vi.mocked(readRoadmap).mockReturnValue(MOCK_RM);
		vi.mocked(_getArchivedEpics).mockReturnValue(["📦 E1: Epic 1 [1 tasks] done: 2026-01-10"]);

		const result = await execute("call-1", { roadmapId: "test", show_archived: true }, undefined, undefined, undefined);
		expect(result.content[0].text).toContain("已归档 Epic");
	});

	it("查看模式无已归档项", async () => {
		vi.mocked(getRoadmapFilePath).mockReturnValue("/fake/path");
		vi.mocked(readRoadmap).mockReturnValue(MOCK_RM);
		vi.mocked(_getArchivedEpics).mockReturnValue([]);

		const result = await execute("call-1", { roadmapId: "test", show_archived: true }, undefined, undefined, undefined);
		expect(result.content[0].text).toBe("没有已归档的 Epic。");
	});

	it("查看模式路线图不存在", async () => {
		vi.mocked(getRoadmapFilePath).mockReturnValue("");

		const result = await execute("call-1", { roadmapId: "nonexistent", show_archived: true }, undefined, undefined, undefined);
		expect(result.content[0].text).toContain("不存在");
	});

	it("查看模式读取失败", async () => {
		vi.mocked(getRoadmapFilePath).mockReturnValue("/fake/path");
		vi.mocked(readRoadmap).mockReturnValue(undefined);

		const result = await execute("call-1", { roadmapId: "test", show_archived: true }, undefined, undefined, undefined);
		expect(result.content[0].text).toBe("读取失败。");
	});

	it("归档指定 Epic", async () => {
		vi.mocked(atomicUpdate).mockReturnValue("📦 已归档 Epic E1: Epic 1");

		const result = await execute("call-1", { roadmapId: "test", epic_id: "E1" }, undefined, undefined, undefined);
		expect(result.content[0].text).toContain("已归档");
	});

	it("归档所有已完成 Epic", async () => {
		vi.mocked(atomicUpdate).mockReturnValue("📦 已归档 2 个 Epic");

		const result = await execute("call-1", { roadmapId: "test" }, undefined, undefined, undefined);
		expect(result.content[0].text).toContain("已归档");
	});
});
