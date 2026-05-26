/**
 * doing-store 边缘情况测试
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupDoing,
	DOING_FILE,
	makeRoadmap,
	setupCleanDoing,
} from "./doing-helpers";

const createdRoadmaps: string[] = [];
beforeEach(async () => {
	await setupCleanDoing();
});
afterEach(() => cleanupDoing(createdRoadmaps));

describe("doing-store 边缘情况", () => {
	it("clearDoing 不存在的条目不报错", async () => {
		const { clearDoing, readDoing } = await import("../lib/doing-store");
		expect(() => clearDoing("no-such-rm", "E9.S9.T9")).not.toThrow();
		expect(readDoing()).toEqual([]);
	});

	it("clearDoing 只清除匹配的 roadmapId+taskId", async () => {
		const { addDoing, clearDoing, clearAllDoing, readDoing } = await import(
			"../lib/doing-store"
		);
		clearAllDoing();
		addDoing({
			roadmapId: "rm-a",
			taskId: "E1.S1.T1",
			taskTitle: "A",
			startedAt: "2026-01-01",
		});
		addDoing({
			roadmapId: "rm-b",
			taskId: "E1.S1.T1",
			taskTitle: "B",
			startedAt: "2026-01-01",
		});
		addDoing({
			roadmapId: "rm-a",
			taskId: "E1.S1.T2",
			taskTitle: "C",
			startedAt: "2026-01-01",
		});

		clearDoing("rm-a", "E1.S1.T1");
		const entries = readDoing();
		expect(entries).toHaveLength(2);
		expect(
			entries.find((e) => e.roadmapId === "rm-b" && e.taskId === "E1.S1.T1"),
		).toBeTruthy();
		expect(
			entries.find((e) => e.roadmapId === "rm-a" && e.taskId === "E1.S1.T2"),
		).toBeTruthy();
	});

	it("readDoing 文件损坏返回空数组", async () => {
		fs.mkdirSync(path.dirname(DOING_FILE), { recursive: true });
		fs.writeFileSync(DOING_FILE, "NOT VALID JSON{{{", "utf-8");
		const { readDoing } = await import("../lib/doing-store");
		expect(readDoing()).toEqual([]);
	});

	it("syncDoing 清理已 done 的条目", async () => {
		const { addDoing, syncDoing, readDoing } = await import(
			"../lib/doing-store"
		);
		addDoing({
			roadmapId: "test-sync",
			taskId: "E0.S0.T0",
			taskTitle: "已完成",
			startedAt: "2026-01-01",
		});
		addDoing({
			roadmapId: "test-sync",
			taskId: "E0.S0.T1",
			taskTitle: "还在做",
			startedAt: "2026-01-01",
		});

		const roadmaps = [
			makeRoadmap("test-sync", [
				[
					{ id: "E0.S0.T0", status: "done" },
					{ id: "E0.S0.T1", status: "doing" },
				],
			]),
		];

		syncDoing(roadmaps);
		const entries = readDoing();
		expect(entries).toHaveLength(1);
		expect(entries[0].taskId).toBe("E0.S0.T1");
	});

	it("syncDoing 清理已 dropped 的条目", async () => {
		const { addDoing, syncDoing, readDoing } = await import(
			"../lib/doing-store"
		);
		addDoing({
			roadmapId: "test-drop",
			taskId: "E0.S0.T0",
			taskTitle: "已丢弃",
			startedAt: "2026-01-01",
		});

		const roadmaps = [
			makeRoadmap("test-drop", [[{ id: "E0.S0.T0", status: "dropped" }]]),
		];

		syncDoing(roadmaps);
		expect(readDoing()).toEqual([]);
	});

	it("syncDoing 不误清 doing/todo 状态的条目", async () => {
		const { addDoing, syncDoing, readDoing } = await import(
			"../lib/doing-store"
		);
		addDoing({
			roadmapId: "test-keep",
			taskId: "E0.S0.T0",
			taskTitle: "doing",
			startedAt: "2026-01-01",
		});
		addDoing({
			roadmapId: "test-keep",
			taskId: "E0.S0.T1",
			taskTitle: "todo",
			startedAt: "2026-01-01",
		});

		const roadmaps = [
			makeRoadmap("test-keep", [
				[
					{ id: "E0.S0.T0", status: "doing" },
					{ id: "E0.S0.T1", status: "todo" },
				],
			]),
		];

		syncDoing(roadmaps);
		expect(readDoing()).toHaveLength(2);
	});

	it("syncDoing 清理不在 roadmap 中的残留条目", async () => {
		const { addDoing, syncDoing, readDoing } = await import(
			"../lib/doing-store"
		);
		addDoing({
			roadmapId: "test-orphan",
			taskId: "E0.S0.T0",
			taskTitle: "孤儿任务",
			startedAt: "2026-01-01",
		});

		const roadmaps = [
			makeRoadmap("test-orphan", [[{ id: "E0.S0.T1", status: "doing" }]]),
		];

		syncDoing(roadmaps);
		expect(readDoing()).toHaveLength(0);
	});

	it("syncDoing 处理空 roadmap 列表", async () => {
		const { addDoing, syncDoing, readDoing } = await import(
			"../lib/doing-store"
		);
		addDoing({
			roadmapId: "rm-x",
			taskId: "E0.S0.T0",
			taskTitle: "X",
			startedAt: "2026-01-01",
		});

		syncDoing([]);
		expect(readDoing()).toHaveLength(0);
	});
});
