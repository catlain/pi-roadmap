/**
 * tools-atomic-utils.ts 补充测试 — findPlanPathUsers
 */
import { describe, it, expect } from "vitest";
import { findPlanPathUsers } from "../lib/tools-atomic-utils";
import type { RoadmapFile } from "../lib/types";

const rm: RoadmapFile = {
	meta: {
		id: "test", title: "T", status: "active",
		created: "", updated: "", tags: [], nextEid: 10,
	},
	epics: [{
		id: "E1", eid: 1, title: "Epic", description: "",
		status: "todo", priority: "high", project: "p",
		planPath: "E1.md",
		stories: [{
			id: "E1.S1", eid: 2, title: "Story", description: "", status: "todo",
			planPath: "E1-S1.md",
			tasks: [
				{ id: "E1.S1.T1", eid: 3, title: "Task A", status: "todo", planPath: "E1-S1-T1.md" },
				{ id: "E1.S1.T2", eid: 4, title: "Task B", status: "todo" },
			],
		}],
	}],
};

describe("findPlanPathUsers", () => {
	it("找到所有使用指定 planPath 的项", () => {
		const users = findPlanPathUsers(rm, "E1-S1-T1.md");
		expect(users).toEqual([{ id: "E1.S1.T1", title: "Task A" }]);
	});

	it("Epic 级别也能匹配", () => {
		const users = findPlanPathUsers(rm, "E1.md");
		expect(users).toEqual([{ id: "E1", title: "Epic" }]);
	});

	it("Story 级别也能匹配", () => {
		const users = findPlanPathUsers(rm, "E1-S1.md");
		expect(users).toEqual([{ id: "E1.S1", title: "Story" }]);
	});

	it("无匹配返回空数组", () => {
		const users = findPlanPathUsers(rm, "nonexistent.md");
		expect(users).toEqual([]);
	});
});
