/**
 * Roadmap 迁移 — 旧格式（无 eid）→ 新格式（有 eid + dependsOn number[]）
 *
 * 由 store.ts 的 readRoadmap 自动调用。
 */

import {
	allocateEid,
	buildEidPathIndex,
	ensureNextEid,
	rebuildPaths,
} from "./id-utils";
import type { RoadmapFile } from "./types";

/**
 * 将旧格式 roadmap 迁移到 eid 格式
 *
 * 旧格式：无 eid 字段，dependsOn 是 string[]（位置路径）
 * 新格式：有 eid 字段，dependsOn 是 number[]（eid 引用）
 *
 * 迁移步骤：
 * 1. 给所有项分配 eid（自上而下）
 * 2. 迁移 dependsOn（string → number）
 * 3. rebuildPaths（重置 id 为当前位置）
 */
export function migrateToEid(rm: RoadmapFile): void {
	// 已迁移（有 nextEid 字段且 > 0）→ 只需 rebuildPaths 确保一致
	if (rm.meta.nextEid !== undefined && rm.meta.nextEid > 0) {
		rebuildPaths(rm);
		return;
	}

	// Phase 1: 分配 eid
	ensureNextEid(rm.meta);
	for (const epic of rm.epics) {
		if (epic.eid === undefined) epic.eid = allocateEid(rm.meta);
		for (const story of epic.stories) {
			if (story.eid === undefined) story.eid = allocateEid(rm.meta);
			for (const task of story.tasks) {
				if (task.eid === undefined) task.eid = allocateEid(rm.meta);
			}
		}
	}

	// Phase 2: 迁移 dependsOn（string[] → number[]）
	// 先建立 path → eid 索引（此时 id 还是旧值）
	const pathIndex = buildEidPathIndex(rm);

	for (const epic of rm.epics) {
		migrateDependsOn(epic, pathIndex);
		for (const story of epic.stories) {
			migrateDependsOn(story, pathIndex);
			for (const task of story.tasks) {
				migrateDependsOn(task, pathIndex);
			}
		}
	}

	// Phase 3: rebuildPaths
	rebuildPaths(rm);
}

/** 迁移单个项的 dependsOn（string[] → number[]） */
function migrateDependsOn(
	item: { dependsOn?: number[] | string[] },
	pathIndex: Map<string, number>,
): void {
	if (!item.dependsOn || item.dependsOn.length === 0) return;
	// 已经是 number[] 则跳过
	if (typeof item.dependsOn[0] !== "string") return;

	item.dependsOn = (item.dependsOn as unknown as string[])
		.map((depId) => pathIndex.get(depId))
		.filter((eid): eid is number => eid !== undefined);
}
