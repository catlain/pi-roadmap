/**
 * Doing 状态持久化 — 记录当前会话正在执行的 roadmap 任务
 *
 * 流程：
 *   roadmap_next 返回任务 → 写 doing.json
 *   roadmap_done 标记完成 → 清 doing.json
 *   agent_end → 读 doing.json，有内容则提醒 AI 同步进度
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { homedir } from "node:os";

/** doing 标志文件路径 */
const DOING_FILE = path.join(homedir(), ".pi", "roadmap", "doing.json");

export interface DoingEntry {
	/** 路线图 ID */
	roadmapId: string;
	/** 任务 ID */
	taskId: string;
	/** 任务标题 */
	taskTitle: string;
	/** 开始时间 ISO */
	startedAt: string;
}

/** 读取 doing 列表 */
export function readDoing(): DoingEntry[] {
	try {
		if (!fs.existsSync(DOING_FILE)) return [];
		const raw = fs.readFileSync(DOING_FILE, "utf-8");
		return JSON.parse(raw) as DoingEntry[];
	} catch {
		return [];
	}
}

/** 写入 doing 列表 */
function writeDoing(entries: DoingEntry[]): void {
	const dir = path.dirname(DOING_FILE);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	fs.writeFileSync(DOING_FILE, JSON.stringify(entries, null, 2) + "\n", "utf-8");
}

/** 添加一个 doing 条目（去重：同一 taskId 不重复添加） */
export function addDoing(entry: DoingEntry): void {
	const entries = readDoing();
	// 去重
	if (entries.some((e) => e.taskId === entry.taskId && e.roadmapId === entry.roadmapId)) {
		return;
	}
	entries.push(entry);
	writeDoing(entries);
}

/** 清除指定任务的 doing 条目 */
export function clearDoing(roadmapId: string, taskId: string): void {
	const entries = readDoing().filter(
		(e) => !(e.roadmapId === roadmapId && e.taskId === taskId),
	);
	writeDoing(entries);
}

/** 清除所有 doing 条目 */
export function clearAllDoing(): void {
	writeDoing([]);
}

/** 是否有 doing 条目 */
export function hasDoing(): boolean {
	return readDoing().length > 0;
}
