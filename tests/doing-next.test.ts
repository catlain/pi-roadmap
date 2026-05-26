/**
 * roadmap_next 无副作用测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { ROADMAP_DIR, makeRoadmap, setupCleanDoing, cleanupDoing } from "./doing-helpers";

const createdRoadmaps: string[] = [];
beforeEach(() => setupCleanDoing());
afterEach(() => cleanupDoing(createdRoadmaps));

describe("roadmap_next 无副作用", () => {
	it("roadmap_next 不写 doing.json", async () => {
		setupCleanDoing(); // 跨文件隔离：确保 doing.json 为空
		const { readDoing } = await import("../lib/doing-store");
		const { getNextTasks } = await import("../lib/progress");

		const rm = makeRoadmap("test-next-no-side-effect", [
			[{ id: "E0.S0.T0", status: "todo" }, { id: "E0.S0.T1", status: "todo" }],
		]);
		const filePath = path.join(ROADMAP_DIR, "test-next-no-side-effect.roadmap.json");
		fs.writeFileSync(filePath, JSON.stringify(rm, null, 2), "utf-8");
		createdRoadmaps.push("test-next-no-side-effect");

		const tasks = getNextTasks(rm, 5);
		expect(tasks.length).toBe(2);
		expect(readDoing()).toEqual([]);
	});
});
