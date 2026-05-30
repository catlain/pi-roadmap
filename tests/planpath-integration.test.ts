/**
 * planPath 端到端集成测试
 *
 * 覆盖：创建 → 查看 → doing 提示 → validator → show/list/next 格式化
 */

import { describe, expect, it } from "vitest";
import { addEpic, addStory, addTask } from "../lib/tools-atomic-logic";
import { formatRoadmapDetail } from "../lib/tools-query-format";
import { updateItem, updateTask } from "../lib/tools-atomic-utils";
import { validateRoadmap } from "../lib/validator";
import { resolveAbsolutePath, generatePlanFileName } from "../lib/plan-resolver";
import type { Epic, RoadmapFile, Story, Task } from "../lib/types";

function makeTask(o: Partial<Task> & { id: string }): Task {
	return { title: `Task ${o.id}`, status: "todo", ...o };
}
function makeStory(o: Partial<Story> & { id: string }, tasks: Task[] = []): Story {
	return { title: `Story ${o.id}`, description: "", status: "todo", tasks, ...o };
}
function makeEpic(o: Partial<Epic> & { id: string }, stories: Story[] = []): Epic {
	return { title: `Epic ${o.id}`, description: "", status: "todo", priority: "medium", project: "/test-project", stories, ...o };
}
function makeRoadmap(epics: Epic[] = []): RoadmapFile {
	return { meta: { id: "test-rm", title: "Test", status: "active", created: "2025-01-01", updated: "2025-01-01", tags: [] }, epics };
}

describe("planPath 端到端：创建 → 查看 → doing", () => {
	it("Epic 创建时传入 planPath → show 展示 📋 → doing 提示读取", () => {
		// 1. 创建 Epic with planPath
		const rm = makeRoadmap();
		const { result } = addEpic(rm, "Epic with plan", "desc", "medium", "/test-project", "E1.md");
		expect(result).toContain("E1.md");
		expect(result).toContain("计划文档");

		const epic = rm.epics[0];
		expect(epic.planPath).toBe("E1.md");

		// 2. resolvePlanPath 生成正确绝对路径
		const absPath = resolveAbsolutePath("E1.md", { project: "/test-project", roadmapId: "test-rm" });
		expect(absPath).toBe("/test-project/.pi/plans/E1.md");

		// 3. show 格式化展示（纯函数只展示文件名，不做路径解析）
		const showOutput = formatRoadmapDetail(rm);
		expect(showOutput).toContain("计划文档: .pi/plans/E1.md");

		// 4. doing 提示
		const doingResult = updateItem(rm, epic, { status: "doing" }, "s1");
		expect(doingResult).toContain("doing");
		// 纯函数不检查 planPath，doing 检查在注册层（已单独测试）
	});

	it("Story 创建时传入 planPath → 自动生成正确命名", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" })]);
		const { result } = addStory(rm, "E1", "New Story", "desc", undefined, "E1-S1.md");
		expect(result).toContain("E1-S1.md");

		const story = rm.epics[0].stories[0];
		expect(story.planPath).toBe("E1-S1.md");
		expect(generatePlanFileName("E1.S1")).toBe("E1-S1.md");
	});

	it("Task 创建时传入 planPath（可选）", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" })])]);
		const { result } = addTask(rm, "E1.S1", "Complex Task", undefined, undefined, "E1-S1-T1.md");
		expect(result).toContain("E1-S1-T1.md");

		const task = rm.epics[0].stories[0].tasks[0];
		expect(task.planPath).toBe("E1-S1-T1.md");
	});

	it("Epic 不传 planPath 时被拒绝", () => {
		const rm = makeRoadmap();
		const { result, epicId } = addEpic(rm, "Epic without planPath", "desc");
		expect(result).toContain("必须关联计划文档");
		expect(epicId).toBeUndefined();
		expect(rm.epics).toHaveLength(0);
	});

	it("多层 planPath 共存 → show 正确展示", () => {
		const rm = makeRoadmap([
			makeEpic({ id: "E1", planPath: "E1.md" }, [
				makeStory({ id: "E1.S1", planPath: "E1-S1.md" }, [
					makeTask({ id: "E1.S1.T1", planPath: "E1-S1-T1.md" }),
					makeTask({ id: "E1.S1.T2" }),
				]),
			]),
		]);

		const output = formatRoadmapDetail(rm);
		// Epic 有 planPath
		expect(output).toContain("E1.md");
		// Story 有 planPath
		expect(output).toContain("E1-S1.md");
		// Task T1 有 planPath
		expect(output).toContain("E1-S1-T1.md");
	});

	it("validator 正确验证多层 planPath", () => {
		// 合法 planPath
		const valid = makeRoadmap([
			makeEpic({ id: "E1", planPath: "E1.md" }, [
				makeStory({ id: "E1.S1", planPath: "E1-S1.md" }, [
					makeTask({ id: "E1.S1.T1", planPath: "E1-S1-T1.md" }),
				]),
			]),
		]);
		expect(validateRoadmap(valid).valid).toBe(true);

		// 非法 planPath（路径穿越）
		const invalid = makeRoadmap([
			makeEpic({ id: "E1", planPath: "../../etc/passwd" }),
		]);
		const vr = validateRoadmap(invalid);
		expect(vr.valid).toBe(false);
		expect(vr.errors.some((e: string) => e.includes("planPath"))).toBe(true);
	});

	it("resolvePlanPath 全局 Epic（无 project）回退到 roadmap plans 目录", () => {
		const epic = makeEpic({ id: "E1", planPath: "E1.md", project: "" });
		// project 为空字符串 → 回退到全局路径
		const absPath = resolveAbsolutePath("E1.md", { roadmapId: "my-roadmap" });
		expect(absPath).toContain("roadmap/plans/my-roadmap/E1.md");
	});
});
