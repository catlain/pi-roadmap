/**
 * Roadmap 原子操作 — 公共辅助函数
 */

import { getRoadmapFilePath, readRoadmap, writeRoadmap } from "./store";
import type { RoadmapFile } from "./types";

// Re-export update functions (moved to tools-atomic-logic-update.ts)
export { updateItem, updateTask } from "./tools-atomic-logic-update";

/** 获取当前日期 YYYY-MM-DD */
export function today(): string {
	return new Date().toISOString().slice(0, 10);
}

/** 从 _ctx 获取当前会话 ID */
export function getSessionId(_ctx: unknown): string {
	return (
		(_ctx as any)?.sessionManager
			?.getSessionFile?.()
			?.split("/")
			.pop()
			?.replace(/\.jsonl$/, "") ?? "unknown"
	);
}

/** 读取 → 修改 → 写入 roadmap 的原子操作封装 */
export function atomicUpdate(
	roadmapId: string,
	fn: (rm: RoadmapFile) => string,
): string {
	const filePath = getRoadmapFilePath(roadmapId);
	if (!filePath) return `错误：路线图 "${roadmapId}" 不存在。`;
	const rm = readRoadmap(filePath);
	if (!rm) return `错误：路线图 "${roadmapId}" 读取失败。`;
	const result = fn(rm);
	rm.meta.updated = new Date().toISOString();
	writeRoadmap(filePath, rm);
	return result;
}

/** 遍历整个 roadmap，查找已使用指定 planPath 的条目 */
export function findPlanPathUsers(
	rm: RoadmapFile,
	planPath: string,
): { id: string; title: string }[] {
	const users: { id: string; title: string }[] = [];
	for (const epic of rm.epics) {
		if (epic.planPath === planPath)
			users.push({ id: epic.id, title: epic.title });
		for (const story of epic.stories) {
			if (story.planPath === planPath)
				users.push({ id: story.id, title: story.title });
			for (const task of story.tasks) {
				if (task.planPath === planPath)
					users.push({ id: task.id, title: task.title });
			}
		}
	}
	return users;
}
