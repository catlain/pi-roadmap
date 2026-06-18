/**
 * injector.ts 测试 — 注入文本生成
 */
import { describe, expect, it } from "vitest";
import { generateInjection, timeSince } from "../lib/injector";
import type { RoadmapFile } from "../lib/types";
import {
	makeRoadmapFile,
	makeEpic,
	makeStory,
	makeTask,
} from "./helpers/test-factories.js";

const ACTIVE_ROADMAP: RoadmapFile = makeRoadmapFile({
	meta: {
		id: "test-inject",
		title: "注入测试",
		status: "active",
		created: "2026-01-01",
		updated: "2026-01-01",
		tags: [],
		nextEid: 10,
	},
	epics: [
		makeEpic({
			id: "E1",
			eid: 1,
			title: "Epic A",
			description: "方向 A",
			status: "doing",
			priority: "high",
			project: "/project/a",
			stories: [
				makeStory({
					id: "E1.S1",
					eid: 2,
					title: "Story A1",
					description: "工作 A1",
					status: "doing",
					tasks: [
						makeTask({
							id: "E1.S1.T1",
							eid: 3,
							title: "做某事",
							status: "todo",
						}),
						makeTask({
							id: "E1.S1.T2",
							eid: 4,
							title: "做另一事",
							status: "doing",
						}),
					],
				}),
			],
		}),
		makeEpic({
			id: "E2",
			eid: 5,
			title: "Epic B",
			description: "方向 B",
			status: "done",
			priority: "low",
			project: "/project/b",
			stories: [
				makeStory({
					id: "E2.S1",
					eid: 6,
					title: "Story B1",
					description: "已完成",
					status: "done",
					tasks: [
						makeTask({
							id: "E2.S1.T1",
							eid: 7,
							title: "已完成的事",
							status: "done",
						}),
					],
				}),
			],
		}),
		makeEpic({
			id: "E3",
			eid: 8,
			title: "Epic C",
			description: "方向 C",
			status: "todo",
			priority: "medium",
			project: "/project/c",
			planPath: "E3.md",
			stories: [
				makeStory({
					id: "E3.S1",
					eid: 9,
					title: "Story C1",
					description: "工作 C1",
					status: "todo",
					tasks: [
						makeTask({
							id: "E3.S1.T1",
							eid: 10,
							title: "C1 任务",
							status: "todo",
						}),
					],
				}),
			],
		}),
	],
});

describe("generateInjection", () => {
	it("活跃 roadmap 生成注入文本", () => {
		const text = generateInjection([ACTIVE_ROADMAP]);
		expect(text).toContain("项目路线图");
		expect(text).toContain("注入测试");
		expect(text).toContain("Epic A");
		expect(text).toContain("做另一事"); // doing 优先的 next task
		expect(text).toContain("roadmap_next");
	});

	it("done/dropped 的 epic 不显示", () => {
		const text = generateInjection([ACTIVE_ROADMAP]);
		expect(text).not.toContain("Epic B"); // done epic 不展示
	});

	it("空活跃 roadmap 返回空字符串", () => {
		const paused: RoadmapFile = {
			...ACTIVE_ROADMAP,
			meta: { ...ACTIVE_ROADMAP.meta, status: "paused" },
		};
		const text = generateInjection([paused]);
		expect(text).toBe("");
	});

	it("无 roadmap 返回空字符串", () => {
		expect(generateInjection([])).toBe("");
	});

	it("优先级排序 high > medium > low", () => {
		const text = generateInjection([ACTIVE_ROADMAP]);
		// 高优先级的 Epic A 应排在前面
		const highIndex = text.indexOf("Epic A");
		const mediumIndex = text.indexOf("Epic C");
		expect(highIndex).toBeLessThan(mediumIndex);
	});

	it("doing task 优先显示", () => {
		const text = generateInjection([ACTIVE_ROADMAP]);
		// doing 的任务应显示在注入文本中
		expect(text).toContain("做另一事");
	});

	it("无 planPath 不显示链接", () => {
		const text = generateInjection([ACTIVE_ROADMAP]);
		// E1 无 planPath，不应出现 .md 链接
		expect(text).not.toMatch(/E1\.md/);
	});

	it("有 planPath 显示链接", () => {
		const text = generateInjection([ACTIVE_ROADMAP]);
		// E3 有 planPath: "E3.md"，应显示链接
		expect(text).toContain("E3.md");
	});
});

describe("timeSince", () => {
	it("正确格式化时间差", () => {
		const now = new Date();
		const toIso = (d: Date) => d.toISOString();
		expect(timeSince(toIso(now))).toBe("刚刚");
		expect(timeSince(toIso(new Date(now.getTime() - 1000 * 60)))).toBe("1分钟前");
		expect(timeSince(toIso(new Date(now.getTime() - 1000 * 60 * 5)))).toBe("5分钟前");
		expect(timeSince(toIso(new Date(now.getTime() - 1000 * 60 * 60)))).toBe("1小时前");
		expect(timeSince(toIso(new Date(now.getTime() - 1000 * 60 * 60 * 2)))).toBe("2小时前");
		expect(timeSince(toIso(new Date(now.getTime() - 1000 * 60 * 60 * 24)))).toBe("1天前");
	});
});