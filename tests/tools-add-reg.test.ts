/**
 * tests/tools-add-reg.test.ts — roadmap_add 统一工具测试（路由层）
 */
import { existsSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeRoadmap } from "../lib/store";
import { registerAddTool } from "../lib/tools-add-reg";
import {
	addEpic as _addEpic,
	addStory as _addStory,
	addTask as _addTask,
	createRoadmap as _createRoadmap,
} from "../lib/tools-atomic-logic";
import { atomicUpdate } from "../lib/tools-atomic-utils";
import type { RoadmapFile } from "../lib/types";

vi.mock("@sinclair/typebox", () => ({
	Type: {
		Object: () => ({}),
		String: () => ({}),
		Number: () => ({}),
		Boolean: () => ({}),
		Any: () => ({}),
		Optional: (t: any) => t,
		Union: (t: any[]) => t[0],
		Literal: (v: any) => ({ type: "literal", value: v }),
		Array: (t: any) => ({ type: "array", items: t }),
	},
}));
vi.mock("node:fs");
vi.mock("../lib/store");
vi.mock("../lib/tools-atomic-logic");
vi.mock("../lib/tools-atomic-utils");
vi.mock("@earendil-works/pi-coding-agent", () => ({
	registerExtension: vi.fn(),
}));

const MOCK_RM: RoadmapFile = {
	meta: {
		id: "test",
		title: "测试",
		status: "active",
		created: "2026-01-01",
		updated: "2026-01-01",
		tags: [],
		nextEid: 1,
	},
	epics: [],
};

function makeMockPi(): ExtensionAPI {
	return { registerTool: vi.fn() as any, on: vi.fn() as any } as any;
}

function getExecute() {
	const pi = makeMockPi();
	registerAddTool(pi);
	return vi.mocked(pi.registerTool).mock.calls[0][0].execute as any;
}

describe("roadmap_add 统一工具", () => {
	const execute = getExecute;

	beforeEach(() => vi.clearAllMocks());

	it("注册工具名为 roadmap_add", () => {
		const pi = makeMockPi();
		registerAddTool(pi);
		expect(pi.registerTool).toHaveBeenCalledWith(
			expect.objectContaining({ name: "roadmap_add" }),
		);
	});

	it("item_type=epic 添加 Epic", async () => {
		vi.mocked(_addEpic).mockReturnValue({ result: "✅ 已添加", epicId: "E1" });
		vi.mocked(atomicUpdate).mockImplementation((_id: string, fn: any) =>
			fn(MOCK_RM),
		);

		const result = await execute()("", {
			roadmapId: "test",
			item_type: "epic",
			title: "新 Epic",
			description: "描述",
			project: "/tmp",
			planPath: "E1.md",
		});
		expect(result.content[0].text).toContain("✅ 已添加");
	});

	it("item_type=epic 自动创建不存在的 roadmap", async () => {
		vi.mocked(existsSync).mockReturnValue(false);
		vi.mocked(_createRoadmap).mockReturnValue(MOCK_RM);
		vi.mocked(writeRoadmap).mockImplementation(() => {});
		vi.mocked(_addEpic).mockReturnValue({ result: "✅ 已添加", epicId: "E1" });
		vi.mocked(atomicUpdate).mockImplementation((_id: string, fn: any) =>
			fn(MOCK_RM),
		);

		const _result = await execute()("", {
			roadmapId: "new-rm",
			item_type: "epic",
			title: "新 Epic",
			project: "/tmp",
			planPath: "E1.md",
		});
		expect(_createRoadmap).toHaveBeenCalledWith("new-rm", "new-rm");
		expect(writeRoadmap).toHaveBeenCalled();
	});

	it("item_type=story 添加 Story", async () => {
		vi.mocked(_addStory).mockReturnValue({ result: "✅ 已添加", storyId: "E1.S2" });
		vi.mocked(atomicUpdate).mockImplementation((_id: string, fn: any) =>
			fn(MOCK_RM),
		);

		const result = await execute()("", {
			roadmapId: "test",
			item_type: "story",
			epic_id: "E1",
			title: "新 Story",
			planPath: "E1-S2.md",
		});
		expect(result.content[0].text).toContain("✅ 已添加");
	});

	it("item_type=story 缺少 epic_id 报错", async () => {
		const result = await execute()("", {
			roadmapId: "test",
			item_type: "story",
			title: "无 Epic",
			planPath: "S.md",
		});
		expect(result.content[0].text).toContain("必须指定 epic_id");
	});

	it("item_type=task 添加 Task", async () => {
		vi.mocked(_addTask).mockReturnValue({
			result: "✅ 已添加",
			taskId: "E1.S1.T1",
		});
		vi.mocked(atomicUpdate).mockImplementation((_id: string, fn: any) =>
			fn(MOCK_RM),
		);

		const result = await execute()("", {
			roadmapId: "test",
			item_type: "task",
			story_id: "E1.S1",
			title: "新 Task",
		});
		expect(result.content[0].text).toContain("✅ 已添加");
	});

	it("item_type=task 可选传 planPath", async () => {
		vi.mocked(_addTask).mockReturnValue({
			result: "✅ 已添加",
			taskId: "E1.S1.T2",
		});
		vi.mocked(atomicUpdate).mockImplementation((_id: string, fn: any) =>
			fn(MOCK_RM),
		);

		const result = await execute()("", {
			roadmapId: "test",
			item_type: "task",
			story_id: "E1.S1",
			title: "带计划的 Task",
			planPath: "E1-S1-T2.md",
		});
		expect(result.content[0].text).toContain("✅ 已添加");
	});

	it("item_type=task 缺少 story_id 报错", async () => {
		const result = await execute()("", {
			roadmapId: "test",
			item_type: "task",
			title: "无 Story",
		});
		expect(result.content[0].text).toContain("必须指定 story_id");
	});

	it("未知 item_type 报错", async () => {
		const result = await execute()("", {
			roadmapId: "test",
			item_type: "unknown",
			title: "测试",
		});
		expect(result.content[0].text).toContain("未知的 item_type");
	});
});
