/**
 * tools-query 过滤逻辑测试
 *
 * 验证 roadmap_show / roadmap_list 的过滤能力：
 * - 默认隐藏已完成/已归档
 * - epic_id 过滤
 * - 时间戳显示
 */

import { describe, expect, it } from "vitest";
import {
	formatRoadmapDetail,
	getLatestActivityDate,
	shortSessionId,
} from "../lib/tools-query-format";
import type { RoadmapFile } from "../lib/types";

const testRoadmap: RoadmapFile = {
	meta: {
		id: "test",
		title: "测试",
		status: "active",
		created: "2026-01-01",
		updated: "2026-01-01",
		tags: [],
	},
	epics: [
		{
			id: "E1",
			title: "活跃 Epic",
			description: "进行中",
			status: "doing",
			priority: "high",
			project: "/test",
			createdDate: "2026-01-01",
			doingDate: "2026-01-05",
			stories: [
				{
					id: "E1.S1",
					title: "活跃 Story",
					description: "进行中",
					status: "doing",
					createdDate: "2026-01-01",
					doingDate: "2026-01-05",
					tasks: [
						{
							id: "E1.S1.T1",
							title: "Done Task",
							status: "done",
							createdDate: "2026-01-01",
							doneDate: "2026-01-03",
							doneBySessionId:
							"2026-05-27T02-00-31-412Z_019e6729-77b4-7bb8-8740-8fce3e7af232",
						},
						{
							id: "E1.S1.T2",
							title: "Doing Task",
							status: "doing",
							createdDate: "2026-01-01",
							doingDate: "2026-01-05",
							doingSessionId:
							"2026-05-27T03-15-00-000Z_019e6789-1111-2222-ee1c-68348bc0abcd",
						},
						{
							id: "E1.S1.T3",
							title: "Todo Task",
							status: "todo",
							createdDate: "2026-01-01",
						},
					],
				},
			],
		},
		{
			id: "E2",
			title: "已完成 Epic",
			description: "完成了",
			status: "done",
			priority: "medium",
			project: "/test",
			createdDate: "2026-01-01",
			doneDate: "2026-01-10",
			stories: [
				{
					id: "E2.S1",
					title: "Done Story",
					description: "",
					status: "done",
					createdDate: "2026-01-01",
					doneDate: "2026-01-10",
					tasks: [
						{
							id: "E2.S1.T1",
							title: "Done Task",
							status: "done",
							createdDate: "2026-01-01",
							doneDate: "2026-01-10",
						},
					],
				},
			],
		},
		{
			id: "E3",
			title: "已归档 Epic",
			description: "归档了",
			status: "done",
			priority: "low",
			project: "/test",
			createdDate: "2026-01-01",
			doneDate: "2026-01-15",
			archived: true,
			stories: [
				{
					id: "E3.S1",
					title: "Archived Story",
					description: "",
					status: "done",
					createdDate: "2026-01-01",
					doneDate: "2026-01-15",
					archived: true,
					tasks: [
						{
							id: "E3.S1.T1",
							title: "Archived Task",
							status: "done",
							createdDate: "2026-01-01",
							doneDate: "2026-01-15",
							archived: true,
						},
					],
				},
			],
		},
	],
};

describe("formatRoadmapDetail", () => {
	it("默认显示活跃 Epic，折叠已完成，隐藏已归档", () => {
		const text = formatRoadmapDetail(testRoadmap, {
			showCompleted: false,
			showArchived: false,
		});
		expect(text).toContain("活跃 Epic");
		expect(text).toContain("✅ E2: 已完成 Epic"); // 折叠行
		expect(text).not.toContain("E3"); // 已归档隐藏
		expect(text).not.toContain("E2.S1"); // 已完成折叠，不展开
	});

	it("show_completed=true 展开已完成 Epic", () => {
		const text = formatRoadmapDetail(testRoadmap, {
			showCompleted: true,
			showArchived: false,
		});
		expect(text).toContain("活跃 Epic");
		expect(text).toContain("已完成 Epic");
		expect(text).toContain("E2.S1"); // 展开
		expect(text).toContain("E2.S1.T1"); // 展开到 Task
	});

	it("show_archived=true 显示已归档 Epic", () => {
		const text = formatRoadmapDetail(testRoadmap, {
			showCompleted: true,
			showArchived: true,
		});
		expect(text).toContain("已归档 Epic");
		expect(text).toContain("E3.S1.T1");
	});

	it("epic_id=E1 只显示指定 Epic", () => {
		const text = formatRoadmapDetail(testRoadmap, {
			epicId: "E1",
			showCompleted: true,
		});
		expect(text).toContain("活跃 Epic");
		expect(text).not.toContain("已完成 Epic");
		expect(text).not.toContain("已归档 Epic");
	});

	it("时间戳显示：created/doing/done/sessionId", () => {
		const text = formatRoadmapDetail(testRoadmap, {
			epicId: "E1",
			showCompleted: true,
		});
		// Done Task 应显示 created + done + by
		expect(text).toContain("created: 2026-01-01");
		expect(text).toContain("done: 2026-01-03");
		expect(text).toContain("by: 8740-8fce3e7af232");
		// Doing Task 应显示 doing + session
		expect(text).toContain("doing: 2026-01-05");
		expect(text).toContain("session: ee1c-68348bc0abcd");
		// Todo Task 只显示 created
		const todoLine = text.split("\n").find((l) => l.includes("E1.S1.T3"));
		expect(todoLine).toContain("created: 2026-01-01");
		expect(todoLine).not.toContain("doing:");
	});

	describe("getLatestActivityDate", () => {
		it("返回 Epic 下最新 task 的日期", () => {
			const date = getLatestActivityDate(testRoadmap.epics[0]);
			expect(date).toBe("2026-01-05"); // doingDate of T2
		});

		it("无 task 且无 epic 级日期时返回 undefined", () => {
			const emptyEpic = {
				id: "E1",
				title: "test",
				status: "todo",
				stories: [],
				priority: "medium",
				description: "",
				project: "",
			};
			const date = getLatestActivityDate(emptyEpic as any);
			expect(date).toBeUndefined();
		});

		it("只有 createdDate 时返回 createdDate", () => {
			const epic = {
				...testRoadmap.epics[0],
				stories: [
					{
						...testRoadmap.epics[0].stories[0],
						tasks: [
							{
								id: "T1",
								title: "test",
								status: "todo",
								createdDate: "2026-03-15",
							},
						],
					},
				],
			};
			expect(getLatestActivityDate(epic as any)).toBe("2026-03-15");
		});
	});

	describe("shortSessionId", () => {
		it("从完整会话 ID 提取 UUID 最后两段", () => {
			expect(
				shortSessionId(
					"2026-05-27T02-00-31-412Z_019e6729-77b4-7bb8-8740-8fce3e7af232",
				),
			).toBe("8740-8fce3e7af232");
		});

		it("纯 UUID 直接取最后两段", () => {
			expect(shortSessionId("019e6729-77b4-7bb8-8740-8fce3e7af232")).toBe(
				"8740-8fce3e7af232",
			);
		});

		it("短 ID 原样返回", () => {
			expect(shortSessionId("abc")).toBe("abc");
		});
	});

	it("状态图标正确", () => {
		const text = formatRoadmapDetail(testRoadmap, {
			epicId: "E1",
			showCompleted: true,
		});
		expect(text).toContain("✅ E1.S1.T1"); // done
		expect(text).toContain("🔄 E1.S1.T2"); // doing
		expect(text).toContain("⬜ E1.S1.T3"); // todo
	});

	describe("依赖关系展示", () => {
		const rmWithDeps: RoadmapFile = {
			meta: {
				id: "deps",
				title: "依赖测试",
				status: "active",
				created: "2026-01-01",
				updated: "2026-01-01",
				tags: [],
			},
			epics: [
				{
					id: "E1",
					title: "前置 Epic",
					description: "",
					status: "done",
					priority: "high",
					project: "/test",
					stories: [
						{
							id: "E1.S1",
							title: "前置 Story",
							description: "",
							status: "done",
							tasks: [
								{
									id: "E1.S1.T1",
									title: "前置 Task",
									status: "done",
								},
							],
						},
					],
				},
				{
					id: "E2",
					title: "依赖 Epic",
					description: "依赖 E1",
					status: "doing",
					priority: "high",
					project: "/test",
					dependsOn: ["E1"],
					stories: [
						{
							id: "E2.S1",
							title: "依赖 Story",
							description: "依赖 E1.S1",
							status: "doing",
							dependsOn: ["E1.S1"],
							tasks: [
								{
									id: "E2.S1.T1",
									title: "依赖 Task",
									status: "doing",
									dependsOn: ["E1.S1.T1"],
								},
							],
						},
					],
				},
			],
		};

		it("Epic 依赖展示", () => {
			const text = formatRoadmapDetail(rmWithDeps, {
				showCompleted: true,
			});
			expect(text).toContain("Dependencies: E1(✅)");
		});

		it("Story 依赖展示", () => {
			const text = formatRoadmapDetail(rmWithDeps, {
				showCompleted: true,
			});
			expect(text).toContain("[deps: E1.S1(✅)]");
		});

		it("Task 依赖仍然展示", () => {
			const text = formatRoadmapDetail(rmWithDeps, {
				showCompleted: true,
			});
			expect(text).toContain("[deps: E1.S1.T1(✅)]");
		});

		it("无依赖时不展示依赖信息", () => {
			const text = formatRoadmapDetail(testRoadmap, { epicId: "E1" });
			expect(text).not.toContain("Dependencies:");
		});
	});
});
