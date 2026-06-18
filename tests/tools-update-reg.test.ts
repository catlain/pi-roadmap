/**
 * tests/tools-update-reg.test.ts — roadmap_update 统一工具测试（路由层）
 */
import { existsSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { archiveRoadmap, readRoadmapById, writeRoadmap, writeRoadmapById } from "../lib/store";
import {
	archiveAllDone as _archiveAllDone,
	archiveEpic as _archiveEpic,
	markTaskDone as _markTaskDone,
} from "../lib/tools-atomic-logic";
import {
	atomicUpdate,
	getSessionId,
	updateItem,
	updateTask,
} from "../lib/tools-atomic-utils";
import { registerUpdateTool } from "../lib/tools-update-reg";
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
const mockGetFilePath = vi.fn();
const mockReadRoadmap = vi.fn();
vi.mock("../lib/store", () => ({
	getRoadmapFilePath: (...args: any[]) => mockGetFilePath(...args),
	readRoadmap: (...args: any[]) => mockReadRoadmap(...args),
	writeRoadmap: vi.fn(),
	archiveRoadmap: vi.fn(),
	readRoadmapById: vi.fn(),
	writeRoadmapById: vi.fn(),
}));
vi.mock("../lib/tools-atomic-logic");
vi.mock("../lib/tools-atomic-utils");
vi.mock("../lib/doing-store", () => ({ clearDoing: vi.fn() }));
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
	epics: [
		{
			id: "E1",
			eid: 1,
			title: "Epic 1",
			description: "",
			status: "todo",
			priority: "high",
			project: "/tmp",
			createdDate: "2026-01-01",
			stories: [
				{
					id: "E1.S1",
					eid: 2,
					title: "Story 1",
					description: "",
					status: "todo",
					createdDate: "2026-01-01",
					tasks: [
						{
							id: "E1.S1.T1",
							eid: 3,
							title: "Task 1",
							status: "todo",
							createdDate: "2026-01-01",
						},
					],
				},
			],
		},
	],
};

function makeMockPi(): ExtensionAPI {
	return { registerTool: vi.fn() as any, on: vi.fn() as any } as any;
}

function getExecute() {
	const pi = makeMockPi();
	registerUpdateTool(pi);
	return vi.mocked(pi.registerTool).mock.calls[0][0].execute as any;
}

describe("roadmap_update 统一工具", () => {
	beforeEach(() => vi.clearAllMocks());

	it("注册工具名为 roadmap_update", () => {
		const pi = makeMockPi();
		registerUpdateTool(pi);
		expect(pi.registerTool).toHaveBeenCalledWith(
			expect.objectContaining({ name: "roadmap_update" }),
		);
	});

	it("更新 Epic 属性", async () => {
		vi.mocked(updateItem).mockReturnValue("✅ 已更新");
		vi.mocked(atomicUpdate).mockImplementation((_id: string, fn: any) =>
			fn(MOCK_RM),
		);
		vi.mocked(getSessionId).mockReturnValue("sess1");

		const result = await getExecute()("", {
			roadmapId: "test",
			item_id: "E1",
			title: "新标题",
		});
		expect(result.content[0].text).toContain("✅ 已更新");
	});

	it("更新 Story 属性", async () => {
		vi.mocked(updateItem).mockReturnValue("✅ 已更新");
		vi.mocked(atomicUpdate).mockImplementation((_id: string, fn: any) =>
			fn(MOCK_RM),
		);
		vi.mocked(getSessionId).mockReturnValue("sess1");

		const result = await getExecute()("", {
			roadmapId: "test",
			item_id: "E1.S1",
			status: "doing",
		});
		expect(result.content[0].text).toContain("✅ 已更新");
	});

	it("更新 Task 属性（非 done）", async () => {
		vi.mocked(updateTask).mockReturnValue("✅ 已更新");
		vi.mocked(atomicUpdate).mockImplementation((_id: string, fn: any) =>
			fn(MOCK_RM),
		);
		vi.mocked(getSessionId).mockReturnValue("sess1");

		const result = await getExecute()("", {
			roadmapId: "test",
			item_id: "E1.S1.T1",
			status: "doing",
		});
		expect(result.content[0].text).toContain("✅ 已更新");
	});

	it("Task 标记 done 走级联逻辑", async () => {
		mockGetFilePath.mockReturnValue("/tmp/test.json");
		vi.mocked(existsSync).mockReturnValue(true);
		mockReadRoadmap.mockReturnValue(MOCK_RM);
		vi.mocked(_markTaskDone).mockReturnValue({
			result: "✅ 已完成",
			doneTaskId: "E1.S1.T1",
			cascadeInfo: [],
		});
		vi.mocked(writeRoadmap).mockImplementation(() => {});
		vi.mocked(getSessionId).mockReturnValue("sess1");

		const result = await getExecute()("", {
			roadmapId: "test",
			item_id: "E1.S1.T1",
			status: "done",
		});
		expect(result.content[0].text).toContain("已标记完成");
		expect(_markTaskDone).toHaveBeenCalled();
	});

	it("归档指定 Epic", async () => {
		vi.mocked(_archiveEpic).mockReturnValue({
			result: "✅ 已归档",
			archivedIds: ["E1"],
		});
		vi.mocked(atomicUpdate).mockImplementation((_id: string, fn: any) =>
			fn(MOCK_RM),
		);

		const result = await getExecute()("", {
			roadmapId: "test",
			item_id: "E1",
			archive: true,
		});
		expect(result.content[0].text).toContain("✅ 已归档");
	});

	it("归档所有已完成 Epic", async () => {
		vi.mocked(_archiveAllDone).mockReturnValue({
			result: "✅ 已归档全部",
			archivedIds: ["E1"],
		});
		vi.mocked(atomicUpdate).mockImplementation((_id: string, fn: any) =>
			fn(MOCK_RM),
		);

		const result = await getExecute()("", {
			roadmapId: "test",
			item_id: "all",
			archive: true,
		});
		expect(result.content[0].text).toContain("✅ 已归档全部");
	});

	it("没有指定任何字段时报错", async () => {
		const result = await getExecute()("", {
			roadmapId: "test",
			item_id: "E1",
		});
		expect(result.content[0].text).toContain("没有指定任何要更新的字段");
	});

	it("不存在的 Epic 报错", async () => {
		vi.mocked(atomicUpdate).mockImplementation((_id: string, fn: any) =>
			fn(MOCK_RM),
		);
		vi.mocked(getSessionId).mockReturnValue("sess1");

		const result = await getExecute()("", {
			roadmapId: "test",
			item_id: "E99",
			title: "不存在",
		});
		expect(result.content[0].text).toContain("不存在");
	});

	describe("roadmap 级别更新", () => {
		it("item_id 等于 roadmapId 时走 roadmap 级别更新", async () => {
			vi.mocked(readRoadmapById).mockReturnValue({ ...MOCK_RM });
			vi.mocked(writeRoadmapById).mockReturnValue(true);

			const result = await getExecute()("", {
				roadmapId: "test",
				item_id: "test",
				status: "completed",
			});
			expect(result.content[0].text).toContain("已更新");
			expect(result.content[0].text).toContain("completed");
			expect(writeRoadmapById).toHaveBeenCalledWith(
				"test",
				expect.objectContaining({
					meta: expect.objectContaining({ status: "completed" }),
				}),
			);
		});

		it("item_id 为 \"*\" 时也走 roadmap 级别更新", async () => {
			vi.mocked(readRoadmapById).mockReturnValue({ ...MOCK_RM });
			vi.mocked(writeRoadmapById).mockReturnValue(true);

			const result = await getExecute()("", {
				roadmapId: "test",
				item_id: "*",
				status: "paused",
			});
			expect(result.content[0].text).toContain("已更新");
			expect(writeRoadmapById).toHaveBeenCalled();
		});

		it("status=archived 时调用 archiveRoadmap 移动文件", async () => {
			vi.mocked(archiveRoadmap).mockReturnValue(true);

			const result = await getExecute()("", {
				roadmapId: "test",
				item_id: "test",
				status: "archived",
			});
			expect(result.content[0].text).toContain("已归档");
			expect(archiveRoadmap).toHaveBeenCalledWith("test");
			// 不应调用 writeRoadmapById
			expect(writeRoadmapById).not.toHaveBeenCalled();
		});

		it("roadmap 不存在时报错", async () => {
			vi.mocked(readRoadmapById).mockReturnValue(null);

			const result = await getExecute()("", {
				roadmapId: "nonexist",
				item_id: "nonexist",
				status: "completed",
			});
			expect(result.content[0].text).toContain("不存在");
		});

		it("archive 不存在的 roadmap 报错", async () => {
			vi.mocked(archiveRoadmap).mockReturnValue(false);

			const result = await getExecute()("", {
				roadmapId: "nonexist",
				item_id: "nonexist",
				status: "archived",
			});
			expect(result.content[0].text).toContain("不存在");
		});

		it("无效 status 报错", async () => {
			const result = await getExecute()("", {
				roadmapId: "test",
				item_id: "test",
				status: "invalid",
			});
			expect(result.content[0].text).toContain("status 必须");
		});

		it("没有指定任何字段时报错", async () => {
			const result = await getExecute()("", {
				roadmapId: "test",
				item_id: "test",
			});
			expect(result.content[0].text).toContain("没有指定任何要更新的字段");
		});

		it("更新 roadmap 标题", async () => {
			vi.mocked(readRoadmapById).mockReturnValue({ ...MOCK_RM });
			vi.mocked(writeRoadmapById).mockReturnValue(true);

			const result = await getExecute()("", {
				roadmapId: "test",
				item_id: "test",
				title: "新标题",
			});
			expect(result.content[0].text).toContain("已更新");
			expect(writeRoadmapById).toHaveBeenCalledWith(
				"test",
				expect.objectContaining({
					meta: expect.objectContaining({ title: "新标题" }),
				}),
			);
		});
	});
});