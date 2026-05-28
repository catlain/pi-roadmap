/**
 * Roadmap 原子操作 — 公共辅助函数
 */

import { areDependenciesMet, findItemStatus } from "./dependency";
import { getRoadmapFilePath, readRoadmap, writeRoadmap } from "./store";
import type {
	Epic,
	ItemStatus,
	Priority,
	RoadmapFile,
	Story,
	Task,
} from "./types";

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

/** 更新通用字段（Epic/Story） */
/** 合法状态转换表（from → Set<to>） */
const VALID_TRANSITIONS: Record<ItemStatus, ReadonlySet<ItemStatus>> = {
	todo: new Set(["doing", "dropped"]),
	doing: new Set(["todo", "done", "blocked", "dropped"]),
	done: new Set(["todo"]), // 仅允许重开
	blocked: new Set(["doing", "dropped"]),
	dropped: new Set(["todo"]), // 仅允许重开
};

export function updateItem(
	rm: RoadmapFile,
	item: Epic | Story,
	updates: Record<string, string>,
	sessionId: string,
): string {
	const changed: string[] = [];
	if (updates.title !== undefined) {
		item.title = updates.title;
		changed.push("title");
	}
	if (updates.description !== undefined) {
		item.description = updates.description;
		changed.push("description");
	}
	if (updates.priority !== undefined) {
		item.priority = updates.priority as Priority;
		changed.push("priority");
	}
	if (updates.status !== undefined) {
		const newStatus = updates.status as ItemStatus;
		const oldStatus = item.status;
		if (oldStatus === newStatus) {
			// 状态未变，不做任何处理
		} else if (VALID_TRANSITIONS[oldStatus]?.has(newStatus)) {
			item.status = newStatus;
			if (newStatus === "doing") {
				item.doingDate = today();
				// 检查依赖是否满足
				const deps = areDependenciesMet(rm, item.dependsOn);
				if (!deps.met) {
					const depNames: string[] = [];
					for (const depId of deps.unmet) {
						const s = findItemStatus(rm, depId);
						depNames.push(`${depId}(${s ? statusIcon(s) + " " + s : "❓"})`);
					}
					return `⚠️ ${item.id} 依赖未完成：${depNames.join(", ")}。建议先完成上游任务。`;
				}
			} else {
				// 离开 doing 时清除 doingDate
				delete item.doingDate;
			}
			if (newStatus === "done") {
				item.doneDate = today();
			} else if (oldStatus === "done") {
				// 从 done 重开时清除 doneDate
				delete item.doneDate;
			}
		} else {
			return `⚠️ ${item.id} 状态转换不合法：${oldStatus} → ${newStatus}（允许：${[...VALID_TRANSITIONS[oldStatus]].join(",")}）`;
		}
		changed.push(`status: ${oldStatus} → ${item.status}`);
	}
	return `✅ ${item.id} 已更新：${changed.join(", ")}。`;
}

/** 更新 Task（支持 note 和 doingSessionId） */
export function updateTask(
	rm: RoadmapFile,
	task: Task,
	updates: Record<string, string>,
	sessionId: string,
): string {
	const changed: string[] = [];
	if (updates.title !== undefined) {
		task.title = updates.title;
		changed.push("title");
	}
	if (updates.priority !== undefined) {
		task.priority = updates.priority as Priority;
		changed.push("priority");
	}
	if (updates.note !== undefined) {
		task.note = updates.note;
		changed.push("note");
	}
	if (updates.status !== undefined) {
		const newStatus = updates.status as ItemStatus;
		const oldStatus = task.status;
		if (oldStatus === newStatus) {
			// 状态未变
		} else if (VALID_TRANSITIONS[oldStatus]?.has(newStatus)) {
			task.status = newStatus;
			if (newStatus === "doing") {
				task.doingDate = today();
				task.doingSessionId = sessionId;
				// 检查依赖是否满足
				const deps = areDependenciesMet(rm, task.dependsOn);
				if (!deps.met) {
					const depNames: string[] = [];
					for (const depId of deps.unmet) {
						const s = findItemStatus(rm, depId);
						depNames.push(`${depId}(${s ? statusIcon(s) + " " + s : "❓"})`);
					}
					return `⚠️ ${task.id} 依赖未完成：${depNames.join(", ")}。建议先完成上游任务。`;
				}
			} else {
				delete task.doingDate;
				delete task.doingSessionId;
			}
			if (newStatus === "done") {
				task.doneDate = today();
				task.doneBySessionId = sessionId;
			} else if (oldStatus === "done") {
				delete task.doneDate;
				delete task.doneBySessionId;
			}
		} else {
			return `⚠️ ${task.id} 状态转换不合法：${oldStatus} → ${newStatus}（允许：${[...VALID_TRANSITIONS[oldStatus]].join(",")}）`;
		}
		changed.push(`status: ${oldStatus} → ${task.status}`);
	}
	return `✅ ${task.id} 已更新：${changed.join(", ")}。`;
}

/** 状态对应的图标 */
function statusIcon(s: ItemStatus): string {
	const icons: Record<ItemStatus, string> = {
		todo: "⬜",
		doing: "🔄",
		done: "✅",
		blocked: "🚫",
		dropped: "❌",
	};
	return icons[s];
}
