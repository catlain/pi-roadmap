/**
 * roadmap_plan status 变迁 → doing 联动测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { makeRoadmap, setupCleanDoing, cleanupDoing } from "./doing-helpers";

const createdRoadmaps: string[] = [];
beforeEach(() => setupCleanDoing());
afterEach(() => cleanupDoing(createdRoadmaps));

describe("roadmap_plan status 变迁 → doing 联动", () => {
	async function syncAndCheck(
		oldTasks: { id: string; status: string }[][],
		newTasks: { id: string; status: string }[][],
	) {
		const { readDoing, clearAllDoing } = await import("../lib/doing-store");
		clearAllDoing();
		const { syncDoingChanges } = await import("../lib/doing-sync");

		const oldRm = makeRoadmap("test-sync-changes", oldTasks);
		const newRm = makeRoadmap("test-sync-changes", newTasks);
		syncDoingChanges(oldRm, newRm);
		return readDoing();
	}

	it("todo→doing: 写 doing", async () => {
		const doing = await syncAndCheck(
			[[{ id: "T1", status: "todo" }]],
			[[{ id: "T1", status: "doing" }]],
		);
		expect(doing).toHaveLength(1);
		expect(doing[0].taskId).toBe("T1");
	});

	it("doing→done: 清 doing", async () => {
		const { addDoing, clearAllDoing } = await import("../lib/doing-store");
		clearAllDoing();
		addDoing({ roadmapId: "test-sync-changes", taskId: "T1", taskTitle: "T1", startedAt: "2026-01-01" });

		const { syncDoingChanges } = await import("../lib/doing-sync");
		syncDoingChanges(
			makeRoadmap("test-sync-changes", [[{ id: "T1", status: "doing" }]]),
			makeRoadmap("test-sync-changes", [[{ id: "T1", status: "done" }]]),
		);

		const { readDoing } = await import("../lib/doing-store");
		expect(readDoing().find(e => e.taskId === "T1")).toBeFalsy();
	});

	it("doing→blocked: 清 doing", async () => {
		const { addDoing, clearAllDoing, readDoing } = await import("../lib/doing-store");
		clearAllDoing();
		addDoing({ roadmapId: "test-sync-changes", taskId: "T1", taskTitle: "T1", startedAt: "2026-01-01" });

		const { syncDoingChanges } = await import("../lib/doing-sync");
		syncDoingChanges(
			makeRoadmap("test-sync-changes", [[{ id: "T1", status: "doing" }]]),
			makeRoadmap("test-sync-changes", [[{ id: "T1", status: "blocked" }]]),
		);
		expect(readDoing().find(e => e.taskId === "T1")).toBeFalsy();
	});

	it("doing→todo: 清 doing", async () => {
		const { addDoing, clearAllDoing, readDoing } = await import("../lib/doing-store");
		clearAllDoing();
		addDoing({ roadmapId: "test-sync-changes", taskId: "T1", taskTitle: "T1", startedAt: "2026-01-01" });

		const { syncDoingChanges } = await import("../lib/doing-sync");
		syncDoingChanges(
			makeRoadmap("test-sync-changes", [[{ id: "T1", status: "doing" }]]),
			makeRoadmap("test-sync-changes", [[{ id: "T1", status: "todo" }]]),
		);
		expect(readDoing().find(e => e.taskId === "T1")).toBeFalsy();
	});

	it("doing→dropped: 清 doing", async () => {
		const { addDoing, clearAllDoing, readDoing } = await import("../lib/doing-store");
		clearAllDoing();
		addDoing({ roadmapId: "test-sync-changes", taskId: "T1", taskTitle: "T1", startedAt: "2026-01-01" });

		const { syncDoingChanges } = await import("../lib/doing-sync");
		syncDoingChanges(
			makeRoadmap("test-sync-changes", [[{ id: "T1", status: "doing" }]]),
			makeRoadmap("test-sync-changes", [[{ id: "T1", status: "dropped" }]]),
		);
		expect(readDoing().find(e => e.taskId === "T1")).toBeFalsy();
	});

	it("todo→done（跳过 doing）: 不写 doing", async () => {
		const doing = await syncAndCheck(
			[[{ id: "T1", status: "todo" }]],
			[[{ id: "T1", status: "done" }]],
		);
		expect(doing).toEqual([]);
	});

	it("todo→todo（不变）: 无操作", async () => {
		const doing = await syncAndCheck(
			[[{ id: "T1", status: "todo" }]],
			[[{ id: "T1", status: "todo" }]],
		);
		expect(doing).toEqual([]);
	});

	it("create 时不调任何 doing 方法", async () => {
		const { clearAllDoing, readDoing } = await import("../lib/doing-store");
		clearAllDoing();

		const { syncDoingChanges } = await import("../lib/doing-sync");
		syncDoingChanges(
			makeRoadmap("test-sync-changes", [[]]),
			makeRoadmap("test-sync-changes", [[{ id: "T1", status: "todo" }, { id: "T2", status: "todo" }]]),
		);
		expect(readDoing()).toEqual([]);
	});

	it("新增 task status=doing → addDoing", async () => {
		const { clearAllDoing } = await import("../lib/doing-store");
		clearAllDoing();

		const { syncDoingChanges } = await import("../lib/doing-sync");
		syncDoingChanges(
			makeRoadmap("test-sync-changes", [[{ id: "T1", status: "todo" }]]),
			makeRoadmap("test-sync-changes", [[{ id: "T1", status: "todo" }, { id: "T2", status: "doing" }]]),
		);

		const { readDoing } = await import("../lib/doing-store");
		expect(readDoing()).toHaveLength(1);
		expect(readDoing()[0].taskId).toBe("T2");
	});

	it("多个 status 变迁同时发生", async () => {
		const { addDoing, clearAllDoing, readDoing } = await import("../lib/doing-store");
		clearAllDoing();
		addDoing({ roadmapId: "test-sync-changes", taskId: "T1", taskTitle: "T1", startedAt: "2026-01-01" });
		addDoing({ roadmapId: "test-sync-changes", taskId: "T3", taskTitle: "T3", startedAt: "2026-01-01" });

		const { syncDoingChanges } = await import("../lib/doing-sync");
		syncDoingChanges(
			makeRoadmap("test-sync-changes", [[
				{ id: "T1", status: "doing" },
				{ id: "T2", status: "todo" },
				{ id: "T3", status: "doing" },
				{ id: "T4", status: "todo" },
			]]),
			makeRoadmap("test-sync-changes", [[
				{ id: "T1", status: "done" },
				{ id: "T2", status: "doing" },
				{ id: "T3", status: "blocked" },
				{ id: "T4", status: "todo" },
				{ id: "T5", status: "doing" },
			]]),
		);

		const ids = readDoing().map(e => e.taskId).sort();
		expect(ids).toEqual(["T2", "T5"]);
	});
});
