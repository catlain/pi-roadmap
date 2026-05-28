/**
 * Roadmap 依赖关系 — 纯函数
 *
 * 所有函数不依赖 pi API，只操作数据结构，可独立测试。
 */

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
 * 在 roadmap 内查找某个 ID 的当前状态
 *
 * 遍历 epics/stories/tasks，匹配 itemId。
 * 返回 ItemStatus 或 null（未找到）。
 */
export function findItemStatus(
	rm: RoadmapFile,
	itemId: string,
): ItemStatus | null {
	// 先查 epic 级别的 ID
	for (const epic of rm.epics) {
		if (epic.id === itemId) return epic.status;

		// 查 story 级别的 ID
		for (const story of epic.stories) {
			if (story.id === itemId) return story.status;

			// 查 task 级别的 ID
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
 * @returns met: 是否全部满足；unmet: 未满足的依赖 ID 列表
 */
export function areDependenciesMet(
	rm: RoadmapFile,
	dependsOn: string[] | undefined,
): { met: boolean; unmet: string[] } {
	if (!dependsOn || dependsOn.length === 0) {
		return { met: true, unmet: [] };
	}

	const unmet: string[] = [];
	for (const depId of dependsOn) {
		const status = findItemStatus(rm, depId);
		if (status === null) {
			// 依赖的 ID 不存在，视为未满足
			unmet.push(depId);
		} else if (!DONE_STATUSES.has(status)) {
			unmet.push(depId);
		}
	}
	return { met: unmet.length === 0, unmet };
}

/**
 * 检测循环依赖（从 itemId 出发，沿着 dependsOn 链是否会回到 itemId）
 *
 * 用 DFS 递归追踪每个 dependsOn 项的 dependsOn。
 *
 * @returns 循环路径数组（如 ["E1.S2.T3", "E3.S1.T2", "E1.S2.T3"]）或 null（无环）
 */
export function detectCycle(
	rm: RoadmapFile,
	itemId: string,
	dependsOn: string[] | undefined,
): string[] | null {
	if (!dependsOn || dependsOn.length === 0) return null;

	const visited = new Set<string>();
	const path: string[] = [];

	/**
	 * 从某个依赖 ID 出发递归 DFS，检查是否能回到起始 itemId
	 */
	function dfs(currentId: string): string[] | null {
		// 找到起始点 → 有环
		if (currentId === itemId) {
			return [...path, currentId];
		}

		// 已访问过 → 跳过（避免重复回溯）
		if (visited.has(currentId)) return null;
		visited.add(currentId);

		// 查找当前项及其 dependsOn
		const deps = findDependsOn(rm, currentId);
		if (!deps || deps.length === 0) return null;

		for (const depId of deps) {
			path.push(currentId);
			const result = dfs(depId);
			path.pop();
			if (result !== null) return result;
		}

		return null;
	}

	for (const depId of dependsOn) {
		visited.clear();
		path.length = 0;
		const result = dfs(depId);
		if (result !== null) return result;
	}

	return null;
}

/**
 * 在 roadmap 中查找某个 ID 的 dependsOn 列表
 */
function findDependsOn(
	rm: RoadmapFile,
	itemId: string,
): string[] | undefined {
	for (const epic of rm.epics) {
		if (epic.id === itemId) return epic.dependsOn;
		for (const story of epic.stories) {
			if (story.id === itemId) return story.dependsOn;
			for (const task of story.tasks) {
				if (task.id === itemId) return task.dependsOn;
			}
		}
	}
	return undefined;
}

/**
 * 格式化依赖信息用于展示
 *
 * 格式如： "E1.S2.T3(✅), E3.S1.T2(⬜)"
 */
export function formatDependencies(
	rm: RoadmapFile,
	dependsOn: string[] | undefined,
): string {
	if (!dependsOn || dependsOn.length === 0) return "";

	const parts: string[] = [];
	for (const depId of dependsOn) {
		const status = findItemStatus(rm, depId);
		if (status === null) {
			parts.push(`${depId}(❓)`);
		} else {
			const icon = STATUS_ICON[status] || "⬜";
			parts.push(`${depId}(${icon})`);
		}
	}
	return parts.join(", ");
}
