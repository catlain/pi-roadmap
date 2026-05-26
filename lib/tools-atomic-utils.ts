/**
 * Roadmap 原子操作 — 公共辅助函数
 */

import type { RoadmapFile, Epic, Story, Task, ItemStatus, Priority } from "./types";
import { readRoadmap, writeRoadmap, getRoadmapFilePath } from "./store";

/** 获取当前日期 YYYY-MM-DD */
export function today(): string {
	return new Date().toISOString().slice(0, 10);
}

/** 从 _ctx 获取当前会话 ID */
export function getSessionId(_ctx: unknown): string {
	return (_ctx as any)?.sessionManager?.getSessionFile?.()?.split("/").pop()?.replace(/\.jsonl$/, "") ?? "unknown";
}

/** 读取 → 修改 → 写入 roadmap 的原子操作封装 */
export function atomicUpdate(roadmapId: string, fn: (rm: RoadmapFile) => string): string {
	const filePath = getRoadmapFilePath(roadmapId);
	if (!filePath) return `错误：路线图 "${roadmapId}" 不存在。`;
	const rm = readRoadmap(filePath);
	if (!rm) return `错误：路线图 "${roadmapId}" 读取失败。`;
	const result = fn(rm);
	rm.meta.updated = new Date().toISOString();
	writeRoadmap(filePath, rm);
	return result;
}

/** 更新通用字段（Epic/Story） */
export function updateItem(item: Epic | Story, updates: Record<string, string>, sessionId: string): string {
	const changed: string[] = [];
	if (updates.title !== undefined) { item.title = updates.title; changed.push("title"); }
	if (updates.description !== undefined) { item.description = updates.description; changed.push("description"); }
	if (updates.priority !== undefined) { item.priority = updates.priority as Priority; changed.push("priority"); }
	if (updates.status !== undefined) {
		const oldStatus = item.status;
		item.status = updates.status as ItemStatus;
		if (updates.status === "doing" && oldStatus !== "doing") {
			(item as any).doingDate = today();
		}
		if (updates.status === "done") {
			item.doneDate = today();
		}
		changed.push(`status: ${oldStatus} → ${updates.status}`);
	}
	return `✅ ${item.id} 已更新：${changed.join(", ")}。`;
}

/** 更新 Task（支持 note 和 doingSessionId） */
export function updateTask(task: Task, updates: Record<string, string>, sessionId: string): string {
	const changed: string[] = [];
	if (updates.title !== undefined) { task.title = updates.title; changed.push("title"); }
	if (updates.priority !== undefined) { task.priority = updates.priority as Priority; changed.push("priority"); }
	if (updates.note !== undefined) { task.note = updates.note; changed.push("note"); }
	if (updates.status !== undefined) {
		const oldStatus = task.status;
		task.status = updates.status as ItemStatus;
		if (updates.status === "doing" && oldStatus !== "doing") {
			task.doingDate = today();
			task.doingSessionId = sessionId;
		}
		if (updates.status === "done") {
			task.doneDate = today();
			task.doneBySessionId = sessionId;
			delete task.doingSessionId;
		}
		changed.push(`status: ${oldStatus} → ${updates.status}`);
	}
	return `✅ ${task.id} 已更新：${changed.join(", ")}。`;
}
