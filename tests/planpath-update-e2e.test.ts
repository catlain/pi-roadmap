/**
 * planPath update 端到端测试 — 不 mock，验证真实数据流
 * 覆盖：updateItem/updateTask 真正写入 planPath + format 展示
 */
import { describe, it, expect } from "vitest";
import { updateItem, updateTask } from "../lib/tools-atomic-utils";
import { formatRoadmapDetail } from "../lib/tools-query-format";
import type { RoadmapFile, Epic, Story, Task } from "../lib/types";

const BASE_EPIC: Epic = {
	id: "E1",
	title: "测试Epic",
	description: "测试",
	status: "todo",
	priority: "high",
	createdDate: "2026-05-30",
	project: "/test-project",
	stories: [],
};

const BASE_STORY: Story = {
	id: "E1.S1",
	title: "测试Story",
	description: "测试",
	status: "todo",
	createdDate: "2026-05-30",
	tasks: [],
};

const BASE_TASK: Task = {
	id: "E1.S1.T1",
	title: "测试Task",
	status: "todo",
	createdDate: "2026-05-30",
};

function makeRM(): RoadmapFile {
	const story = { ...BASE_STORY, tasks: [{ ...BASE_TASK }] };
	const epic = { ...BASE_EPIC, stories: [story] };
	return {
		meta: {
			id: "test",
			title: "测试路线图",
			status: "active",
			created: "2026-05-30",
			updated: "2026-05-30",
			tags: [],
		},
		epics: [epic],
	};
}

describe("planPath update 端到端（不 mock）", () => {
	it("updateItem 为 Epic 设置 planPath 后，epic.planPath 被修改", () => {
		const rm = makeRM();
		const epic = rm.epics[0];
		const result = updateItem(rm, epic, { planPath: "E1.md" }, "session-1");
		expect(result).toContain("planPath: E1.md");
		expect(epic.planPath).toBe("E1.md");
	});

	it("updateItem 为 Story 设置 planPath 后，story.planPath 被修改", () => {
		const rm = makeRM();
		const story = rm.epics[0].stories[0];
		const result = updateItem(rm, story, { planPath: "E1-S1.md" }, "session-1");
		expect(result).toContain("planPath: E1-S1.md");
		expect(story.planPath).toBe("E1-S1.md");
	});

	it("updateTask 为 Task 设置 planPath 后，task.planPath 被修改", () => {
		const rm = makeRM();
		const task = rm.epics[0].stories[0].tasks[0];
		const result = updateTask(rm, task, { planPath: "E1-S1-T1.md" }, "session-1");
		expect(result).toContain("planPath: E1-S1-T1.md");
		expect(task.planPath).toBe("E1-S1-T1.md");
	});

	it("formatRoadmapDetail 展示 Epic 的 planPath", () => {
		const rm = makeRM();
		rm.epics[0].planPath = "E1.md";
		const output = formatRoadmapDetail(rm);
		expect(output).toContain("计划文档: E1.md");
	});

	it("formatRoadmapDetail 展示 Story 的 planPath", () => {
		const rm = makeRM();
		rm.epics[0].stories[0].planPath = "E1-S1.md";
		const output = formatRoadmapDetail(rm);
		expect(output).toContain("计划文档: E1-S1.md");
	});

	it("formatRoadmapDetail 展示 Task 的 planPath", () => {
		const rm = makeRM();
		rm.epics[0].stories[0].tasks[0].planPath = "E1-S1-T1.md";
		const output = formatRoadmapDetail(rm);
		expect(output).toContain("计划文档: E1-S1-T1.md");
	});

	it("updateItem 清除 planPath（传空字符串）", () => {
		const rm = makeRM();
		const epic = rm.epics[0];
		epic.planPath = "E1.md";
		updateItem(rm, epic, { planPath: "" }, "session-1");
		expect(epic.planPath).toBe("");
	});
});
