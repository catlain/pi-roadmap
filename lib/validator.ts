/**
 * Roadmap 数据验证与修复
 */

import { validatePlanPath } from "./plan-resolver";
import { detectCycle } from "./dependency";
import type { RoadmapFile } from "./types";

const VALID_ROADMAP_STATUS = new Set([
	"active",
	"paused",
	"completed",
	"archived",
]);
const VALID_ITEM_STATUS = new Set([
	"todo",
	"doing",
	"done",
	"blocked",
	"dropped",
]);
const VALID_PRIORITY = new Set(["low", "medium", "high"]);

export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

/** 验证 roadmap 数据结构 */
export function validateRoadmap(data: unknown): ValidationResult {
	const errors: string[] = [];

	if (!data || typeof data !== "object") {
		return { valid: false, errors: ["数据不是对象"] };
	}

	const d = data as Record<string, unknown>;

	// meta 检查
	if (!d.meta || typeof d.meta !== "object") {
		errors.push("缺少 meta 字段");
	} else {
		const meta = d.meta as Record<string, unknown>;
		if (!meta.id || typeof meta.id !== "string")
			errors.push("meta.id 缺失或非字符串");
		if (!meta.title || typeof meta.title !== "string")
			errors.push("meta.title 缺失或非字符串");
		if (!meta.status || !VALID_ROADMAP_STATUS.has(meta.status as string))
			errors.push(`meta.status "${meta.status}" 不合法`);
		if (!meta.created || typeof meta.created !== "string")
			errors.push("meta.created 缺失");
		if (!meta.updated || typeof meta.updated !== "string")
			errors.push("meta.updated 缺失");
	}

	// epics 检查
	if (!Array.isArray(d.epics)) {
		errors.push("缺少 epics 数组");
	} else {
		// 先收集所有合法 ID
		const allIds = new Set<string>();
		for (const epic of d.epics as Record<string, unknown>[]) {
			if (epic.id) allIds.add(epic.id as string);
			if (Array.isArray(epic.stories)) {
				for (const story of epic.stories as Record<string, unknown>[]) {
					if (story.id) allIds.add(story.id as string);
					if (Array.isArray(story.tasks)) {
						for (const task of story.tasks as Record<string, unknown>[]) {
							if (task.id) allIds.add(task.id as string);
						}
					}
				}
			}
		}

		const epicIds = new Set<string>();
		for (let i = 0; i < d.epics.length; i++) {
			const epic = d.epics[i] as Record<string, unknown>;
			if (!epic.id) errors.push(`epics[${i}].id 缺失`);
			else if (epicIds.has(epic.id as string))
				errors.push(`epic id "${epic.id}" 重复`);
			else epicIds.add(epic.id as string);

			// 检查 epic 的 dependsOn
			if (Array.isArray(epic.dependsOn) && epic.id) {
				for (const depId of epic.dependsOn as string[]) {
					if (!allIds.has(depId)) {
						errors.push(`Epic ${epic.id} dependsOn 引用了不存在的 ID "${depId}"`);
					}
				}
				const cycle = detectCycle(d as unknown as RoadmapFile, epic.id as string, epic.dependsOn as string[]);
				if (cycle) {
					errors.push(`Epic ${epic.id} 存在循环依赖：${cycle.join(" → ")}`);
				}
			}

			if (!epic.title) errors.push(`epics[${i}].title 缺失`);
			if (epic.project !== undefined && typeof epic.project !== "string")
				errors.push(`epics[${i}].project 类型错误`);
			if (!VALID_ITEM_STATUS.has(epic.status as string))
				errors.push(`epics[${i}].status "${epic.status}" 不合法`);
			if (!VALID_PRIORITY.has(epic.priority as string))
				errors.push(`epics[${i}].priority "${epic.priority}" 不合法`);
			if (epic.planPath !== undefined && !validatePlanPath(epic.planPath as string))
				errors.push(`epics[${i}].planPath "${epic.planPath}" 格式不合法`);

			if (!Array.isArray(epic.stories)) {
				errors.push(`epics[${i}].stories 不是数组`);
			} else {
				const storyIds = new Set<string>();
				for (let j = 0; j < epic.stories.length; j++) {
					const story = epic.stories[j] as Record<string, unknown>;
					if (!story.id) errors.push(`epics[${i}].stories[${j}].id 缺失`);
					else if (storyIds.has(story.id as string))
						errors.push(`story id "${story.id}" 在 epic ${epic.id} 内重复`);
					else storyIds.add(story.id as string);

					// 检查 story 的 dependsOn
					if (Array.isArray(story.dependsOn) && story.id) {
						for (const depId of story.dependsOn as string[]) {
							if (!allIds.has(depId)) {
								errors.push(`Story ${story.id} dependsOn 引用了不存在的 ID "${depId}"`);
							}
						}
						const cycle = detectCycle(d as unknown as RoadmapFile, story.id as string, story.dependsOn as string[]);
						if (cycle) {
							errors.push(`Story ${story.id} 存在循环依赖：${cycle.join(" → ")}`);
						}
					}

					if (!story.title) errors.push(`epics[${i}].stories[${j}].title 缺失`);
					if (!VALID_ITEM_STATUS.has(story.status as string))
						errors.push(`epics[${i}].stories[${j}].status 不合法`);
					if (story.planPath !== undefined && !validatePlanPath(story.planPath as string))
						errors.push(`epics[${i}].stories[${j}].planPath "${story.planPath}" 格式不合法`);

					if (!Array.isArray(story.tasks)) {
						errors.push(`epics[${i}].stories[${j}].tasks 不是数组`);
					} else {
						const taskIds = new Set<string>();
						for (let k = 0; k < story.tasks.length; k++) {
							const task = story.tasks[k] as Record<string, unknown>;
							if (!task.id) errors.push(`task[${k}].id 缺失`);
							else if (taskIds.has(task.id as string))
								errors.push(`task id "${task.id}" 在 story ${story.id} 内重复`);
							else taskIds.add(task.id as string);

							// 检查 task 的 dependsOn
							if (Array.isArray(task.dependsOn) && task.id) {
								for (const depId of task.dependsOn as string[]) {
									if (!allIds.has(depId)) {
										errors.push(`Task ${task.id} dependsOn 引用了不存在的 ID "${depId}"`);
									}
								}
								const cycle = detectCycle(d as unknown as RoadmapFile, task.id as string, task.dependsOn as string[]);
								if (cycle) {
									errors.push(`Task ${task.id} 存在循环依赖：${cycle.join(" → ")}`);
								}
							}

							if (!task.title) errors.push(`task[${k}].title 缺失`);
							if (!VALID_ITEM_STATUS.has(task.status as string))
								errors.push(`task[${k}].status 不合法`);
							if (task.planPath !== undefined && !validatePlanPath(task.planPath as string))
								errors.push(`task[${k}].planPath "${task.planPath}" 格式不合法`);
						}
					}

					// 状态一致性：story=done 但有 task 未完成
					if (
						(story.status as string) === "done" &&
						Array.isArray(story.tasks) &&
						(story.tasks as Record<string, unknown>[]).some(
							(t) => t.status !== "done" && t.status !== "dropped",
						)
					) {
						errors.push(
							`Story ${story.id} 状态为 done，但有未完成的 task：${(story.tasks as Record<string, unknown>[])
								.filter((t) => t.status !== "done" && t.status !== "dropped")
								.map((t) => `${t.id}(${t.status})`)
								.join(", ")}`,
						);
					}
				}
			}

			// 状态一致性：epic=done 但有 story 未完成
			if (
				(epic.status as string) === "done" &&
				Array.isArray(epic.stories) &&
				(epic.stories as Record<string, unknown>[]).some(
					(s) => s.status !== "done" && s.status !== "dropped",
				)
			) {
				errors.push(
					`Epic ${epic.id} 状态为 done，但有未完成的 story：${(epic.stories as Record<string, unknown>[])
						.filter((s) => s.status !== "done" && s.status !== "dropped")
						.map((s) => `${s.id}(${s.status})`)
						.join(", ")}`,
				);
			}
		}
	}

	return { valid: errors.length === 0, errors };
}

/** 尝试修复常见问题（轻量修复） */
export function repairRoadmap(data: unknown): RoadmapFile | null {
	try {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- repair 函数必须对未知结构做 mutation
		const d = data as Record<string, unknown>;
		if (!d.meta) d.meta = {};
		const meta = d.meta as Record<string, unknown>;
		if (!meta.id) return null;
		if (!meta.title) meta.title = meta.id;
		if (!meta.status || !VALID_ROADMAP_STATUS.has(meta.status as string))
			meta.status = "active";
		if (!meta.created)
			meta.created = new Date().toISOString().slice(0, 10);
		if (!meta.updated) meta.updated = meta.created;
		if (!Array.isArray(meta.tags)) meta.tags = [];

		if (!Array.isArray(d.epics)) d.epics = [];

		for (const epic of d.epics as Record<string, unknown>[]) {
			if (!VALID_ITEM_STATUS.has(epic.status as string)) epic.status = "todo";
			if (!VALID_PRIORITY.has(epic.priority as string)) epic.priority = "medium";
			if (!epic.project) epic.project = "";
			if (!Array.isArray(epic.stories)) epic.stories = [];

			for (const story of epic.stories as Record<string, unknown>[]) {
				if (!VALID_ITEM_STATUS.has(story.status as string)) story.status = "todo";
				if (!Array.isArray(story.tasks)) story.tasks = [];

				for (const task of story.tasks as Record<string, unknown>[]) {
					if (!VALID_ITEM_STATUS.has(task.status as string)) task.status = "todo";
				}
			}
		}

		return d as unknown as RoadmapFile;
	} catch { // JSON 损坏或格式异常 → 视为无效
		return null;
	}
}
