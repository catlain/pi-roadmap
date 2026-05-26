/**
 * tools-query 过滤逻辑测试
 *
 * 验证 roadmap_show / roadmap_list 的过滤能力：
 * - 默认隐藏已完成/已归档
 * - epic_id 过滤
 * - 时间戳显示
 */

import { describe, it, expect } from "vitest";
import type { RoadmapFile } from "../lib/types";
import { formatRoadmapDetail } from "../lib/tools-query-format";

const testRoadmap: RoadmapFile = {
	meta: { id: "test", title: "测试", status: "active", created: "2026-01-01", updated: "2026-01-01", tags: [] },
	epics: [
		{
			id: "E1", title: "活跃 Epic", description: "进行中", status: "doing",
			priority: "high", project: "/test", createdDate: "2026-01-01", doingDate: "2026-01-05",
			stories: [
				{
					id: "E1.S1", title: "活跃 Story", description: "进行中", status: "doing",
					createdDate: "2026-01-01", doingDate: "2026-01-05",
					tasks: [
						{ id: "E1.S1.T1", title: "Done Task", status: "done", createdDate: "2026-01-01", doneDate: "2026-01-03", doneBySessionId: "abc12345" },
						{ id: "E1.S1.T2", title: "Doing Task", status: "doing", createdDate: "2026-01-01", doingDate: "2026-01-05", doingSessionId: "def67890" },
						{ id: "E1.S1.T3", title: "Todo Task", status: "todo", createdDate: "2026-01-01" },
					],
				},
			],
		},
		{
			id: "E2", title: "已完成 Epic", description: "完成了", status: "done",
			priority: "medium", project: "/test", createdDate: "2026-01-01", doneDate: "2026-01-10",
			stories: [
				{
					id: "E2.S1", title: "Done Story", description: "", status: "done",
					createdDate: "2026-01-01", doneDate: "2026-01-10",
					tasks: [
						{ id: "E2.S1.T1", title: "Done Task", status: "done", createdDate: "2026-01-01", doneDate: "2026-01-10" },
					],
				},
			],
		},
		{
			id: "E3", title: "已归档 Epic", description: "归档了", status: "done",
			priority: "low", project: "/test", createdDate: "2026-01-01", doneDate: "2026-01-15",
			archived: true,
			stories: [
				{
					id: "E3.S1", title: "Archived Story", description: "", status: "done",
					createdDate: "2026-01-01", doneDate: "2026-01-15", archived: true,
					tasks: [
						{ id: "E3.S1.T1", title: "Archived Task", status: "done", createdDate: "2026-01-01", doneDate: "2026-01-15", archived: true },
					],
				},
			],
		},
	],
};

describe("formatRoadmapDetail", () => {
	it("默认显示活跃 Epic，折叠已完成，隐藏已归档", () => {
		const text = formatRoadmapDetail(testRoadmap, { showCompleted: false, showArchived: false });
		expect(text).toContain("活跃 Epic");
		expect(text).toContain("✅ E2: 已完成 Epic"); // 折叠行
		expect(text).not.toContain("E3"); // 已归档隐藏
		expect(text).not.toContain("E2.S1"); // 已完成折叠，不展开
	});

	it("show_completed=true 展开已完成 Epic", () => {
		const text = formatRoadmapDetail(testRoadmap, { showCompleted: true, showArchived: false });
		expect(text).toContain("活跃 Epic");
		expect(text).toContain("已完成 Epic");
		expect(text).toContain("E2.S1"); // 展开
		expect(text).toContain("E2.S1.T1"); // 展开到 Task
	});

	it("show_archived=true 显示已归档 Epic", () => {
		const text = formatRoadmapDetail(testRoadmap, { showCompleted: true, showArchived: true });
		expect(text).toContain("已归档 Epic");
		expect(text).toContain("E3.S1.T1");
	});

	it("epic_id=E1 只显示指定 Epic", () => {
		const text = formatRoadmapDetail(testRoadmap, { epicId: "E1", showCompleted: true });
		expect(text).toContain("活跃 Epic");
		expect(text).not.toContain("已完成 Epic");
		expect(text).not.toContain("已归档 Epic");
	});

	it("时间戳显示：created/doing/done/sessionId", () => {
		const text = formatRoadmapDetail(testRoadmap, { epicId: "E1", showCompleted: true });
		// Done Task 应显示 created + done + by
		expect(text).toContain("created: 2026-01-01");
		expect(text).toContain("done: 2026-01-03");
		expect(text).toContain("by: abc12345");
		// Doing Task 应显示 doing + session
		expect(text).toContain("doing: 2026-01-05");
		expect(text).toContain("session: def67890");
		// Todo Task 只显示 created
		const todoLine = text.split("\n").find((l) => l.includes("E1.S1.T3"));
		expect(todoLine).toContain("created: 2026-01-01");
		expect(todoLine).not.toContain("doing:");
	});

	it("状态图标正确", () => {
		const text = formatRoadmapDetail(testRoadmap, { epicId: "E1", showCompleted: true });
		expect(text).toContain("✅ E1.S1.T1"); // done
		expect(text).toContain("🔄 E1.S1.T2"); // doing
		expect(text).toContain("⬜ E1.S1.T3"); // todo
	});
});
