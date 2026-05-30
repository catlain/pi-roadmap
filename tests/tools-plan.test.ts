/**
 * tests tools-plan.ts — registerPlanTool
 *
 * 注意：loadPrompts 在注册时执行，mock node:fs 使其返回空。
 */
import * as fs from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncDoingChanges } from "../lib/doing-sync";
import { getRoadmapFilePath, readRoadmap, writeRoadmap } from "../lib/store";
import { registerPlanTool } from "../lib/tools-plan";
import { validateRoadmap } from "../lib/validator";

vi.mock("@sinclair/typebox", () => ({ Type: { Object: () => ({}), String: () => ({}), Number: () => ({}), Boolean: () => ({}), Any: () => ({}), Optional: (t: any) => t, Union: (t: any[]) => t[0], Literal: (v: any) => ({ type: "literal", value: v }), Array: (t: any) => ({ type: "array", items: t }) } }));
vi.mock("node:fs");
vi.mock("../lib/store");
vi.mock("../lib/doing-sync");

function makeMockPi(): ExtensionAPI {
	return { registerTool: vi.fn() as any, on: vi.fn() as any } as any;
}

function getExecute(fn: (pi: ExtensionAPI) => void) {
	const pi = makeMockPi();
	fn(pi);
	return vi.mocked(pi.registerTool).mock.calls[0][0].execute as any;
}

const VALID_CONTENT = {
	meta: { id: "test-plan", title: "测试路线图", status: "active", created: "2026-01-01", updated: "2026-01-01", tags: [] },
	epics: [
		{
			id: "E1", title: "Epic 1", description: "测试", status: "todo", priority: "high",
			project: "/test", stories: [],
		},
	],
};

describe("registerPlanTool", () => {
	const execute = getExecute(registerPlanTool);

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as any);
		vi.mocked(getRoadmapFilePath).mockReturnValue("/fake/path.roadmap.json");
	});

	it("创建新路线图（action=create）", async () => {
		vi.mocked(readRoadmap).mockReturnValue(null);
		vi.mocked(writeRoadmap).mockImplementation(() => {});

		const result = await execute("call-1", {
			roadmapId: "test-plan",
			content: VALID_CONTENT,
			action: "create",
		}, undefined, undefined, {} as any);

		expect(result.content[0].text).toContain("已创建");
		expect(writeRoadmap).toHaveBeenCalled();
	});

	it("更新路线图（action=update）", async () => {
		vi.mocked(readRoadmap).mockReturnValue(VALID_CONTENT as any);
		vi.mocked(writeRoadmap).mockImplementation(() => {});
		vi.mocked(syncDoingChanges).mockImplementation(() => {});

		const result = await execute("call-1", {
			roadmapId: "test-plan",
			content: VALID_CONTENT,
			action: "update",
		}, undefined, undefined, {} as any);

		expect(result.content[0].text).toContain("已更新");
		expect(syncDoingChanges).toHaveBeenCalled();
	});

	it("action=update 但旧 roadmap 不存在时不调 syncDoingChanges", async () => {
		vi.mocked(readRoadmap).mockReturnValue(null);
		vi.mocked(writeRoadmap).mockImplementation(() => {});

		const result = await execute("call-1", {
			roadmapId: "test-plan",
			content: VALID_CONTENT,
			action: "update",
		}, undefined, undefined, {} as any);

		expect(result.content[0].text).toContain("已更新");
		expect(syncDoingChanges).not.toHaveBeenCalled();
	});

	it("content 为字符串时自动解析 JSON", async () => {
		vi.mocked(readRoadmap).mockReturnValue(null);
		vi.mocked(writeRoadmap).mockImplementation(() => {});

		const result = await execute("call-1", {
			roadmapId: "test-plan",
			content: JSON.stringify(VALID_CONTENT),
			action: "create",
		}, undefined, undefined, {} as any);

		expect(result.content[0].text).toContain("已创建");
	});

	it("content 为非法 JSON 字符串时降级为对象处理（由后续校验拦截）", async () => {
		const result = await execute("call-1", {
			roadmapId: "test-plan",
			content: "not-json-string",
			action: "create",
		}, undefined, undefined, {} as any);

		expect(result.content[0].text).toContain("必须是有效的 JSON 对象");
	});

	it("content 为 null 时返回错误", async () => {
		const result = await execute("call-1", {
			roadmapId: "test-plan",
			content: null,
			action: "create",
		}, undefined, undefined, {} as any);

		expect(result.content[0].text).toContain("必须是有效的 JSON 对象");
	});

	it("content 缺少 meta.id 时返回错误", async () => {
		const result = await execute("call-1", {
			roadmapId: "test-plan",
			content: { meta: { title: "标题" }, epics: [] },
			action: "create",
		}, undefined, undefined, {} as any);

		expect(result.content[0].text).toContain("meta.id");
	});

	it("content 缺少 meta.title 时返回错误", async () => {
		const result = await execute("call-1", {
			roadmapId: "test-plan",
			content: { meta: { id: "test" }, epics: [] },
			action: "create",
		}, undefined, undefined, {} as any);

		expect(result.content[0].text).toContain("meta.title");
	});

	it("自动更新 meta.updated 到当天日期", async () => {
		vi.mocked(readRoadmap).mockReturnValue(null);
		vi.mocked(writeRoadmap).mockImplementation(() => {});

		await execute("call-1", {
			roadmapId: "test-plan",
			content: VALID_CONTENT,
			action: "create",
		}, undefined, undefined, {} as any);

		const written = vi.mocked(writeRoadmap).mock.calls[0][1];
		expect(written.meta.updated).toBe(new Date().toISOString().slice(0, 10));
	});

	it("update 模式调 syncDoingChanges", async () => {
		vi.mocked(readRoadmap).mockReturnValue(VALID_CONTENT as any);
		vi.mocked(writeRoadmap).mockImplementation(() => {});
		vi.mocked(syncDoingChanges).mockImplementation(() => {});

		await execute("call-1", {
			roadmapId: "test-plan",
			content: VALID_CONTENT,
			action: "update",
		}, undefined, undefined, { sessionManager: { getSessionFile: () => "session-abc.jsonl" } } as any);

		expect(syncDoingChanges).toHaveBeenCalled();
	});

	it("planPath 合法时正常写入", async () => {
		vi.mocked(readRoadmap).mockReturnValue(null);
		vi.mocked(writeRoadmap).mockImplementation(() => {});

		const contentWithPlan = {
			...VALID_CONTENT,
			epics: [{ ...VALID_CONTENT.epics[0], planPath: "E1.md" }],
		};

		const result = await execute("call-1", {
		
oadmapId: "test-plan",
			content: contentWithPlan,
			action: "create",
		}, undefined, undefined, {} as any);

		expect(result.content[0].text).toContain("已创建");
		expect(writeRoadmap).toHaveBeenCalled();
	});

	it("planPath 合法但文件不存在时警告", async () => {
		vi.mocked(readRoadmap).mockReturnValue(null);
		vi.mocked(writeRoadmap).mockImplementation(() => {});
		vi.mocked(fs.existsSync).mockReturnValue(false);

		const contentWithPlan = {
			...VALID_CONTENT,
			epics: [{ ...VALID_CONTENT.epics[0], planPath: "E1.md" }],
		};

		const result = await execute("call-1", {
			roadmapId: "test-plan",
			content: contentWithPlan,
			action: "create",
		}, undefined, undefined, {} as any);

		expect(result.content[0].text).toContain("已创建");
		expect(result.content[0].text).toContain("⚠️");
		expect(result.content[0].text).toContain("E1.md");
	});

	it("planPath 合法且文件存在时不警告", async () => {
		vi.mocked(readRoadmap).mockReturnValue(null);
		vi.mocked(writeRoadmap).mockImplementation(() => {});
		vi.mocked(fs.existsSync).mockReturnValue(true);

		const contentWithPlan = {
			...VALID_CONTENT,
			epics: [{ ...VALID_CONTENT.epics[0], planPath: "E1.md" }],
		};

		const result = await execute("call-1", {
			roadmapId: "test-plan",
			content: contentWithPlan,
			action: "create",
		}, undefined, undefined, {} as any);

		expect(result.content[0].text).toContain("已创建");
		expect(result.content[0].text).not.toContain("⚠️");
	});

	it("planPath 格式非法时返回警告", async () => {
		vi.mocked(readRoadmap).mockReturnValue(null);
		vi.mocked(writeRoadmap).mockImplementation(() => {});

		const contentWithBadPlan = {
			...VALID_CONTENT,
			epics: [{ ...VALID_CONTENT.epics[0], planPath: "../hack.md" }],
		};

		const result = await execute("call-1", {
		
oadmapId: "test-plan",
			content: contentWithBadPlan,
			action: "create",
		}, undefined, undefined, {} as any);

		expect(result.content[0].text).toContain("../hack.md");
	});
});
