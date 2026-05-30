/**
 * tests/tools-query-format.test.ts — planPath 标记测试
 */
import { describe, expect, it } from "vitest";
import { formatRoadmapDetail } from "../lib/tools-query-format";
import type { RoadmapFile } from "../lib/types";

const BASE_RM: RoadmapFile = {
	meta: {
		id: "test",
		title: "测试路线图",
		status: "active",
		created: "2026-01-01",
		updated: "2026-01-01",
		tags: ["test"],
	},
	epics: [
		{
			id: "E1",
			title: "Epic 有计划",
			description: "这是一个有计划的 Epic",
			status: "doing",
			priority: "high",
			project: "/home/user/project",
			planPath: "E1.md",
			stories: [
				{
					id: "E1.S1",
					title: "Story 有计划",
					description: "有计划的 Story",
					status: "todo",
					planPath: "E1-S1.md",
					tasks: [
						{
							id: "E1.S1.T1",
							title: "Task 有计划",
							status: "todo",
							planPath: "E1-S1-T1.md",
						},
						{
							id: "E1.S1.T2",
							title: "Task 无计划",
							status: "todo",
						},
					],
				},
				{
					id: "E1.S2",
					title: "Story 无计划",
					description: "没有计划",
					status: "todo",
					tasks: [],
				},
			],
		},
		{
			id: "E2",
			title: "Epic 无计划",
			description: "没有计划的 Epic",
			status: "todo",
			priority: "medium",
			project: "/home/user/project",
			stories: [],
		},
	],
};

describe("formatRoadmapDetail — planPath 标记", () => {
	it("Epic 有 planPath 时显示计划文档路径", () => {
		const output = formatRoadmapDetail(BASE_RM);
		expect(output).toContain("计划文档: .pi/plans/E1.md");
	});

	it("Epic 无 planPath 时不显示计划文档", () => {
		const output = formatRoadmapDetail(BASE_RM);
		const e2Section = output.substring(output.indexOf("Epic E2"));
		// E2 没有 planPath，其区域不应包含 📋 或计划文档
		expect(e2Section).not.toContain("计划文档:");
	});

	it("Story 有 planPath 时显示 📋 标记和路径", () => {
		const output = formatRoadmapDetail(BASE_RM);
		expect(output).toContain("E1-S1.md");
	});

	it("Task 有 planPath 时显示 📋 标记和路径", () => {
		const output = formatRoadmapDetail(BASE_RM);
		expect(output).toContain("E1-S1-T1.md");
	});

	it("Task 无 planPath 时不显示计划行", () => {
		const output = formatRoadmapDetail(BASE_RM);
		// E1.S1.T2 没有 planPath，检查它所在行附近没有"计划文档"
		const t2Idx = output.indexOf("E1.S1.T2");
		if (t2Idx >= 0) {
			const nextLine = output.indexOf("\n", t2Idx);
			const lineAfterT2 = output.substring(t2Idx, nextLine > 0 ? nextLine : t2Idx + 100);
			expect(lineAfterT2).not.toContain("计划文档");
		}
	});
});
