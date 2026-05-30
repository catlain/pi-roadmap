/**
 * tests tools-atomic-create.ts — create / add_epic / add_story / add_task 工具
 */
import { existsSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeRoadmap } from "../lib/store";
import {
	addEpic as _addEpic,
	addStory as _addStory,
	addTask as _addTask,
	createRoadmap as _createRoadmap,
} from "../lib/tools-atomic-logic";
import {
	registerAddEpicTool,
	registerAddStoryTool,
	registerAddTaskTool,
	registerCreateTool,
} from "../lib/tools-atomic-create";
import { atomicUpdate } from "../lib/tools-atomic-utils";
import type { RoadmapFile } from "../lib/types";

vi.mock("@sinclair/typebox", () => ({ Type: { Object: () => ({}), String: () => ({}), Number: () => ({}), Boolean: () => ({}), Any: () => ({}), Optional: (t: any) => t, Union: (t: any[]) => t[0], Literal: (v: any) => ({ type: "literal", value: v }), Array: (t: any) => ({ type: "array", items: t }) } }));
vi.mock("node:fs");
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
	epics: [],
};

// ── registerCreateTool ──

describe("registerCreateTool", () => {
	const execute = getExecute(registerCreateTool);

	beforeEach(() => vi.clearAllMocks());

	it("创建新路线图", async () => {
		vi.mocked(existsSync).mockReturnValue(false);
		vi.mocked(_createRoadmap).mockReturnValue(MOCK_RM);
		vi.mocked(writeRoadmap).mockImplementation(() => {});

		const result = await execute("", { roadmapId: "test", title: "测试" });
		expect(result.content[0].text).toContain("已创建");
		expect(writeRoadmap).toHaveBeenCalled();
	});

	it("路线图已存在时返回提示", async () => {
		vi.mocked(existsSync).mockReturnValue(true);

		const result = await execute("", { roadmapId: "test", title: "测试" });
		expect(result.content[0].text).toContain("已存在");
		expect(writeRoadmap).not.toHaveBeenCalled();
	});

	it("带 tags 创建", async () => {
		vi.mocked(existsSync).mockReturnValue(false);
		vi.mocked(_createRoadmap).mockReturnValue(MOCK_RM);
		vi.mocked(writeRoadmap).mockImplementation(() => {});

		await execute("", { roadmapId: "test", title: "测试", tags: ["pi", "开源"] });
		expect(_createRoadmap).toHaveBeenCalledWith("test", "测试", ["pi", "开源"]);
	});
});

// ── registerAddEpicTool ──

describe("registerAddEpicTool", () => {
	const execute = getExecute(registerAddEpicTool);

	beforeEach(() => vi.clearAllMocks());

	it("添加 epic 成功", async () => {
		vi.mocked(atomicUpdate).mockReturnValue("✅ Epic E1: 新Epic 已添加。");

		const result = await execute("", {
			roadmapId: "test", title: "新Epic", description: "描述", project: "/test",
		});
		expect(result.content[0].text).toContain("已添加");
	});

	it("带 priority 添加 epic", async () => {
		vi.mocked(atomicUpdate).mockImplementation((_id, fn) => {
			const rm = JSON.parse(JSON.stringify(MOCK_RM)) as RoadmapFile;
			return fn(rm);
		});
		vi.mocked(_addEpic).mockReturnValue({ result: "✅ Epic E1: 新Epic 已添加。", epicId: "E1" });

		await execute("", {
			roadmapId: "test", title: "新Epic", description: "描述", priority: "high", project: "/test",
		});
		expect(_addEpic).toHaveBeenCalledWith(expect.anything(), "新Epic", "描述", "high", "/test", undefined);
	});
});

// ── registerAddStoryTool ──

describe("registerAddStoryTool", () => {
	const execute = getExecute(registerAddStoryTool);

	beforeEach(() => vi.clearAllMocks());

	it("添加 story 成功", async () => {
		vi.mocked(atomicUpdate).mockReturnValue("✅ Story E1.S1: 新Story 已添加。");

		const result = await execute("", { roadmapId: "test", epic_id: "E1", title: "新Story", description: "描述" });
		expect(result.content[0].text).toContain("已添加");
	});

	it("epic 不存在时返回错误", async () => {
		vi.mocked(atomicUpdate).mockImplementation((_id, fn) => {
			const rm = JSON.parse(JSON.stringify(MOCK_RM)) as RoadmapFile;
			return fn(rm);
		});
		vi.mocked(_addStory).mockReturnValue({ result: `错误：Epic "E99" 不存在。` });

		const result = await execute("", { roadmapId: "test", epic_id: "E99", title: "新Story", description: "描述" });
		expect(result.content[0].text).toContain("错误");
	});
});

// ── registerAddTaskTool ──

describe("registerAddTaskTool", () => {
	const execute = getExecute(registerAddTaskTool);

	beforeEach(() => vi.clearAllMocks());

	it("添加 task 成功", async () => {
		vi.mocked(atomicUpdate).mockReturnValue("✅ Task E1.S1.T1: 新Task 已添加。");

		const result = await execute("", { roadmapId: "test", story_id: "E1.S1", title: "新Task" });
		expect(result.content[0].text).toContain("已添加");
	});

	it("带 priority 添加 task", async () => {
		vi.mocked(atomicUpdate).mockImplementation((_id, fn) => {
			const rm = JSON.parse(JSON.stringify(MOCK_RM)) as RoadmapFile;
			return fn(rm);
		});
		vi.mocked(_addTask).mockReturnValue({ result: "✅ Task E1.S1.T1: 新Task 已添加。", taskId: "E1.S1.T1" });

		await execute("", { roadmapId: "test", story_id: "E1.S1", title: "新Task", priority: "high" });
		expect(_addTask).toHaveBeenCalledWith(expect.anything(), "E1.S1", "新Task", "high", undefined, undefined);
	});

	it("story 不存在时返回错误", async () => {
		vi.mocked(atomicUpdate).mockImplementation((_id, fn) => {
			const rm = JSON.parse(JSON.stringify(MOCK_RM)) as RoadmapFile;
			return fn(rm);
		});
		vi.mocked(_addTask).mockReturnValue({ result: `错误：Story "E99.S99" 不存在。` });

		const result = await execute("", { roadmapId: "test", story_id: "E99.S99", title: "新Task" });
		expect(result.content[0].text).toContain("错误");
	});
});
