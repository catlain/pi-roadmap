/**
 * 依赖关系功能测试 — 集成部分
 *
 * 覆盖 addTask/addStory 传 dependsOn、updateTask 依赖检查、getNextTasks 排序、validator 检查
 */

import { describe, expect, it } from "vitest";
import { addStory, addTask } from "../lib/tools-atomic-logic";
import { today, updateItem, updateTask } from "../lib/tools-atomic-utils";
import { getNextTasks } from "../lib/progress";
import { validateRoadmap } from "../lib/validator";
import type { Epic, RoadmapFile, Story, Task } from "../lib/types";

function makeTask(o: Partial<Task> & { id: string }): Task {
	return { title: `Task ${o.id}`, status: "todo", ...o };
}
function makeStory(o: Partial<Story> & { id: string }, tasks: Task[] = []): Story {
	return { title: `Story ${o.id}`, description: "", status: "todo", tasks, ...o };
}
function makeEpic(o: Partial<Epic> & { id: string }, stories: Story[] = []): Epic {
	return { title: `Epic ${o.id}`, description: "", status: "todo", priority: "medium", project: "/test", stories, ...o };
}
function makeRoadmap(epics: Epic[] = []): RoadmapFile {
	return { meta: { id: "test", title: "Test", status: "active", created: "2025-01-01", updated: "2025-01-01", tags: [] }, epics };
}

describe("addTask with dependsOn", () => {
	it("传递 dependsOn", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" }, [makeTask({ id: "E1.S1.T1", status: "done" })])])]);
		addTask(rm, "E1.S1", "新Task", undefined, ["E1.S1.T1"]);
		const t = rm.epics[0].stories[0].tasks.find(t => t.title === "新Task")!;
		expect(t.dependsOn).toEqual(["E1.S1.T1"]);
	});
	it("不加 dependsOn 时不设置", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" })])]);
		addTask(rm, "E1.S1", "新Task");
		expect(rm.epics[0].stories[0].tasks[0].dependsOn).toBeUndefined();
	});
});

describe("addStory with dependsOn", () => {
	it("传递 dependsOn", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1", status: "done" })])]);
		addStory(rm, "E1", "新Story", "描述", ["E1.S1"]);
		const s = rm.epics[0].stories.find(s => s.title === "新Story")!;
		expect(s.dependsOn).toEqual(["E1.S1"]);
	});
	it("不加 dependsOn 时不设置", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" })])]);
		addStory(rm, "E1", "新Story", "描述");
		expect(rm.epics[0].stories[1].dependsOn).toBeUndefined();
	});
});

describe("updateTask → doing 依赖检查", () => {
	it("依赖未满足时返回警告", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" }, [
			makeTask({ id: "E1.S1.T1", status: "done" }),
			makeTask({ id: "E1.S1.T2", status: "todo" }),
			makeTask({ id: "E1.S1.T3", status: "todo", dependsOn: ["E1.S1.T2"] }),
		])])]);
		const task = rm.epics[0].stories[0].tasks.find(t => t.id === "E1.S1.T3")!;
		expect(updateTask(rm, task, { status: "doing" }, "s1")).toContain("⚠️");
	});
	it("依赖满足时不警告", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" }, [
			makeTask({ id: "E1.S1.T1", status: "done" }),
			makeTask({ id: "E1.S1.T2", status: "todo", dependsOn: ["E1.S1.T1"] }),
		])])]);
		const task = rm.epics[0].stories[0].tasks.find(t => t.id === "E1.S1.T2")!;
		expect(updateTask(rm, task, { status: "doing" }, "s1")).not.toContain("⚠️");
	});
	it("无 dependsOn 不警告", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" }, [
			makeTask({ id: "E1.S1.T1", status: "todo" }),
		])])]);
		expect(updateTask(rm, rm.epics[0].stories[0].tasks[0], { status: "doing" }, "s1")).not.toContain("⚠️");
	});
	it("updateItem(story) 切 doing 也检查", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [
			makeStory({ id: "E1.S1", status: "todo", dependsOn: ["E1.S2"] }),
			makeStory({ id: "E1.S2", status: "todo" }),
		])]);
		expect(updateItem(rm, rm.epics[0].stories[0], { status: "doing" }, "s1")).toContain("⚠️");
	});
});

describe("getNextTasks 依赖排序", () => {
	it("依赖满足的排在未满足前面", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" }, [
			makeTask({ id: "E1.S1.T0", status: "done" }),
			makeTask({ id: "E1.S1.T1", dependsOn: ["E1.S1.T0"] }),
			makeTask({ id: "E1.S1.T2", dependsOn: ["E1.S1.T3"] }),
			makeTask({ id: "E1.S1.T3" }),
			makeTask({ id: "E1.S1.T4" }),
		])])]);
		const next = getNextTasks(rm, 10);
		const t1 = next.findIndex(t => t.id === "E1.S1.T1");
		const t2 = next.findIndex(t => t.id === "E1.S1.T2");
		const t4 = next.findIndex(t => t.id === "E1.S1.T4");
		expect(t1).toBeLessThan(t2);
		expect(t4).toBeLessThan(t2);
	});
	it("doing 优先于依赖排序", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" }, [
			makeTask({ id: "E1.S1.T1", status: "doing", dependsOn: ["E1.S1.T2"] }),
			makeTask({ id: "E1.S1.T2" }),
		])])]);
		const next = getNextTasks(rm, 10);
		expect(next[0].id).toBe("E1.S1.T1");
		expect(next[1].id).toBe("E1.S1.T2");
	});
});

describe("validator dependsOn 检查", () => {
	it("引用不存在的 ID 报错", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" }, [
			makeTask({ id: "E1.S1.T99", dependsOn: ["NONEXISTENT"] }),
		])])]);
		const r = validateRoadmap(rm);
		expect(r.valid).toBe(false);
		expect(r.errors.some(e => e.includes("NONEXISTENT"))).toBe(true);
	});
	it("合法引用通过", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" }, [
			makeTask({ id: "E1.S1.T0", status: "done" }),
			makeTask({ id: "E1.S1.T1", dependsOn: ["E1.S1.T0"] }),
		])])]);
		expect(validateRoadmap(rm).valid).toBe(true);
	});
	it("循环依赖检测", () => {
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [makeStory({ id: "E1.S1" }, [
			makeTask({ id: "E1.S1.T1", dependsOn: ["E1.S1.T1"] }),
		])])]);
		const r = validateRoadmap(rm);
		expect(r.valid).toBe(false);
		expect(r.errors.some(e => e.includes("循环依赖"))).toBe(true);
	});
	it("story 和 epic 的 dependsOn 也验证", () => {
		// story 引用了不存在的 epic
		const rm = makeRoadmap([makeEpic({ id: "E1" }, [
			makeStory({ id: "E1.S1", dependsOn: ["E99"] }),
		])]);
		const r = validateRoadmap(rm);
		expect(r.valid).toBe(false);
		expect(r.errors.some(e => e.includes("E99"))).toBe(true);
	});
});
