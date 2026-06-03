/**
 * Roadmap 依赖关系 — 纯函数
 *
 * 支持两种 dependsOn 格式：
 *   - number[]（新格式，eid 引用）
 *   - string[]（旧格式，路径 ID，兼容迁移期）
 *
 * 所有函数不依赖 pi API，只操作数据结构，可独立测试。
 */

import { findItemByEid } from "./id-utils";
import type { ItemStatus, RoadmapFile } from "./types";

/** 状态图标映射 */
const STATUS_ICON: Record<ItemStatus, string> = {
	todo: "⬜",
	doing: "🔄",
	done: "✅",
	blocked: "🚫",
	dropped: "❌",
};

/** 已完成/已放弃的状态集合 */
const DONE_STATUSES: ReadonlySet<ItemStatus> = new Set(["done", "dropped"]);

/**
 * 按 eid 查找某个项的当前状态
 */
export function findItemStatusByEid(
	rm: RoadmapFile,
	eid: number,
): ItemStatus | null {
	const found = findItemByEid(rm, eid);
	if (!found) return null;
	if (found.task) return found.task.status;
	if (found.story) return found.story.status;
	return found.epic.status;
}

/**
 * 按位置路径 ID 查找某个项的当前状态（兼容旧接口）
 */
export function findItemStatus(
	rm: RoadmapFile,
	itemId: string,
): ItemStatus | null {
	for (const epic of rm.epics) {
		if (epic.id === itemId) return epic.status;
		for (const story of epic.stories) {
			if (story.id === itemId) return story.status;
			for (const task of story.tasks) {
				if (task.id === itemId) return task.status;
			}
		}
	}
	return null;
}

/**
 * 检查某个项的所有依赖是否已完成（done 或 dropped）
 *
 * @param dependsOn eid 列表（number[]）
 */
export function areDependenciesMet(
	rm: RoadmapFile,
	dependsOn: number[] | undefined,
): { met: boolean; unmet: number[] } {
	if (!dependsOn || dependsOn.length === 0) {
		return { met: true, unmet: [] };
	}

	const unmet: number[] = [];
	for (const depEid of dependsOn) {
		const status = findItemStatusByEid(rm, depEid);
		if (status === null) {
			unmet.push(depEid);
		} else if (!DONE_STATUSES.has(status)) {
			unmet.push(depEid);
		}
	}
	return { met: unmet.length === 0, unmet };
}

/**
 * 检测循环依赖（从 eid 出发，沿着 dependsOn 链是否会回到 eid）
 *
 * @returns 循环路径数组（如 [42, 17, 42]）或 null（无环）
 */
export function detectCycleByEid(
	rm: RoadmapFile,
	eid: number,
	dependsOn: number[] | undefined,
): number[] | null {
	if (!dependsOn || dependsOn.length === 0) return null;

	const visited = new Set<number>();
	const path: number[] = [];

	function dfs(currentEid: number): number[] | null {
		if (currentEid === eid) return [...path, currentEid];
		if (visited.has(currentEid)) return null;
		visited.add(currentEid);

		const deps = findDependsOnByEid(rm, currentEid);
		if (!deps || deps.length === 0) return null;

		for (const depEid of deps) {
			path.push(currentEid);
			const result = dfs(depEid);
			path.pop();
			if (result !== null) return result;
		}

		return null;
	}

	for (const depEid of dependsOn) {
		visited.clear();
		path.length = 0;
		const result = dfs(depEid);
		if (result !== null) return result;
	}

	return null;
}

/** 在 roadmap 中查找某个 eid 的 dependsOn 列表 */
function findDependsOnByEid(
	rm: RoadmapFile,
	eid: number,
): number[] | undefined {
	const found = findItemByEid(rm, eid);
	if (!found) return undefined;
	if (found.task) return found.task.dependsOn;
	if (found.story) return found.story.dependsOn;
	return found.epic.dependsOn;
}

/**
 * 格式化依赖信息用于展示（eid 格式）
 *
 * 格式如： "#42(E1.S2, ✅), #17(E3.S1.T2, ⬜)"
 */
export function formatDependencies(
	rm: RoadmapFile,
	dependsOn: number[] | undefined,
): string {
	if (!dependsOn || dependsOn.length === 0) return "";

	const parts: string[] = [];
	for (const depEid of dependsOn) {
		const found = findItemByEid(rm, depEid);
		if (!found) {
			parts.push(`#${depEid}(❓)`);
			continue;
		}
		// 获取 id（位置路径）
		let itemId: string;
		if (found.task) itemId = found.task.id;
		else if (found.story) itemId = found.story.id;
		else itemId = found.epic.id;

		const status =
			found.task?.status ?? found.story?.status ?? found.epic.status;
		const icon = STATUS_ICON[status] || "⬜";
		parts.push(`#${depEid}(${itemId}, ${icon})`);
	}
	return parts.join(", ");
}
