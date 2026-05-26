/**
 * Doing 状态持久化 — 记录当前会话正在执行的 roadmap 任务
 *
 * 流程：
 *   roadmap_plan 把 task 状态改为 doing → 写 doing.json
 *   roadmap_done 标记完成 → 清 doing.json
 *   agent_end → 读 doing.json，有内容则提醒 AI 同步进度
 */

import * as fs from "node:fs";
import { homedir } from "node:os";
import * as path from "node:path";

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
	/** 创建该条目的会话 ID（session 文件名，不含路径和扩展名） */
	sessionId?: string;
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
	fs.writeFileSync(
		DOING_FILE,
		JSON.stringify(entries, null, 2) + "\n",
		"utf-8",
	);
}

/** 添加一个 doing 条目（去重：同一 taskId 不重复添加） */
export function addDoing(entry: DoingEntry): void {
	const entries = readDoing();
	// 去重
	if (
		entries.some(
			(e) => e.taskId === entry.taskId && e.roadmapId === entry.roadmapId,
		)
	) {
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

/** 读取指定会话的 doing 条目 */
export function readDoingBySession(sessionId: string): DoingEntry[] {
	return readDoing().filter((e) => e.sessionId === sessionId);
}

/** 是否有 doing 条目 */
export function hasDoing(): boolean {
	return readDoing().length > 0;
}

/** 收集 roadmap 中所有 task 的有效状态 */
function collectTaskStatuses(
	rms: Array<{
		meta: { id: string };
		epics: Array<{
			stories: Array<{ tasks: Array<{ id: string; status: string }> }>;
		}>;
	}>,
): Map<string, Map<string, string>> {
	const map = new Map<string, Map<string, string>>();
	for (const rm of rms) {
		const taskMap = new Map<string, string>();
		for (const epic of rm.epics) {
			for (const story of epic.stories) {
				for (const task of story.tasks) {
					taskMap.set(task.id, task.status);
				}
			}
		}
		map.set(rm.meta.id, taskMap);
	}
	return map;
}

/** 同步 doing.json：根据 roadmap 实际状态清理无效条目（done/dropped/orphan） */
export function syncDoing(
	rms: Array<{
		meta: { id: string };
		epics: Array<{
			stories: Array<{ tasks: Array<{ id: string; status: string }> }>;
		}>;
	}>,
): void {
	const entries = readDoing();
	if (entries.length === 0) return;

	const taskStatuses = collectTaskStatuses(rms);

	const valid = entries.filter((e) => {
		const rmTasks = taskStatuses.get(e.roadmapId);
		if (!rmTasks) return false;
		const status = rmTasks.get(e.taskId);
		if (status === undefined) return false;
		return status === "doing" || status === "todo";
	});

	writeDoing(valid);
}
