/**
 * Roadmap 原子操作 — 状态更新逻辑（updateItem / updateTask）
 *
 * 从 tools-atomic-utils.ts 拆出，减少文件体积。
 */

import {
	areDependenciesMet,
	detectCycleByEid,
	findItemStatusByEid,
} from "./dependency";
import { findItemByEid } from "./id-utils";
import { today } from "./tools-atomic-utils";
import type {
	Epic,
	ItemStatus,
	Priority,
	RoadmapFile,
	Story,
	Task,
} from "./types";

/** 合法状态转换表（from → Set<to>） */
const VALID_TRANSITIONS: Record<ItemStatus, ReadonlySet<ItemStatus>> = {
	todo: new Set(["doing", "dropped"]),
	doing: new Set(["todo", "done", "blocked", "dropped"]),
	done: new Set(["todo", "doing"]),
	blocked: new Set(["doing", "dropped"]),
	dropped: new Set(["todo"]),
};

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

/** 处理状态转换的公共逻辑，返回警告信息或 null */
function handleStatusTransition(
	rm: RoadmapFile,
	item: {
		status: ItemStatus;
		doingDate?: string;
		doneDate?: string;
		eid: number;
		dependsOn?: number[];
	},
	newStatus: ItemStatus,
	_sessionId: string | undefined,
	extraDoingFields?: (item: any) => void,
	extraDoneFields?: (item: any) => void,
): { changed: string; warning: string | null } | null {
	const oldStatus = item.status;
	if (oldStatus === newStatus) {
		return { changed: `status: ${oldStatus} → ${item.status}`, warning: null };
	}
	if (!VALID_TRANSITIONS[oldStatus]?.has(newStatus)) {
		return null; // 调用方处理非法转换
	}

	item.status = newStatus;

	if (newStatus === "doing") {
		item.doingDate = today();
		if (extraDoingFields) extraDoingFields(item);
		// 检查依赖是否满足
		const deps = areDependenciesMet(rm, item.dependsOn);
		if (!deps.met) {
			const depNames = deps.unmet.map((depEid) => {
				const s = findItemStatusByEid(rm, depEid);
				const found = findItemByEid(rm, depEid);
				const label = found
					? (found.task?.id ?? found.story?.id ?? found.epic.id)
					: `#${depEid}`;
				return `${label}(${s ? `${statusIcon(s)} ${s}` : "❓"})`;
			});
			return {
				changed: `status: ${oldStatus} → ${item.status}`,
				warning: `⚠️ 依赖未完成：${depNames.join(", ")}。建议先完成上游任务。`,
			};
		}
	} else {
		delete item.doingDate;
		if (extraDoingFields) extraDoingFields(item); // 清除 doing 相关字段
	}

	if (newStatus === "done") {
		item.doneDate = today();
		if (extraDoneFields) extraDoneFields(item);
	} else if (oldStatus === "done") {
		delete item.doneDate;
		if (extraDoneFields) extraDoneFields(item); // 清除 done 相关字段
	}

	return { changed: `status: ${oldStatus} → ${item.status}`, warning: null };
}

/** 更新通用字段（Epic/Story） */
export function updateItem(
	rm: RoadmapFile,
	item: Epic | Story,
	updates: Record<string, string | number[]>,
	sessionId: string,
): string {
	const changed: string[] = [];

	if (updates.title !== undefined) {
		item.title = updates.title as string;
		changed.push("title");
	}
	if (updates.description !== undefined) {
		item.description = updates.description as string;
		changed.push("description");
	}
	if (updates.priority !== undefined) {
		item.priority = updates.priority as Priority;
		changed.push("priority");
	}
	if (updates.dependsOn !== undefined) {
		const newDependsOn = updates.dependsOn as number[];
		for (const depEid of newDependsOn) {
			if (findItemStatusByEid(rm, depEid) === null) {
				return `❌ 依赖项 #${depEid} 不存在。`;
			}
		}
		const cycle = detectCycleByEid(rm, item.eid, newDependsOn);
		if (cycle) {
			return `❌ 检测到循环依赖：${cycle.map((e) => `#${e}`).join(" → ")}`;
		}
		item.dependsOn = newDependsOn;
		changed.push(`dependsOn: [${newDependsOn.map((e) => `#${e}`).join(", ")}]`);
	}
	if (updates.planPath !== undefined) {
		item.planPath = updates.planPath as string;
		changed.push(`planPath: ${item.planPath}`);
	}
	if (updates.status !== undefined) {
		const result = handleStatusTransition(
			rm,
			item,
			updates.status as ItemStatus,
			sessionId,
		);
		if (result === null) {
			return `⚠️ ${item.id} 状态转换不合法：${item.status} → ${updates.status}（允许：${[...VALID_TRANSITIONS[item.status as ItemStatus]].join(",")}）`;
		}
		changed.push(result.changed);
		if (result.warning) return result.warning;
	}

	return `✅ ${item.id} 已更新：${changed.join(", ")}。`;
}

/** 更新 Task（支持 note 和 doingSessionId） */
export function updateTask(
	rm: RoadmapFile,
	task: Task,
	updates: Record<string, string | number[]>,
	sessionId: string,
): string {
	const changed: string[] = [];

	if (updates.title !== undefined) {
		task.title = updates.title as string;
		changed.push("title");
	}
	if (updates.priority !== undefined) {
		task.priority = updates.priority as Priority;
		changed.push("priority");
	}
	if (updates.note !== undefined) {
		task.note = updates.note as string;
		changed.push("note");
	}
	if (updates.dependsOn !== undefined) {
		const newDependsOn = updates.dependsOn as number[];
		for (const depEid of newDependsOn) {
			if (findItemStatusByEid(rm, depEid) === null) {
				return `❌ 依赖项 #${depEid} 不存在。`;
			}
		}
		const cycle = detectCycleByEid(rm, task.eid, newDependsOn);
		if (cycle) {
			return `❌ 检测到循环依赖：${cycle.map((e) => `#${e}`).join(" → ")}`;
		}
		task.dependsOn = newDependsOn;
		changed.push(`dependsOn: [${newDependsOn.map((e) => `#${e}`).join(", ")}]`);
	}
	if (updates.planPath !== undefined) {
		task.planPath = updates.planPath as string;
		changed.push(`planPath: ${task.planPath}`);
	}
	if (updates.status !== undefined) {
		const result = handleStatusTransition(
			rm,
			task,
			updates.status as ItemStatus,
			sessionId,
			// doing 时设置 doingSessionId，非 doing 时清除
			(t: any) => {
				if (t.status === "doing") t.doingSessionId = sessionId;
				else delete t.doingSessionId;
			},
			// done 时设置 doneBySessionId，非 done 时清除
			(t: any) => {
				if (t.status === "done") t.doneBySessionId = sessionId;
				else delete t.doneBySessionId;
			},
		);
		if (result === null) {
			return `⚠️ ${task.id} 状态转换不合法：${task.status} → ${updates.status}（允许：${[...VALID_TRANSITIONS[task.status as ItemStatus]].join(",")}）`;
		}
		changed.push(result.changed);
		if (result.warning) return result.warning;
	}

	return `✅ ${task.id} 已更新：${changed.join(", ")}。`;
}
