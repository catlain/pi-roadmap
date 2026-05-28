/**
 * tests tools-action.ts — registerNextTool + registerDoneTool
 *
 * 使用 vi.mock 隔离 store/progress/logic 依赖，只测 execute 函数逻辑
 */
import { existsSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDoing } from "../lib/doing-store";
import { getNextTasks } from "../lib/progress";
import {
	filterByProject,
	getRoadmapFilePath,
	listRoadmapFiles,
	readRoadmap,
	writeRoadmap,
} from "../lib/store";
import { registerDoneTool, registerNextTool } from "../lib/tools-action";
import { markTaskDone } from "../lib/tools-atomic-logic";
import { getSessionId } from "../lib/tools-atomic-utils";
import type { RoadmapFile } from "../lib/types";

// ── mock 模块 ──
vi.mock("@sinclair/typebox", () => ({ Type: { Object: () => ({}), String: () => ({}), Number: () => ({}), Boolean: () => ({}), Optional: (t: any) => t, Union: (t: any[]) => t[0], Literal: (v: any) => ({ type: "literal", value: v }), Array: (t: any) => ({ type: "array", items: t }), Record: (k: any, v: any) => ({ type: "record", key: k, value: v }), Enum: (e: any) => ({ type: "enum", values: e }), Null: () => ({ type: "null" }), Integer: () => ({ type: "integer" }), Any: () => ({ type: "any" }), Unknown: () => ({ type: "unknown" }) } }));
vi.mock("node:fs");
vi.mock("../lib/store");
vi.mock("../lib/progress");
vi.mock("../lib/tools-atomic-logic");
vi.mock("../lib/tools-atomic-utils");
vi.mock("../lib/doing-store");

// ── 测试数据 ──

const MOCK_ROADMAP: RoadmapFile = {
	meta: {
		id: "test-rm",
		title: "测试路线图",
		status: "active",
		created: "2026-01-01",
		updated: "2026-01-01",
		tags: [],
	},
	epics: [
		{
			id: "E1",
			title: "Epic 1",
			description: "测试",
			status: "todo",
			priority: "high",
			project: "/test",
			stories: [
				{
					id: "E1.S1",
					title: "Story 1",
					description: "",
					status: "todo",
					tasks: [
						{ id: "E1.S1.T1", title: "Task 1", status: "todo" },
					],
				},
			],
		},
	],
};

function makeMockPi(): ExtensionAPI {
	return {
		registerTool: vi.fn() as any,
		on: vi.fn() as any,
		sendMessage: vi.fn() as any,
	} as any;
}

/** 提取注册工具时传给 registerTool 的 execute 函数 */
function getExecute(fn: (pi: ExtensionAPI) => void) {
	const pi = makeMockPi();
	fn(pi);
	const call = vi.mocked(pi.registerTool).mock.calls[0];
	if (!call) throw new Error("registerTool was not called");
	return call[0].execute as any;
}

// ── registerNextTool ──

describe("registerNextTool", () => {
	const execute = getExecute(registerNextTool);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("指定 roadmapId 且存在时返回 next 任务", async () => {
		vi.mocked(getRoadmapFilePath).mockReturnValue("/fake/path");
		vi.mocked(readRoadmap).mockReturnValue(MOCK_ROADMAP);
		vi.mocked(filterByProject).mockImplementation((rm) => rm);
		vi.mocked(getNextTasks).mockReturnValue([
			{
				id: "E1.S1.T1",
				title: "Task 1",
				status: "todo",
				epicId: "E1",
				epicTitle: "Epic 1",
				storyId: "E1.S1",
				storyTitle: "Story 1",
				roadmapId: "test-rm",
				roadmapTitle: "测试路线图",
			} as any,
		]);

		const result = await execute("call-1", { roadmapId: "test-rm" }, undefined, undefined, undefined);
		expect(result.content[0].text).toContain("Task 1");
		expect(result.content[0].text).toContain("测试路线图");
	});

	it("指定 roadmapId 但不存在时返回错误", async () => {
		vi.mocked(getRoadmapFilePath).mockReturnValue("/fake/path");
		vi.mocked(readRoadmap).mockReturnValue(null);

		const result = await execute("call-1", { roadmapId: "nonexistent" }, undefined, undefined, undefined);
		expect(result.content[0].text).toContain("不存在");
	});

	it("未指定 roadmapId 时遍历所有活跃路线图", async () => {
		vi.mocked(listRoadmapFiles).mockReturnValue(["/fake/rm1.roadmap.json"]);
		const activeRm = { ...MOCK_ROADMAP, meta: { ...MOCK_ROADMAP.meta, status: "active" as const } };
		vi.mocked(readRoadmap).mockReturnValue(activeRm);
		vi.mocked(filterByProject).mockImplementation((rm) => rm);
		vi.mocked(getNextTasks).mockReturnValue([]);

		const result = await execute("call-1", {}, undefined, undefined, undefined);
		expect(result.content[0].text).toContain("当前没有待推进的任务");
	});

	it("无活跃路线图时返回提示", async () => {
		vi.mocked(listRoadmapFiles).mockReturnValue([]);

		const result = await execute("call-1", {}, undefined, undefined, undefined);
		expect(result.content[0].text).toBe("没有活跃的路线图。");
	});

	it("limit 参数生效", async () => {
		vi.mocked(getRoadmapFilePath).mockReturnValue("/fake/path");
		vi.mocked(readRoadmap).mockReturnValue(MOCK_ROADMAP);
		vi.mocked(filterByProject).mockImplementation((rm) => rm);
		const mockNext = Array.from({ length: 3 }, (_, i) => ({
			id: `T${i}`,
			title: `Task ${i}`,
			status: "todo" as const,
			epicId: "E1",
			epicTitle: "Epic 1",
			storyId: "E1.S1",
			storyTitle: "Story 1",
			roadmapId: "test-rm",
			roadmapTitle: "测试路线图",
		}));
		vi.mocked(getNextTasks).mockReturnValue(mockNext);

		const result = await execute("call-1", { roadmapId: "test-rm", limit: 3 }, undefined, undefined, undefined);
		expect(result.content[0].text).toContain("Task 0");
		expect(result.content[0].text).toContain("Task 2");
	});

	it("活跃 roadmap 但无匹配 epic 的，filterByProject 处理后 epics 为空", async () => {
		vi.mocked(listRoadmapFiles).mockReturnValue(["/fake/rm1.roadmap.json"]);
		const noEpicRm = { ...MOCK_ROADMAP, epics: [], meta: { ...MOCK_ROADMAP.meta, status: "active" as const } };
		vi.mocked(readRoadmap).mockReturnValue(noEpicRm);
		vi.mocked(filterByProject).mockImplementation((rm) => rm);
		vi.mocked(getNextTasks).mockReturnValue([]);

		const result = await execute("call-1", {}, undefined, undefined, undefined);
		expect(result.content[0].text).toContain("当前没有待推进的任务");
	});

	it("doing 任务显示 session id", async () => {
		vi.mocked(getRoadmapFilePath).mockReturnValue("/fake/path");
		vi.mocked(readRoadmap).mockReturnValue(MOCK_ROADMAP);
		vi.mocked(filterByProject).mockImplementation((rm) => rm);
		vi.mocked(getNextTasks).mockReturnValue([
			{
				id: "E1.S1.T1",
				title: "Doing Task",
				status: "doing",
				doingSessionId: "session-abc",
				epicId: "E1",
				epicTitle: "Epic 1",
				storyId: "E1.S1",
				storyTitle: "Story 1",
				roadmapId: "test-rm",
				roadmapTitle: "测试路线图",
			} as any,
		]);

		const result = await execute("call-1", { roadmapId: "test-rm" }, undefined, undefined, undefined);
		expect(result.content[0].text).toContain("session-abc");
	});
});

// ── registerDoneTool ──

describe("registerDoneTool", () => {
	const execute = getExecute(registerDoneTool);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("标记任务完成成功", async () => {
		vi.mocked(getRoadmapFilePath).mockReturnValue("/fake/path");
		vi.mocked(existsSync).mockReturnValue(true);
		const rm = JSON.parse(JSON.stringify(MOCK_ROADMAP)) as RoadmapFile;
		vi.mocked(readRoadmap).mockReturnValue(rm);
		vi.mocked(getSessionId).mockReturnValue("session-123");
		vi.mocked(markTaskDone).mockReturnValue({
			result: "✅ Task E1.S1.T1: Task 1 已完成。",
			doneTaskId: "E1.S1.T1",
			cascadeInfo: [],
		});
		vi.mocked(writeRoadmap).mockImplementation(() => {});
		vi.mocked(clearDoing).mockImplementation(() => {});

		const result = await execute(
			"call-1",
			{ roadmapId: "test-rm", taskId: "E1.S1.T1" },
			undefined,
			undefined,
			undefined,
		);
		expect(result.content[0].text).toContain("已标记完成");
		expect(clearDoing).toHaveBeenCalledWith("test-rm", "E1.S1.T1");
	});

	it("路线图不存在时返回错误", async () => {
		vi.mocked(getRoadmapFilePath).mockReturnValue("/fake/path");
		vi.mocked(existsSync).mockReturnValue(false);

		const result = await execute("call-1", { roadmapId: "nonexistent", taskId: "T1" }, undefined, undefined, undefined);
		expect(result.content[0].text).toContain("不存在");
	});

	it("路线图读取失败时返回错误", async () => {
		vi.mocked(getRoadmapFilePath).mockReturnValue("/fake/path");
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readRoadmap).mockReturnValue(null);

		const result = await execute("call-1", { roadmapId: "test-rm", taskId: "T1" }, undefined, undefined, undefined);
		expect(result.content[0].text).toContain("读取失败");
	});

	it("markTaskDone 返回错误时不继续执行", async () => {
		vi.mocked(getRoadmapFilePath).mockReturnValue("/fake/path");
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readRoadmap).mockReturnValue(JSON.parse(JSON.stringify(MOCK_ROADMAP)));
		vi.mocked(getSessionId).mockReturnValue("session-123");
		vi.mocked(markTaskDone).mockReturnValue({
			result: "错误：Task \"T999\" 不存在。",
			doneTaskId: "",
			cascadeInfo: [],
		});

		const result = await execute("call-1", { roadmapId: "test-rm", taskId: "T999" }, undefined, undefined, undefined);
		expect(result.content[0].text).toContain("错误");
		expect(writeRoadmap).not.toHaveBeenCalled();
	});

	it("带 note 时写入任务备注", async () => {
		vi.mocked(getRoadmapFilePath).mockReturnValue("/fake/path");
		vi.mocked(existsSync).mockReturnValue(true);
		const rm = JSON.parse(JSON.stringify(MOCK_ROADMAP)) as RoadmapFile;
		vi.mocked(readRoadmap).mockReturnValue(rm);
		vi.mocked(getSessionId).mockReturnValue("session-123");
		vi.mocked(markTaskDone).mockReturnValue({
			result: "✅ Task E1.S1.T1: Task 1 已完成。",
			doneTaskId: "E1.S1.T1",
			cascadeInfo: [],
		});
		vi.mocked(writeRoadmap).mockImplementation(() => {});
		vi.mocked(clearDoing).mockImplementation(() => {});

		await execute("call-1", { roadmapId: "test-rm", taskId: "E1.S1.T1", note: "已提交 PR" }, undefined, undefined, undefined);
		expect(writeRoadmap).toHaveBeenCalled();
		// 验证 note 写入了
		const writtenRm = vi.mocked(writeRoadmap).mock.calls[0][1];
		expect(writtenRm.epics[0].stories[0].tasks[0].note).toBe("已提交 PR");
	});
});
