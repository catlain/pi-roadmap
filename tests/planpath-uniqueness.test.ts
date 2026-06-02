/**
 * planPath 唯一性校验测试
 *
 * 验证 addEpic / addStory / addTask 时，
 * 如果 planPath 已被其他条目使用，返回警告信息。
 */
import { describe, it, expect } from "vitest";
import { addEpic, addStory, addTask } from "../lib/tools-atomic-logic-create";
import { createRoadmap } from "../lib/tools-atomic-logic-create";

function makeRoadmap() {
	return createRoadmap("test-rm", "Test Roadmap");
}

describe("planPath 唯一性校验", () => {
	describe("addEpic", () => {
		it("warns when planPath is already used by another epic", () => {
			const rm = makeRoadmap();
			addEpic(rm, "Epic A", "Desc", "medium", "/p1", "E1.md");
			const { result } = addEpic(rm, "Epic B", "Desc", "medium", "/p2", "E1.md");
			expect(result).toContain("已被以下条目使用");
			expect(result).toContain("E1(Epic A)");
			expect(result).toContain("确认是否需要复用");
			// 仍然成功添加
			expect(result).toContain("✅ Epic E2");
		});

		it("no warning for unique planPath", () => {
			const rm = makeRoadmap();
			addEpic(rm, "Epic A", "Desc", "medium", "/p1", "E1.md");
			const { result } = addEpic(rm, "Epic B", "Desc", "medium", "/p2", "E2.md");
			expect(result).not.toContain("已被以下条目使用");
			expect(result).toContain("✅ Epic E2");
		});
	});

	describe("addStory", () => {
		it("warns when planPath is already used by a story in different epic", () => {
			const rm = makeRoadmap();
			addEpic(rm, "Epic A", "Desc", "medium", "/p1", "E1.md");
			addStory(rm, "E1", "Story A", "", undefined, "shared.md");
			addEpic(rm, "Epic B", "Desc", "medium", "/p2", "E2.md");
			const { result } = addStory(rm, "E2", "Story B", "", undefined, "shared.md");
			expect(result).toContain("已被以下条目使用");
			expect(result).toContain("E1.S1(Story A)");
			expect(result).toContain("确认是否需要复用");
			// 仍然成功添加
			expect(result).toContain("✅ Story E2.S1");
		});

		it("warns when planPath is already used by an epic", () => {
			const rm = makeRoadmap();
			addEpic(rm, "Epic A", "Desc", "medium", "/p1", "shared.md");
			const { result } = addStory(rm, "E1", "Story A", "", undefined, "shared.md");
			expect(result).toContain("已被以下条目使用");
			expect(result).toContain("E1(Epic A)");
		});

		it("no warning for unique planPath", () => {
			const rm = makeRoadmap();
			addEpic(rm, "Epic A", "Desc", "medium", "/p1", "E1.md");
			const { result } = addStory(rm, "E1", "Story A", "", undefined, "S1.md");
			expect(result).not.toContain("已被以下条目使用");
		});
	});

	describe("addTask", () => {
		it("warns when planPath is already used by a task in different story", () => {
			const rm = makeRoadmap();
			addEpic(rm, "Epic A", "Desc", "medium", "/p1", "E1.md");
			addStory(rm, "E1", "Story A", "", undefined, "S1.md");
			addTask(rm, "E1.S1", "Task A", undefined, undefined, "shared-task.md");
			addStory(rm, "E1", "Story B", "", undefined, "S2.md");
			const { result } = addTask(rm, "E1.S2", "Task B", undefined, undefined, "shared-task.md");
			expect(result).toContain("已被以下条目使用");
			expect(result).toContain("E1.S1.T1(Task A)");
			expect(result).toContain("确认是否需要复用");
			// 仍然成功添加
			expect(result).toContain("✅ Task E1.S2.T1");
		});

		it("no warning for unique planPath", () => {
			const rm = makeRoadmap();
			addEpic(rm, "Epic A", "Desc", "medium", "/p1", "E1.md");
			addStory(rm, "E1", "Story A", "", undefined, "S1.md");
			const { result } = addTask(rm, "E1.S1", "Task A", undefined, undefined, "T1.md");
			expect(result).not.toContain("已被以下条目使用");
		});
	});
});
