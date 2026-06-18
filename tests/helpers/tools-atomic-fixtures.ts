/**
 * 共享测试 fixture：MOCK_RM + mock helpers
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { vi } from "vitest";
import type { RoadmapFile } from "../../lib/types";

export const MOCK_RM: RoadmapFile = {
	meta: {
		id: "test",
		title: "测试",
		status: "active",
		created: "2026-01-01",
		updated: "2026-01-01",
		tags: [],
		nextEid: 4,
	},
	epics: [
		{
			id: "E1",
			eid: 1,
			title: "Epic 1",
			description: "测试",
			status: "todo",
			priority: "high",
			project: "/test",
			stories: [
				{
					id: "E1.S1",
					eid: 2,
					title: "Story 1",
					description: "",
					status: "todo",
					tasks: [{ id: "E1.S1.T1", eid: 3, title: "Task 1", status: "todo" }],
				},
			],
		},
	],
};

export function makeMockPi(): ExtensionAPI {
	return { registerTool: vi.fn() as any, on: vi.fn() as any } as any;
}

export function getExecute(fn: (pi: ExtensionAPI) => void) {
	const pi = makeMockPi();
	fn(pi);
	return vi.mocked(pi.registerTool).mock.calls[0][0].execute as any;
}
