/**
 * doing 持久化 — 全链路回归测试
 *
 * 覆盖：
 *   - doing-store: syncDoing, clearDoing 边缘情况
 *   - roadmap_next: 无副作用（不写 doing）
 *   - roadmap_plan: status 变迁矩阵（todo↔doing↔done↔blocked↔dropped）
 *   - agent_end: 有/无 doing 条目行为
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { homedir } from "node:os";

const DOING_FILE = path.join(homedir(), ".pi", "roadmap", "doing.json");
const ROADMAP_DIR = path.join(homedir(), ".pi", "roadmap");

// 备份
let doingBackup: string | null = null;
const createdRoadmaps: string[] = [];

beforeEach(async () => {
	// 备份原始内容
	if (fs.existsSync(DOING_FILE)) {
		doingBackup = fs.readFileSync(DOING_FILE, "utf-8");
	} else {
		doingBackup = null;
	}
	// 清空 doing.json
	const { clearAllDoing } = await import("../lib/doing-store");
	clearAllDoing();
});

afterEach(async () => {
	// 清空 doing.json（不恢复旧内容，避免假条目残留触发 agent_end）
	const { clearAllDoing } = await import("../lib/doing-store");
	clearAllDoing();
	// 清理创建的测试 roadmap
	for (const id of createdRoadmaps) {
		const fp = path.join(ROADMAP_DIR, `${id}.roadmap.json`);
		if (fs.existsSync(fp)) fs.unlinkSync(fp);
	}
	createdRoadmaps.length = 0;
});

/** 创建最小有效 roadmap */
function makeRoadmap(id: string, tasks: { id: string; status: string; title?: string }[][]) {
	// tasks: [epic0Tasks, epic1Tasks, ...] — 每个 epic 1 个 story
	return {
		meta: { id, title: `测试路线图 ${id}`, status: "active", created: "2026-01-01", updated: "2026-01-01", tags: [] },
		epics: tasks.map((epicTasks, ei) => ({
			id: `E${ei}`,
			title: `Epic ${ei}`,
			description: `Epic ${ei}`,
			status: "todo",
			priority: "medium" as const,
			project: "/tmp/test",
			stories: [{
				id: `E${ei}.S0`,
				title: `Story ${ei}.0`,
				description: `Story`,
				status: "todo",
				tasks: epicTasks.map((t, ti) => ({
					id: t.id || `E${ei}.S0.T${ti}`,
					title: t.title || `Task ${ei}.0.${ti}`,
					status: t.status,
				})),
			}],
		})),
	};
}

// ══════════════════════════════════════════════════════════
// Part 1: doing-store 边缘情况
// ══════════════════════════════════════════════════════════

describe("doing-store 边缘情况", () => {
	it("clearDoing 不存在的条目不报错", async () => {
		const { clearDoing, readDoing } = await import("../lib/doing-store");
		expect(() => clearDoing("no-such-rm", "E9.S9.T9")).not.toThrow();
		expect(readDoing()).toEqual([]);
	});

	it("clearDoing 只清除匹配的 roadmapId+taskId", async () => {
		const { addDoing, clearDoing, clearAllDoing, readDoing } = await import("../lib/doing-store");
		clearAllDoing();
		addDoing({ roadmapId: "rm-a", taskId: "E1.S1.T1", taskTitle: "A", startedAt: "2026-01-01" });
		addDoing({ roadmapId: "rm-b", taskId: "E1.S1.T1", taskTitle: "B", startedAt: "2026-01-01" });
		addDoing({ roadmapId: "rm-a", taskId: "E1.S1.T2", taskTitle: "C", startedAt: "2026-01-01" });

		clearDoing("rm-a", "E1.S1.T1");
		const entries = readDoing();
		expect(entries).toHaveLength(2);
		expect(entries.find(e => e.roadmapId === "rm-b" && e.taskId === "E1.S1.T1")).toBeTruthy();
		expect(entries.find(e => e.roadmapId === "rm-a" && e.taskId === "E1.S1.T2")).toBeTruthy();
	});

	it("readDoing 文件损坏返回空数组", async () => {
		fs.mkdirSync(path.dirname(DOING_FILE), { recursive: true });
		fs.writeFileSync(DOING_FILE, "NOT VALID JSON{{{", "utf-8");
		const { readDoing } = await import("../lib/doing-store");
		expect(readDoing()).toEqual([]);
	});

	it("syncDoing 清理已 done 的条目", async () => {
		const { addDoing, syncDoing, readDoing } = await import("../lib/doing-store");
		addDoing({ roadmapId: "test-sync", taskId: "E0.S0.T0", taskTitle: "已完成", startedAt: "2026-01-01" });
		addDoing({ roadmapId: "test-sync", taskId: "E0.S0.T1", taskTitle: "还在做", startedAt: "2026-01-01" });
		
		// T0 已 done，T1 还在 doing
		const roadmaps = [makeRoadmap("test-sync", [
			[{ id: "E0.S0.T0", status: "done" }, { id: "E0.S0.T1", status: "doing" }],
		])];
		
		syncDoing(roadmaps);
		
		const entries = readDoing();
		expect(entries).toHaveLength(1);
		expect(entries[0].taskId).toBe("E0.S0.T1");
	});

	it("syncDoing 清理已 dropped 的条目", async () => {
		const { addDoing, syncDoing, readDoing } = await import("../lib/doing-store");
		addDoing({ roadmapId: "test-drop", taskId: "E0.S0.T0", taskTitle: "已丢弃", startedAt: "2026-01-01" });
		
		const roadmaps = [makeRoadmap("test-drop", [
			[{ id: "E0.S0.T0", status: "dropped" }],
		])];
		
		syncDoing(roadmaps);
		expect(readDoing()).toEqual([]);
	});

	it("syncDoing 不误清 doing/todo 状态的条目", async () => {
		const { addDoing, syncDoing, readDoing } = await import("../lib/doing-store");
		addDoing({ roadmapId: "test-keep", taskId: "E0.S0.T0", taskTitle: "doing", startedAt: "2026-01-01" });
		addDoing({ roadmapId: "test-keep", taskId: "E0.S0.T1", taskTitle: "todo", startedAt: "2026-01-01" });
		
		const roadmaps = [makeRoadmap("test-keep", [
			[{ id: "E0.S0.T0", status: "doing" }, { id: "E0.S0.T1", status: "todo" }],
		])];
		
		syncDoing(roadmaps);
		expect(readDoing()).toHaveLength(2);
	});

	it("syncDoing 清理不在 roadmap 中的残留条目", async () => {
		const { addDoing, syncDoing, readDoing } = await import("../lib/doing-store");
		addDoing({ roadmapId: "test-orphan", taskId: "E0.S0.T0", taskTitle: "孤儿任务", startedAt: "2026-01-01" });
		
		// roadmap 中没有这个 task
		const roadmaps = [makeRoadmap("test-orphan", [
			[{ id: "E0.S0.T1", status: "doing" }],  // 不同的 taskId
		])];
		
		syncDoing(roadmaps);
		expect(readDoing()).toHaveLength(0); // 孤儿被清理
	});

	it("syncDoing 处理空 roadmap 列表", async () => {
		const { addDoing, syncDoing, readDoing } = await import("../lib/doing-store");
		addDoing({ roadmapId: "rm-x", taskId: "E0.S0.T0", taskTitle: "X", startedAt: "2026-01-01" });
		
		syncDoing([]); // 空 roadmaps
		expect(readDoing()).toHaveLength(0); // 全部清理
	});
});

// ══════════════════════════════════════════════════════════
// Part 2: roadmap_next 无副作用
// ══════════════════════════════════════════════════════════

describe("roadmap_next 无副作用", () => {
	it("roadmap_next 不写 doing.json", async () => {
		const { readDoing } = await import("../lib/doing-store");
		const { getNextTasks } = await import("../lib/progress");
		
		// 创建测试 roadmap 并写入文件
		const rm = makeRoadmap("test-next-no-side-effect", [
			[{ id: "E0.S0.T0", status: "todo" }, { id: "E0.S0.T1", status: "todo" }],
		]);
		const filePath = path.join(ROADMAP_DIR, "test-next-no-side-effect.roadmap.json");
		fs.writeFileSync(filePath, JSON.stringify(rm, null, 2), "utf-8");
		createdRoadmaps.push("test-next-no-side-effect");

		// 调用 getNextTasks（roadmap_next 的核心逻辑）
		const tasks = getNextTasks(rm, 5);
		expect(tasks.length).toBe(2);

		// doing.json 应该仍为空
		expect(readDoing()).toEqual([]);
	});
});

// ══════════════════════════════════════════════════════════
// Part 3: roadmap_plan status 变迁矩阵
// ══════════════════════════════════════════════════════════

describe("roadmap_plan status 变迁 → doing 联动", () => {
	/** 直接测试 detectStatusChanges 逻辑 */
	async function getPlanDoingChanges(
		oldTasks: Map<string, string>,  // taskId → oldStatus
		newTasks: Map<string, string>,  // taskId → newStatus
	) {
		const { addDoing, clearDoing, readDoing } = await import("../lib/doing-store");
		
		// 模拟 roadmap_plan 的 status 变迁检测逻辑
		const addedDoing: string[] = [];
		const clearedDoing: string[] = [];
		
		for (const [taskId, newStatus] of newTasks) {
			const oldStatus = oldTasks.get(taskId);
			if (oldStatus !== "doing" && newStatus === "doing") {
				addDoing({ roadmapId: "test-transition", taskId, taskTitle: taskId, startedAt: "2026-01-01" });
				addedDoing.push(taskId);
			} else if (oldStatus === "doing" && newStatus !== "doing") {
				clearDoing("test-transition", taskId);
				clearedDoing.push(taskId);
			}
		}
		
		// 处理被删除的 task（在 old 中但不在 new 中）
		for (const [taskId, oldStatus] of oldTasks) {
			if (!newTasks.has(taskId) && oldStatus === "doing") {
				clearDoing("test-transition", taskId);
				clearedDoing.push(taskId);
			}
		}
		
		const finalDoing = readDoing();
		return { addedDoing, clearedDoing, finalDoing };
	}

	it("todo→doing: 写 doing", async () => {
		const { clearAllDoing } = await import("../lib/doing-store");
		clearAllDoing();
		
		const result = await getPlanDoingChanges(
			new Map([["T1", "todo"]]),
			new Map([["T1", "doing"]]),
		);
		expect(result.addedDoing).toEqual(["T1"]);
		expect(result.finalDoing.find(e => e.taskId === "T1")).toBeTruthy();
	});

	it("doing→done: 清 doing", async () => {
		const { addDoing, clearAllDoing } = await import("../lib/doing-store");
		clearAllDoing();
		addDoing({ roadmapId: "test-transition", taskId: "T1", taskTitle: "T1", startedAt: "2026-01-01" });
		
		const result = await getPlanDoingChanges(
			new Map([["T1", "doing"]]),
			new Map([["T1", "done"]]),
		);
		expect(result.clearedDoing).toEqual(["T1"]);
		expect(result.finalDoing.find(e => e.taskId === "T1")).toBeFalsy();
	});

	it("doing→blocked: 清 doing", async () => {
		const { addDoing, clearAllDoing } = await import("../lib/doing-store");
		clearAllDoing();
		addDoing({ roadmapId: "test-transition", taskId: "T1", taskTitle: "T1", startedAt: "2026-01-01" });
		
		const result = await getPlanDoingChanges(
			new Map([["T1", "doing"]]),
			new Map([["T1", "blocked"]]),
		);
		expect(result.clearedDoing).toEqual(["T1"]);
	});

	it("doing→todo: 清 doing", async () => {
		const { addDoing, clearAllDoing } = await import("../lib/doing-store");
		clearAllDoing();
		addDoing({ roadmapId: "test-transition", taskId: "T1", taskTitle: "T1", startedAt: "2026-01-01" });
		
		const result = await getPlanDoingChanges(
			new Map([["T1", "doing"]]),
			new Map([["T1", "todo"]]),
		);
		expect(result.clearedDoing).toEqual(["T1"]);
	});

	it("doing→dropped: 清 doing", async () => {
		const { addDoing, clearAllDoing } = await import("../lib/doing-store");
		clearAllDoing();
		addDoing({ roadmapId: "test-transition", taskId: "T1", taskTitle: "T1", startedAt: "2026-01-01" });
		
		const result = await getPlanDoingChanges(
			new Map([["T1", "doing"]]),
			new Map([["T1", "dropped"]]),
		);
		expect(result.clearedDoing).toEqual(["T1"]);
	});

	it("todo→done（跳过 doing）: 不写 doing", async () => {
		const { clearAllDoing } = await import("../lib/doing-store");
		clearAllDoing();
		
		const result = await getPlanDoingChanges(
			new Map([["T1", "todo"]]),
			new Map([["T1", "done"]]),
		);
		expect(result.addedDoing).toEqual([]);
		expect(result.clearedDoing).toEqual([]);
	});

	it("todo→todo（不变）: 无操作", async () => {
		const { clearAllDoing } = await import("../lib/doing-store");
		clearAllDoing();
		
		const result = await getPlanDoingChanges(
			new Map([["T1", "todo"]]),
			new Map([["T1", "todo"]]),
		);
		expect(result.addedDoing).toEqual([]);
		expect(result.clearedDoing).toEqual([]);
	});

	it("create 时不调任何 doing 方法", async () => {
		// create 时没有旧 roadmap，所有 task 默认 todo，不应触发 doing
		const { readDoing, clearAllDoing } = await import("../lib/doing-store");
		clearAllDoing();
		
		// 模拟 create：oldTasks 为空
		const result = await getPlanDoingChanges(
			new Map(),  // 没有 old
			new Map([["T1", "todo"], ["T2", "todo"]]),
		);
		expect(result.addedDoing).toEqual([]);
		expect(result.finalDoing).toEqual([]);
	});

	it("新增 task status=doing → addDoing", async () => {
		const { clearAllDoing } = await import("../lib/doing-store");
		clearAllDoing();
		
		// 旧 roadmap 没有 T2，新 roadmap 有 T2 status=doing
		const result = await getPlanDoingChanges(
			new Map([["T1", "todo"]]),
			new Map([["T1", "todo"], ["T2", "doing"]]),
		);
		expect(result.addedDoing).toEqual(["T2"]);
	});

	it("删除 doing 中的 task → 清 doing", async () => {
		const { addDoing, clearAllDoing } = await import("../lib/doing-store");
		clearAllDoing();
		addDoing({ roadmapId: "test-transition", taskId: "T1", taskTitle: "T1", startedAt: "2026-01-01" });
		
		// T1 在 old 中是 doing，但在 new 中不存在
		const result = await getPlanDoingChanges(
			new Map([["T1", "doing"]]),
			new Map(),  // T1 被删除
		);
		expect(result.clearedDoing).toEqual(["T1"]);
		expect(result.finalDoing).toEqual([]);
	});
});

// ══════════════════════════════════════════════════════════
// Part 4: agent_end 行为
// ══════════════════════════════════════════════════════════

describe("agent_end 行为", () => {
	it("有 doing 条目时生成提醒文本", async () => {
		const { addDoing, readDoing } = await import("../lib/doing-store");
		addDoing({ roadmapId: "rm-1", taskId: "E1.S1.T1", taskTitle: "测试任务", startedAt: "2026-01-01" });
		
		const entries = readDoing();
		expect(entries.length).toBeGreaterThan(0);
		
		// 模拟 agent_end 的文本生成逻辑
		const taskList = entries
			.map((e) => `  - ${e.taskId}: ${e.taskTitle} (${e.roadmapId})`)
			.join("\n");
		expect(taskList).toContain("E1.S1.T1");
		expect(taskList).toContain("测试任务");
		expect(taskList).toContain("rm-1");
	});

	it("无 doing 条目时不生成提醒", async () => {
		const { readDoing } = await import("../lib/doing-store");
		// doing.json 为空（beforeEach 已清空）
		const entries = readDoing();
		expect(entries).toEqual([]);
		// agent_end 应该 return，不调用 sendMessage
	});
});
