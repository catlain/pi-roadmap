/**
 * Roadmap 永久 ID 工具 — eid 分配、路径重建、按 eid 查找、输入解析
 *
 * 核心概念：
 *   - eid: 永久数字 ID，创建后不变，用于 dependsOn 引用
 *   - id: 位置路径（如 "E1.S2.T3"），由 rebuildPaths 根据数组位置维护
 *
 * 纯函数模块，不依赖 pi API。
 */

import type { Epic, RoadmapFile, RoadmapMeta, Story, Task } from "./types";

// ── eid 分配 ──

/** 分配下一个 eid（自增 meta.nextEid） */
export function allocateEid(meta: RoadmapMeta): number {
	if (!meta.nextEid || meta.nextEid < 1) {
		meta.nextEid = 1;
	}
	const eid = meta.nextEid;
	meta.nextEid = eid + 1;
	return eid;
}

/** 初始化 meta.nextEid（仅在无该字段时设置） */
export function ensureNextEid(meta: RoadmapMeta): void {
	if (meta.nextEid === undefined || meta.nextEid === null) {
		meta.nextEid = 1;
	}
}

// ── 路径重建 ──

/** 基于数组位置重建所有项的 id 字段 */
export function rebuildPaths(rm: RoadmapFile): void {
	for (let i = 0; i < rm.epics.length; i++) {
		const epic = rm.epics[i];
		epic.id = `E${i + 1}`;
		for (let j = 0; j < epic.stories.length; j++) {
			const story = epic.stories[j];
			story.id = `${epic.id}.S${j + 1}`;
			for (let k = 0; k < story.tasks.length; k++) {
				const task = story.tasks[k];
				task.id = `${story.id}.T${k + 1}`;
			}
		}
	}
}

// ── 按 eid 查找 ──

/** 查找结果 */
export interface FoundItem {
	epic: Epic;
	story?: Story;
	task?: Task;
}

/** 按 eid 查找项（遍历整棵树） */
export function findItemByEid(rm: RoadmapFile, eid: number): FoundItem | null {
	for (const epic of rm.epics) {
		if (epic.eid === eid) return { epic };
		for (const story of epic.stories) {
			if (story.eid === eid) return { epic, story };
			for (const task of story.tasks) {
				if (task.eid === eid) return { epic, story, task };
			}
		}
	}
	return null;
}

/** 按 eid 查找 Epic */
export function findEpicByEid(rm: RoadmapFile, eid: number): Epic | null {
	for (const epic of rm.epics) {
		if (epic.eid === eid) return epic;
	}
	return null;
}

/** 按 eid 查找 Story（返回 Epic + Story） */
export function findStoryByEid(
	rm: RoadmapFile,
	eid: number,
): { epic: Epic; story: Story } | null {
	for (const epic of rm.epics) {
		for (const story of epic.stories) {
			if (story.eid === eid) return { epic, story };
		}
	}
	return null;
}

/** 按 eid 查找 Task（返回 Epic + Story + Task） */
export function findTaskByEid(
	rm: RoadmapFile,
	eid: number,
): { epic: Epic; story: Story; task: Task } | null {
	for (const epic of rm.epics) {
		for (const story of epic.stories) {
			for (const task of story.tasks) {
				if (task.eid === eid) return { epic, story, task };
			}
		}
	}
	return null;
}

// ── 用户输入解析 ──

/** 解析后的 item 定位 */
export interface ResolvedItem {
	epic: Epic;
	story?: Story;
	task?: Task;
}

/**
 * 解析用户输入的 item_id，兼容两种格式：
 *   - 位置路径："E1", "E1.S2", "E1.S2.T3"
 *   - 永久 ID："#42" 或纯数字 42
 */
export function resolveItemId(
	rm: RoadmapFile,
	input: string,
): ResolvedItem | null {
	// 尝试按 eid 解析（#42 格式）
	const eidMatch = input.match(/^#?(\d+)$/);
	if (eidMatch) {
		const eid = parseInt(eidMatch[1], 10);
		const found = findItemByEid(rm, eid);
		if (found) {
			return {
				epic: found.epic,
				story: found.story,
				task: found.task,
			};
		}
	}

	// 按位置路径解析（E1.S2.T3 格式）
	const parts = input.split(".");
	const epicId = parts[0];
	const epic = rm.epics.find((e) => e.id === epicId);
	if (!epic) return null;

	if (parts.length === 1) return { epic };

	const storyId = `${parts[0]}.${parts[1]}`;
	const story = epic.stories.find((s) => s.id === storyId);
	if (!story) return null;

	if (parts.length === 2) return { epic, story };

	const task = story.tasks.find((t) => t.id === input);
	if (!task) return null;

	return { epic, story, task };
}

// ── 用户输入 → eid 转换 ──

/**
 * 将用户输入的 dependsOn 元素转为 eid
 * 兼容 "#42" / "42" / "E1.S2.T3" 格式
 */
export function resolveToEid(rm: RoadmapFile, input: string): number | null {
	// 纯数字或 #eid 格式
	const eidMatch = input.match(/^#?(\d+)$/);
	if (eidMatch) return parseInt(eidMatch[1], 10);

	// 路径格式 → 查找对应的 eid
	const resolved = resolveItemId(rm, input);
	if (!resolved) return null;
	if (resolved.task) return resolved.task.eid ?? null;
	if (resolved.story) return resolved.story.eid ?? null;
	return resolved.epic.eid ?? null;
}

// ── 路径查找 ──

/** 按位置路径查找项（与 resolveItemId 类似但返回 FoundItem） */
export function findItemByPath(
	rm: RoadmapFile,
	path: string,
): FoundItem | null {
	const parts = path.split(".");
	const epic = rm.epics.find((e) => e.id === parts[0]);
	if (!epic) return null;
	if (parts.length === 1) return { epic };

	const story = epic.stories.find(
		(s) => s.id === `${parts[0]}.${parts[1]}`,
	);
	if (!story) return null;
	if (parts.length === 2) return { epic, story };

	const task = story.tasks.find((t) => t.id === path);
	if (!task) return null;
	return { epic, story, task };
}

// ── 迁移辅助 ──

/**
 * 在旧格式 roadmap 中，按位置路径查找项的临时索引（仅迁移用）
 * 返回 eid 映射：path → eid
 */
export function buildEidPathIndex(rm: RoadmapFile): Map<string, number> {
	const index = new Map<string, number>();
	for (const epic of rm.epics) {
		if (epic.eid !== undefined) index.set(epic.id, epic.eid);
		for (const story of epic.stories) {
			if (story.eid !== undefined) index.set(story.id, story.eid);
			for (const task of story.tasks) {
				if (task.eid !== undefined) index.set(task.id, task.eid);
			}
		}
	}
	return index;
}
