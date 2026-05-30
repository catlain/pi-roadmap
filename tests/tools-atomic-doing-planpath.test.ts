/**
 * tests tools-atomic.ts — doing 转换时不再强制 planPath 检查
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerUpdateTool } from "../lib/tools-atomic";
import { atomicUpdate, getSessionId, updateItem, updateTask } from "../lib/tools-atomic-utils";
import type { RoadmapFile } from "../lib/types";

vi.mock("@sinclair/typebox", () => ({
	Type: {
		Object: () => ({}), String: () => ({}), Number: () => ({}),
		Boolean: () => ({}), Any: () => ({}), Optional: (t: any) => t,
		Union: (t: any[]) => t[0], Literal: (v: any) => ({ type: "literal", value: v }),
		Array: (t: any) => ({ type: "array", items: t }),
	},
}));
vi.mock("../lib/tools-atomic-utils");

function makeMockPi(): ExtensionAPI {
	return { registerTool: vi.fn() as any, on: vi.fn() as any } as any;
}

function getExecute(fn: (pi: ExtensionAPI) => void) {
	const pi = makeMockPi();
	fn(pi);
	return vi.mocked(pi.registerTool).mock.calls[0][0].execute as any;
}

const MOCK_RM_WITH_PLAN: RoadmapFile = {
	meta: { id: "test", title: "测试", status: "active", created: "2026-01-01", updated: "2026-01-01", tags: [] },
	epics: [
		{
			id: "E1", title: "Epic 1", description: "测试", status: "todo", priority: "high",
			project: "/test", planPath: "E1.md",
			stories: [
				{
					id: "E1.S1", title: "Story 1", description: "", status: "todo",
					planPath: "E1-S1.md",
					tasks: [
						{ id: "E1.S1.T1", title: "Task 1", status: "todo", planPath: "E1-S1-T1.md" },
						{ id: "E1.S1.T2", title: "Task 2", status: "todo" },
					],
				},
			],
		},
	],
};

describe("registerUpdateTool — doing 时不附加 planPath 提示", () => {
	const execute = getExecute(registerUpdateTool);

	beforeEach(() => vi.clearAllMocks());

	it("Epic → doing 时，直接返回结果，不附加计划文档提示", async () => {
		vi.mocked(atomicUpdate).mockImplementation((_id, fn) => {
			const rm = JSON.parse(JSON.stringify(MOCK_RM_WITH_PLAN)) as RoadmapFile;
			return fn(rm);
		});
		vi.mocked(getSessionId).mockReturnValue("session-1");
		vi.mocked(updateItem).mockReturnValue("✅ E1 已更新：status: todo → doing。");

		const result = await execute("call-1", {
			roadmapId: "test", item_id: "E1", updates: { status: "doing" },
		}, undefined, undefined, {} as any);
		expect(result.content[0].text).toBe("✅ E1 已更新：status: todo → doing。");
	});

	it("Task → doing 时，无 planPath 也不提示创建", async () => {
		vi.mocked(atomicUpdate).mockImplementation((_id, fn) => {
			const rm = JSON.parse(JSON.stringify(MOCK_RM_WITH_PLAN)) as RoadmapFile;
			return fn(rm);
		});
		vi.mocked(getSessionId).mockReturnValue("session-1");
		vi.mocked(updateTask).mockReturnValue("✅ E1.S1.T2 已更新：status: todo → doing。");

		const result = await execute("call-1", {
			roadmapId: "test", item_id: "E1.S1.T2", updates: { status: "doing" },
		}, undefined, undefined, {} as any);
		expect(result.content[0].text).toBe("✅ E1.S1.T2 已更新：status: todo → doing。");
	});
});
