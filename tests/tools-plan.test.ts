/**
 * tests tools-plan.ts — registerPlanTool（纯输出，不写文件）
 *
 * plan 是讨论沙盘，输出拆解结果 + 操作指南。
 * 不再调 writeRoadmap / syncDoingChanges / scanPlanPaths。
 */
import * as fs from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { registerPlanTool } from "../lib/tools-plan";

vi.mock("@sinclair/typebox", () => ({ Type: { Object: () => ({}), String: () => ({}), Number: () => ({}), Boolean: () => ({}), Any: () => ({}), Optional: (t: any) => t, Union: (t: any[]) => t[0], Literal: (v: any) => ({ type: "literal", value: v }), Array: (t: any) => ({ type: "array", items: t }) } }));
vi.mock("node:fs");

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
			project: "/test", stories: [
				{ id: "E1.S1", title: "Story 1", description: "S1描述", status: "todo", tasks: [
					{ id: "E1.S1.T1", title: "Task 1", status: "todo" },
				] },
			],
		},
	],
};

describe("registerPlanTool", () => {
	const execute = getExecute(registerPlanTool);

	it("create 时输出拆解方案含 (新建) 标签", async () => {
		const result = await execute("call-1", {
			roadmapId: "test-plan",
			content: VALID_CONTENT,
			action: "create",
		}, undefined, undefined, {} as any);

		expect(result.content[0].text).toContain("新建");
		expect(result.content[0].text).toContain("测试路线图");
		expect(result.content[0].text).toContain("Epic E1");
		expect(result.content[0].text).toContain("Story E1.S1");
		expect(result.content[0].text).toContain("Task E1.S1.T1");
	});

	it("update 时输出拆解方案含 (更新) 标签", async () => {
		const result = await execute("call-1", {
			roadmapId: "test-plan",
			content: VALID_CONTENT,
			action: "update",
		}, undefined, undefined, {} as any);

		expect(result.content[0].text).toContain("更新");
	});

	it("输出包含下一步 add 操作指南", async () => {
		const result = await execute("call-1", {
			roadmapId: "test-plan",
			content: VALID_CONTENT,
			action: "create",
		}, undefined, undefined, {} as any);

		const text = result.content[0].text;
		expect(text).toContain("📌 下一步");
		expect(text).toContain("roadmap_add");
	});

	it("content 为字符串时自动解析 JSON", async () => {
		const result = await execute("call-1", {
			roadmapId: "test-plan",
			content: JSON.stringify(VALID_CONTENT),
			action: "create",
		}, undefined, undefined, {} as any);

		expect(result.content[0].text).toContain("新建");
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

	it("planPath 格式非法时返回警告", async () => {
		const contentWithBadPlan = {
			...VALID_CONTENT,
			epics: [{ ...VALID_CONTENT.epics[0], planPath: "../hack.md" }],
		};

		const result = await execute("call-1", {
			roadmapId: "test-plan",
			content: contentWithBadPlan,
			action: "create",
		}, undefined, undefined, {} as any);

		expect(result.content[0].text).toContain("../hack.md");
	});

	it("空 epics 时也能输出", async () => {
		const emptyContent = {
			meta: { id: "test-empty", title: "空路线图", status: "active", created: "2026-01-01", updated: "2026-01-01", tags: [] },
			epics: [],
		};

		const result = await execute("call-1", {
			roadmapId: "test-empty",
			content: emptyContent,
			action: "create",
		}, undefined, undefined, {} as any);

		expect(result.content[0].text).toContain("空路线图");
		expect(result.content[0].text).toContain("📌 下一步");
	});
});

describe("formatPlanOutput", () => {
	// formatPlanOutput 是纯函数，直接导出测试
	it("应通过 registerPlanTool 间接测试", async () => {
		// 已在上面覆盖
	});
});
