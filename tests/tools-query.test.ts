/**
 * tests tools-query.ts — registerListTool + registerShowTool
 */
import * as fs from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatProgress, getOverview } from "../lib/parser";
import {
	filterByProject,
	getRoadmapFilePath,
	listRoadmapFiles,
	readRoadmap,
} from "../lib/store";
import { registerListTool, registerShowTool } from "../lib/tools-query";
import { formatRoadmapDetail } from "../lib/tools-query-format";
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
vi.mock("../lib/parser");
vi.mock("../lib/tools-query-format");

function makeMockPi(): ExtensionAPI {
	return { registerTool: vi.fn() as any, on: vi.fn() as any } as any;
}

function getExecute(fn: (pi: ExtensionAPI) => void) {
	const pi = makeMockPi();
	fn(pi);
	return vi.mocked(pi.registerTool).mock.calls[0][0].execute as any;
}

const MOCK_RM: RoadmapFile = {
	meta: {
		id: "test",
		title: "测试",
		status: "active",
		created: "2026-01-01",
		updated: "2026-01-01",
		tags: ["test"],
	},
	epics: [
		{
			id: "E1",
			title: "Epic 1",
			description: "",
			status: "doing",
			priority: "high",
			project: "/test",
			stories: [
				{
					id: "E1.S1",
					title: "Story 1",
					description: "",
					status: "doing",
					tasks: [{ id: "E1.S1.T1", title: "T1", status: "todo" }],
				},
			],
		},
		{
			id: "E2",
			title: "Epic 2",
			description: "",
			status: "done",
			priority: "medium",
			project: "/test",
			stories: [
				{
					id: "E2.S1",
					title: "Story done",
					description: "",
					status: "done",
					tasks: [{ id: "E2.S1.T1", title: "T1", status: "done" }],
				},
			],
		},
		{
			id: "E3",
			title: "Archived Epic",
			description: "",
			status: "done",
			priority: "low",
			project: "/test",
			archived: true,
			stories: [
				{
					id: "E3.S1",
					title: "Archived",
					description: "",
					status: "done",
					archived: true,
					tasks: [
						{ id: "E3.S1.T1", title: "T1", status: "done", archived: true },
					],
				},
			],
		},
	],
};

// ── registerListTool ──

describe("registerListTool", () => {
	const execute = getExecute(registerListTool);

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(listRoadmapFiles).mockReturnValue(["/fake/test.roadmap.json"]);
		vi.mocked(readRoadmap).mockReturnValue(MOCK_RM);
		vi.mocked(filterByProject).mockImplementation((rm) => rm);
		vi.mocked(getOverview).mockReturnValue({
			id: "test",
			title: "测试",
			status: "active",
			tags: ["test"],
			totalTasks: 2,
			doneTasks: 1,
			percent: 50,
			epics: [],
		});
		vi.mocked(formatProgress).mockReturnValue("[■■■■■□□□□□]");
	});

	it("列出所有路线图", async () => {
		const result = await execute("call-1", {}, undefined, undefined, undefined);
		expect(result.content[0].text).toContain("测试");
		expect(result.content[0].text).toContain("Epic 1");
	});

	it("无路线图时返回提示", async () => {
		vi.mocked(listRoadmapFiles).mockReturnValue([]);

		const result = await execute("call-1", {}, undefined, undefined, undefined);
		expect(result.content[0].text).toContain("没有找到路线图");
	});

	it("status=archived 时包含归档目录", async () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fs.readdirSync).mockReturnValue(["archived.roadmap.json" as any]);
		const archivedRm = JSON.parse(JSON.stringify(MOCK_RM)) as RoadmapFile;
		archivedRm.meta = { ...MOCK_RM.meta, status: "archived", id: "archived" };
		vi.mocked(readRoadmap).mockReturnValueOnce(MOCK_RM); // for listRoadmapFiles
		vi.mocked(readRoadmap).mockReturnValueOnce(archivedRm); // for archive dir
		vi.mocked(getOverview).mockReturnValueOnce({
			id: "archived",
			title: "测试",
			status: "archived",
			tags: ["test"],
			totalTasks: 2,
			doneTasks: 1,
			percent: 50,
			epics: [],
		});

		const result = await execute(
			"call-1",
			{ status: "archived" },
			undefined,
			undefined,
			undefined,
		);
		expect(result.content[0].text).toContain("archived");
	});

	it("status=archived 但归档目录不存在", async () => {
		vi.mocked(fs.existsSync).mockReturnValue(false);

		const result = await execute(
			"call-1",
			{ status: "archived" },
			undefined,
			undefined,
			undefined,
		);
		expect(result.content[0].text).toContain("没有找到路线图");
	});

	it("按 status 过滤", async () => {
		const _result = await execute(
			"call-1",
			{ status: "active" },
			undefined,
			undefined,
			undefined,
		);
		expect(listRoadmapFiles).toHaveBeenCalled();
	});

	it("按 tag 过滤", async () => {
		const result = await execute(
			"call-1",
			{ tag: "test" },
			undefined,
			undefined,
			undefined,
		);
		expect(result.content[0].text).toContain("测试");
	});

	it("按 tag 过滤：无匹配", async () => {
		vi.mocked(filterByProject).mockImplementation((rm) => {
			// 不修改 tags，让过滤走
			return rm;
		});
		const result = await execute(
			"call-1",
			{ tag: "nonexistent" },
			undefined,
			undefined,
			undefined,
		);
		expect(result.content[0].text).toContain("没有找到路线图");
	});

	it("show_completed=true 时展开已完成 Epic", async () => {
		const result = await execute(
			"call-1",
			{ show_completed: true },
			undefined,
			undefined,
			undefined,
		);
		expect(result.content[0].text).toContain("Epic 1");
	});

	it("show_archived=true 时显示归档 Epic", async () => {
		const result = await execute(
			"call-1",
			{ show_archived: true },
			undefined,
			undefined,
			undefined,
		);
		expect(result.content[0].text).toContain("Epic 1");
	});

	it("读取失败时跳过", async () => {
		vi.mocked(listRoadmapFiles).mockReturnValue([
			"/fake/a.roadmap.json",
			"/fake/b.roadmap.json",
		]);
		vi.mocked(readRoadmap)
			.mockReturnValueOnce(MOCK_RM)
			.mockReturnValueOnce(null);

		const result = await execute("call-1", {}, undefined, undefined, undefined);
		expect(result.content[0].text).toContain("测试");
	});

	it("filterByProject 后 epics 为空时仍可显示", async () => {
		vi.mocked(filterByProject).mockReturnValue({ ...MOCK_RM, epics: [] });

		const result = await execute("call-1", {}, undefined, undefined, undefined);
		expect(result.content[0].text).toContain("测试");
	});
});

// ── registerShowTool ──

describe("registerShowTool", () => {
	const execute = getExecute(registerShowTool);

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getRoadmapFilePath).mockReturnValue("/fake/test.roadmap.json");
		vi.mocked(readRoadmap).mockReturnValue(MOCK_RM);
		vi.mocked(filterByProject).mockImplementation((rm) => rm);
		vi.mocked(formatRoadmapDetail).mockReturnValue("格式化后的路线图详情");
	});

	it("显示路线图详情", async () => {
		const result = await execute(
			"call-1",
			{ roadmapId: "test" },
			undefined,
			undefined,
			undefined,
		);
		expect(result.content[0].text).toContain("格式化后的路线图详情");
	});

	it("路线图不存在时返回错误", async () => {
		vi.mocked(getRoadmapFilePath).mockReturnValue("");

		const result = await execute(
			"call-1",
			{ roadmapId: "nonexistent" },
			undefined,
			undefined,
			undefined,
		);
		expect(result.content[0].text).toContain("不存在");
	});

	it("读取失败时返回错误", async () => {
		vi.mocked(getRoadmapFilePath).mockReturnValue("/fake/test.roadmap.json");
		vi.mocked(readRoadmap).mockReturnValue(null);

		const result = await execute(
			"call-1",
			{ roadmapId: "test" },
			undefined,
			undefined,
			undefined,
		);
		expect(result.content[0].text).toContain("读取失败");
	});

	it("epic_id 过滤", async () => {
		const _result = await execute(
			"call-1",
			{ roadmapId: "test", epic_id: "E1" },
			undefined,
			undefined,
			undefined,
		);
		expect(formatRoadmapDetail).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ epicId: "E1" }),
		);
	});

	it("show_completed 和 show_archived 传参正确", async () => {
		const _result = await execute(
			"call-1",
			{ roadmapId: "test", show_completed: false, show_archived: true },
			undefined,
			undefined,
			undefined,
		);
		expect(formatRoadmapDetail).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ showCompleted: false, showArchived: true }),
		);
	});

	it("readRoadmap 返回 undefined 时处理", async () => {
		vi.mocked(getRoadmapFilePath).mockReturnValue("/fake/test.roadmap.json");
		vi.mocked(readRoadmap).mockReturnValue(undefined as any);

		const result = await execute(
			"call-1",
			{ roadmapId: "test" },
			undefined,
			undefined,
			undefined,
		);
		expect(result.content[0].text).toContain("读取失败");
	});
});
