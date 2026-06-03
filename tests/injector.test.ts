/**
 * injector.ts 测试 — 注入文本生成
 */
import { describe, expect, it } from "vitest";
import { generateInjection, timeSince } from "../lib/injector";
import type { RoadmapFile } from "../lib/types";

const ACTIVE_ROADMAP: RoadmapFile = {
	meta: {
		id: "test-inject",
		title: "注入测试",
		status: "active",
		created: "2026-01-01",
		updated: "2026-01-01",
		tags: [],
	},
	epics: [
		{
			id: "E1",
			title: "Epic A",
			description: "方向 A",
			status: "doing",
			priority: "high",
			project: "/project/a",
			stories: [
				{
					id: "E1.S1",
					title: "Story A1",
					description: "工作 A1",
					status: "doing",
					tasks: [
						{ id: "E1.S1.T1", title: "做某事", status: "todo" },
						{ id: "E1.S1.T2", title: "做另一事", status: "doing" },
					],
				},
			],
		},
		{
			id: "E2",
			title: "Epic B",
			description: "方向 B",
			status: "done",
			priority: "low",
			project: "/project/b",
			stories: [
				{
					id: "E2.S1",
					title: "Story B1",
					description: "已完成",
					status: "done",
					tasks: [{ id: "E2.S1.T1", title: "已完成的事", status: "done" }],
				},
			],
		},
		{
			id: "E3",
			title: "Epic C",
			description: "方向 C",
			status: "todo",
			priority: "medium",
			project: "/project/c",
			planPath: "E3.md",
			stories: [
				{
					id: "E3.S1",
					title: "Story C1",
					description: "工作 C1",
					status: "todo",
					tasks: [{ id: "E3.S1.T1", title: "C1 任务", status: "todo" }],
				},
			],
		},
	],
};

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

	it("包含进度条", () => {
		const text = generateInjection([ACTIVE_ROADMAP]);
		expect(text).toMatch(/■|□/); // 有进度条字符
	});

	it("不显示进度条（配置关闭）", () => {
		const text = generateInjection([ACTIVE_ROADMAP], {
			showProgressBar: false,
		});
		expect(text).not.toMatch(/\[■|□/);
	});

	it("maxLines 截断", () => {
		const text = generateInjection([ACTIVE_ROADMAP], { maxLines: 3 });
		expect(text).toContain("截断");
	});

	it("有 planPath 的 Epic 显示计划路径", () => {
		const text = generateInjection([ACTIVE_ROADMAP]);
		// E1 没有 planPath，E2 是 done 不显示，E3 有 planPath
		expect(text).not.toMatch(/Epic E1.*plan:/);
		expect(text).toMatch(/Epic E3.*plan: E3.md/);
	});

	it("doing 任务显示 🔄 进行中段落", () => {
		const text = generateInjection([ACTIVE_ROADMAP]);
		// E1.S1.T2 是 doing
		expect(text).toContain("🔄 进行中");
		expect(text).toContain("E1.S1.T2 做另一事");
	});

	it("doing 任务显示 session 短 ID", () => {
		const roadmap: RoadmapFile = {
			...ACTIVE_ROADMAP,
			epics: [
				{
					...ACTIVE_ROADMAP.epics[0],
					stories: [
						{
							...ACTIVE_ROADMAP.epics[0].stories[0],
							tasks: [
								{
									id: "E1.S1.T1",
									title: "做某事",
									status: "doing",
									doingSessionId:
										"2026-05-27T02-00-31-412Z_019e6729-77b4-7bb8-8740-8fce3e7af232",
									doingDate: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
								},
							],
						},
					],
				},
			],
		};
		const text = generateInjection([roadmap]);
		expect(text).toContain("session: 8740-8fce3e7af232");
		expect(text).toContain("分钟前");
	});

	it("无 doing 任务时不显示进行中段落", () => {
		const roadmap: RoadmapFile = {
			...ACTIVE_ROADMAP,
			epics: [
				{
					...ACTIVE_ROADMAP.epics[0],
					status: "todo",
					stories: [
						{
							...ACTIVE_ROADMAP.epics[0].stories[0],
							status: "todo",
							tasks: [{ id: "E1.S1.T1", title: "做某事", status: "todo" }],
						},
					],
				},
			],
		};
		const text = generateInjection([roadmap]);
		expect(text).not.toContain("🔄 进行中");
	});
});

describe("timeSince", () => {
	it("刚刚（< 60秒）", () => {
		expect(timeSince(new Date(Date.now() - 30_000).toISOString())).toBe("刚刚");
	});
	it("分钟前", () => {
		expect(timeSince(new Date(Date.now() - 5 * 60_000).toISOString())).toBe(
			"5分钟前",
		);
	});
	it("小时前", () => {
		expect(timeSince(new Date(Date.now() - 3 * 3600_000).toISOString())).toBe(
			"3小时前",
		);
	});
	it("天前", () => {
		expect(timeSince(new Date(Date.now() - 2 * 86400_000).toISOString())).toBe(
			"2天前",
		);
	});
	it("无效日期返回空", () => {
		expect(timeSince("not-a-date")).toBe("");
	});
	it("未来时间返回刚刚", () => {
		expect(timeSince(new Date(Date.now() + 60_000).toISOString())).toBe("刚刚");
	});
});
