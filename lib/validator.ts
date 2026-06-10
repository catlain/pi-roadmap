/**
 * Roadmap 数据验证与修复
 *
 * 支持新旧两种格式：
 *   - 旧格式：无 eid，dependsOn 是 string[]
 *   - 新格式：有 eid，dependsOn 是 number[]
 * validator 对两种格式都宽容（不因缺少 eid 报错），迁移由 migrate.ts 处理。
 */

import { validatePlanPath } from "./plan-resolver";
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

/** 验证 roadmap 数据结构（宽容模式：兼容新旧格式） */
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
		// 收集所有 id（字符串路径）和 eid（数字）
		const allIds = new Set<string>();
		const allEids = new Set<number>();
		for (const epic of d.epics as Record<string, unknown>[]) {
			if (epic.id) allIds.add(epic.id as string);
			if (typeof epic.eid === "number") allEids.add(epic.eid);
			if (Array.isArray(epic.stories)) {
				for (const story of epic.stories as Record<string, unknown>[]) {
					if (story.id) allIds.add(story.id as string);
					if (typeof story.eid === "number") allEids.add(story.eid);
					if (Array.isArray(story.tasks)) {
						for (const task of story.tasks as Record<string, unknown>[]) {
							if (task.id) allIds.add(task.id as string);
							if (typeof task.eid === "number") allEids.add(task.eid);
						}
					}
				}
			}
		}

		// eid 唯一性检查
		const eidCounts = new Map<number, number>();
		for (const eid of allEids) {
			eidCounts.set(eid, (eidCounts.get(eid) ?? 0) + 1);
		}
		for (const [eid, count] of eidCounts) {
			if (count > 1) errors.push(`eid ${eid} 重复出现 ${count} 次`);
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
				validateDependsOn(
					epic.dependsOn,
					allIds,
					allEids,
					`Epic ${epic.id}`,
					errors,
				);
			}

			if (!epic.title) errors.push(`epics[${i}].title 缺失`);
			if (epic.project !== undefined && typeof epic.project !== "string")
				errors.push(`epics[${i}].project 类型错误`);
			if (!VALID_ITEM_STATUS.has(epic.status as string))
				errors.push(`epics[${i}].status "${epic.status}" 不合法`);
			if (!VALID_PRIORITY.has(epic.priority as string))
				errors.push(`epics[${i}].priority "${epic.priority}" 不合法`);
			if (
				epic.planPath !== undefined &&
				!validatePlanPath(epic.planPath as string)
			)
				errors.push(`epics[${i}].planPath "${epic.planPath}" 格式不合法（应为 E{N}.md 或 E{N}-S{M}.md，纯文件名，无目录/路径）`);

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
						validateDependsOn(
							story.dependsOn,
							allIds,
							allEids,
							`Story ${story.id}`,
							errors,
						);
					}

					if (!story.title) errors.push(`epics[${i}].stories[${j}].title 缺失`);
					if (!VALID_ITEM_STATUS.has(story.status as string))
						errors.push(`epics[${i}].stories[${j}].status 不合法`);
					if (
						story.planPath !== undefined &&
						!validatePlanPath(story.planPath as string)
					)
						errors.push(
							`epics[${i}].stories[${j}].planPath "${story.planPath}" 格式不合法（应为 E{N}-S{M}.md，纯文件名，无目录/路径）`,
						);

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
								validateDependsOn(
									task.dependsOn,
									allIds,
									allEids,
									`Task ${task.id}`,
									errors,
								);
							}

							if (!task.title) errors.push(`task[${k}].title 缺失`);
							if (!VALID_ITEM_STATUS.has(task.status as string))
								errors.push(`task[${k}].status 不合法`);
							if (
								task.planPath !== undefined &&
								!validatePlanPath(task.planPath as string)
							)
								errors.push(
									`task[${k}].planPath "${task.planPath}" 格式不合法（应为 E{N}-S{M}-T{K}.md，纯文件名，无目录/路径）`,
								);
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
							`Story ${story.id} 状态为 done，但有未完成的 task：${(
								story.tasks as Record<string, unknown>[]
							)
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
					`Epic ${epic.id} 状态为 done，但有未完成的 story：${(
						epic.stories as Record<string, unknown>[]
					)
						.filter((s) => s.status !== "done" && s.status !== "dropped")
						.map((s) => `${s.id}(${s.status})`)
						.join(", ")}`,
				);
			}
		}
	}

	// 循环依赖检测（eid 格式）
	if (d.epics && errors.length === 0) {
		const eidDepMap = new Map<number, number[]>(); // eid → dependsOn eids
		for (const epic of d.epics as Record<string, unknown>[]) {
			if (typeof epic.eid === "number") {
				const deps = Array.isArray(epic.dependsOn)
					? (epic.dependsOn as number[]).filter((d) => typeof d === "number")
					: [];
				if (deps.length > 0) eidDepMap.set(epic.eid, deps);
			}
			for (const story of (Array.isArray(epic.stories)
				? epic.stories
				: []) as Record<string, unknown>[]) {
				if (typeof story.eid === "number") {
					const deps = Array.isArray(story.dependsOn)
						? (story.dependsOn as number[]).filter((d) => typeof d === "number")
						: [];
					if (deps.length > 0) eidDepMap.set(story.eid, deps);
				}
				for (const task of (Array.isArray(story.tasks)
					? story.tasks
					: []) as Record<string, unknown>[]) {
					if (typeof task.eid === "number") {
						const deps = Array.isArray(task.dependsOn)
							? (task.dependsOn as number[]).filter(
									(d) => typeof d === "number",
								)
							: [];
						if (deps.length > 0) eidDepMap.set(task.eid, deps);
					}
				}
			}
		}

		// DFS 检测环
		const visited = new Set<number>();
		const onStack = new Set<number>();
		function dfs(eid: number): number[] | null {
			if (onStack.has(eid)) return [eid]; // found cycle
			if (visited.has(eid)) return null;
			visited.add(eid);
			onStack.add(eid);
			const deps = eidDepMap.get(eid);
			if (deps) {
				for (const dep of deps) {
					const cycle = dfs(dep);
					if (cycle) return [eid, ...cycle];
				}
			}
			onStack.delete(eid);
			return null;
		}
		for (const eid of eidDepMap.keys()) {
			if (!visited.has(eid)) {
				const cycle = dfs(eid);
				if (cycle) {
					errors.push(`循环依赖: ${cycle.map((e) => `#${e}`).join(" → ")}`);
					break;
				}
			}
		}
	}

	return { valid: errors.length === 0, errors };
}

/**
 * 验证 dependsOn 引用（兼容 string[] 和 number[] 两种格式）
 *
 * 旧格式 string[]：检查 allIds 中是否存在
 * 新格式 number[]：检查 allEids 中是否存在
 */
function validateDependsOn(
	dependsOn: unknown[],
	allIds: Set<string>,
	allEids: Set<number>,
	label: string,
	errors: string[],
): void {
	if (dependsOn.length === 0) return;

	// 判断是旧格式还是新格式
	if (typeof dependsOn[0] === "string") {
		// 旧格式：string[]
		for (const depId of dependsOn as string[]) {
			if (!allIds.has(depId)) {
				errors.push(`${label} dependsOn 引用了不存在的 ID "${depId}"`);
			}
		}
	} else if (typeof dependsOn[0] === "number") {
		// 新格式：number[]（eid）
		for (const depEid of dependsOn as number[]) {
			if (!allEids.has(depEid)) {
				errors.push(`${label} dependsOn 引用了不存在的 eid #${depEid}`);
			}
		}
	}
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
		if (!meta.created) meta.created = new Date().toISOString().slice(0, 10);
		if (!meta.updated) meta.updated = meta.created;
		if (!Array.isArray(meta.tags)) meta.tags = [];

		if (!Array.isArray(d.epics)) d.epics = [];

		for (const epic of d.epics as Record<string, unknown>[]) {
			if (!VALID_ITEM_STATUS.has(epic.status as string)) epic.status = "todo";
			if (!VALID_PRIORITY.has(epic.priority as string))
				epic.priority = "medium";
			if (!epic.project) epic.project = "";
			if (!Array.isArray(epic.stories)) epic.stories = [];

			for (const story of epic.stories as Record<string, unknown>[]) {
				if (!VALID_ITEM_STATUS.has(story.status as string))
					story.status = "todo";
				if (!Array.isArray(story.tasks)) story.tasks = [];

				for (const task of story.tasks as Record<string, unknown>[]) {
					if (!VALID_ITEM_STATUS.has(task.status as string))
						task.status = "todo";
				}
			}
		}

		return d as unknown as RoadmapFile;
	} catch {
		// JSON 损坏或格式异常 → 视为无效
		return null;
	}
}
