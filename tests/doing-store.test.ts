/**
 * doing-store 测试 — 持久化 doing 标志的读写、去重、清除
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { homedir } from "node:os";

// doing-store 内部硬编码路径为 ~/.pi/roadmap/doing.json
// 测试时直接操作真实文件（仅测试文件，测试完清理）
const DOING_FILE = path.join(homedir(), ".pi", "roadmap", "doing.json");

// 备份原始内容
let originalContent: string | null = null;

beforeEach(() => {
	if (fs.existsSync(DOING_FILE)) {
		originalContent = fs.readFileSync(DOING_FILE, "utf-8");
		fs.unlinkSync(DOING_FILE);
	} else {
		originalContent = null;
	}
});

afterEach(() => {
	// 恢复原始内容
	if (originalContent !== null) {
		fs.writeFileSync(DOING_FILE, originalContent, "utf-8");
	} else if (fs.existsSync(DOING_FILE)) {
		fs.unlinkSync(DOING_FILE);
	}
});

describe("doing-store", () => {
	it("初始状态为空", async () => {
		const { readDoing } = await import("../lib/doing-store");
		expect(readDoing()).toEqual([]);
	});

	it("添加 doing 条目", async () => {
		const { addDoing, readDoing } = await import("../lib/doing-store");
		addDoing({
			roadmapId: "test-rm",
			taskId: "E1.S1.T1",
			taskTitle: "测试任务",
			startedAt: "2026-05-25T10:00:00Z",
		});
		const entries = readDoing();
		expect(entries).toHaveLength(1);
		expect(entries[0].taskId).toBe("E1.S1.T1");
		expect(entries[0].roadmapId).toBe("test-rm");
	});

	it("去重：同一 taskId 不重复添加", async () => {
		const { addDoing, readDoing } = await import("../lib/doing-store");
		addDoing({
			roadmapId: "test-rm",
			taskId: "E1.S1.T1",
			taskTitle: "测试任务",
			startedAt: "2026-05-25T10:00:00Z",
		});
		addDoing({
			roadmapId: "test-rm",
			taskId: "E1.S1.T1",
			taskTitle: "测试任务",
			startedAt: "2026-05-25T10:01:00Z",
		});
		expect(readDoing()).toHaveLength(1);
	});

	it("清除指定任务", async () => {
		const { addDoing, clearDoing, readDoing } = await import("../lib/doing-store");
		addDoing({
			roadmapId: "test-rm",
			taskId: "E1.S1.T1",
			taskTitle: "任务1",
			startedAt: "2026-05-25T10:00:00Z",
		});
		addDoing({
			roadmapId: "test-rm",
			taskId: "E1.S1.T2",
			taskTitle: "任务2",
			startedAt: "2026-05-25T10:01:00Z",
		});
		clearDoing("test-rm", "E1.S1.T1");
		const entries = readDoing();
		expect(entries).toHaveLength(1);
		expect(entries[0].taskId).toBe("E1.S1.T2");
	});

	it("清除所有 doing", async () => {
		const { addDoing, clearAllDoing, readDoing } = await import("../lib/doing-store");
		addDoing({
			roadmapId: "test-rm",
			taskId: "E1.S1.T1",
			taskTitle: "任务1",
			startedAt: "2026-05-25T10:00:00Z",
		});
		clearAllDoing();
		expect(readDoing()).toEqual([]);
	});

	it("hasDoing 正确返回", async () => {
		const { addDoing, hasDoing, clearAllDoing } = await import("../lib/doing-store");
		expect(hasDoing()).toBe(false);
		addDoing({
			roadmapId: "test-rm",
			taskId: "E1.S1.T1",
			taskTitle: "测试任务",
			startedAt: "2026-05-25T10:00:00Z",
		});
		expect(hasDoing()).toBe(true);
		clearAllDoing();
		expect(hasDoing()).toBe(false);
	});
});
