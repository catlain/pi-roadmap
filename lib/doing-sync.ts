/**
 * Doing 状态变迁检测 — 对比新旧 roadmap 同步 doing.json
 *
 * 纯逻辑模块，不依赖 typebox 或 ExtensionAPI，方便测试。
 */

import type { RoadmapFile } from "./types";
import { addDoing, clearDoing } from "./doing-store";

/** 对比新旧 roadmap，根据 task status 变迁同步 doing.json */
export function syncDoingChanges(oldRm: RoadmapFile, newRm: RoadmapFile): void {
	// 构建旧 task 状态索引：taskId → status
	const oldTasks = new Map<string, string>();
	for (const epic of oldRm.epics) {
		for (const story of epic.stories) {
			for (const task of story.tasks) {
				oldTasks.set(task.id, task.status);
			}
		}
	}

	// 遍历新 roadmap，检测状态变迁
	for (const epic of newRm.epics) {
		for (const story of epic.stories) {
			for (const task of story.tasks) {
				const oldStatus = oldTasks.get(task.id);
				const newStatus = task.status;

				if (oldStatus === undefined) {
					// 新增 task：如果已经是 doing，写入 doing
					if (newStatus === "doing") {
						addDoing({
							roadmapId: newRm.meta.id,
							taskId: task.id,
							taskTitle: task.title,
							startedAt: new Date().toISOString(),
						});
					}
				} else if (oldStatus !== "doing" && newStatus === "doing") {
					// 非 doing → doing：写入 doing
					addDoing({
						roadmapId: newRm.meta.id,
						taskId: task.id,
						taskTitle: task.title,
						startedAt: new Date().toISOString(),
					});
				} else if (oldStatus === "doing" && newStatus !== "doing") {
					// doing → 非 doing：清除 doing
					clearDoing(newRm.meta.id, task.id);
				}
			}
		}
	}
}
