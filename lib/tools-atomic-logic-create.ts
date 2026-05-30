/**
 * Roadmap 原子操作 — 创建类逻辑（addEpic / addStory / addTask / createRoadmap）
 *
 * 纯函数，不依赖 pi API，只操作数据结构。
 */

import { today } from "./tools-atomic-utils";
import type { Priority, RoadmapFile } from "./types";

// ── Create roadmap ──

export function createRoadmap(
	roadmapId: string,
	title: string,
	tags?: string[],
): RoadmapFile {
	const now = new Date().toISOString();
	return {
		meta: {
			id: roadmapId,
			title,
			status: "active",
			created: now,
			updated: now,
			tags: tags ?? [],
		},
		epics: [],
	};
}

// ── Add Epic ──

export function addEpic(
	rm: RoadmapFile,
	title: string,
	description: string,
	priority: Priority | undefined,
	project: string,
	planPath?: string,
): { result: string; epicId: string } {
	const epic = {
		id: `E${rm.epics.length + 1}`,
		title,
		description,
		status: "todo" as const,
		priority: priority ?? "medium",
		project,
		createdDate: today(),
		stories: [] as never[],
		...(planPath ? { planPath } : {}),
	};
	rm.epics.push(epic);
	let msg = `✅ Epic ${epic.id}: ${title} 已添加。`;
	if (planPath) {
		msg += `\n计划文档: ${planPath}。请创建计划文档。`;
	} else {
		msg += `\n💡 建议创建计划文档: ${epic.id}.md（Epic 级计划：背景、目标、架构决策）。`;
	}
	return { result: msg, epicId: epic.id };
}

// ── Add Story ──

export function addStory(
	rm: RoadmapFile,
	epicId: string,
	title: string,
	description: string,
	dependsOn?: string[],
	planPath?: string,
): { result: string; storyId?: string } {
	const epic = rm.epics.find((e) => e.id === epicId);
	if (!epic) return { result: `错误：Epic "${epicId}" 不存在。` };
	if (epic.archived) {
		return { result: `⚠️ Epic "${epicId}" 已归档，无法添加 Story。请先取消归档或使用其他 Epic。` };
	}
	if (epic.status === "done" || epic.status === "dropped") {
		return { result: `⚠️ Epic "${epicId}" 状态为 "${epic.status}"，无法添加 Story。` };
	}
	// 检查同名 Story（不阻止，仅警告）
	const existing = epic.stories.find((s) => s.title === title);
	const warning = existing
		? `⚠️ Epic ${epicId} 下已存在同名 Story "${title}" (ID: ${existing.id})，确认是否需要重复添加？\n`
		: "";

	const story = {
		id: `${epic.id}.S${epic.stories.length + 1}`,
		title,
		description,
		status: "todo" as const,
		createdDate: today(),
		...(dependsOn ? { dependsOn } : {}),
		...(planPath ? { planPath } : {}),
		tasks: [] as never[],
	};
	epic.stories.push(story);
	let msg = `${warning}✅ Story ${story.id}: ${title} 已添加。`;
	if (planPath) {
		msg += `\n计划文档: ${planPath}。请创建计划文档。`;
	} else {
		msg += `\n💡 建议创建计划文档: ${story.id.replace(/\./g, "-")}.md（Story 级计划：目标、实现方案、验收标准）。`;
	}
	return { result: msg, storyId: story.id };
}

// ── Add Task ──

export function addTask(
	rm: RoadmapFile,
	storyId: string,
	title: string,
	priority: Priority | undefined,
	dependsOn?: string[],
	planPath?: string,
): { result: string; taskId?: string } {
	for (const epic of rm.epics) {
		const story = epic.stories.find((s) => s.id === storyId);
		if (story) {
			// 检查 story 是否已归档/已完成
			if (story.archived) {
				return { result: `⚠️ Story "${storyId}" 已归档，无法添加 Task。` };
			}
			if (story.status === "done" || story.status === "dropped") {
				return { result: `⚠️ Story "${storyId}" 状态为 "${story.status}"，无法添加 Task。` };
			}
			// 检查所属 epic 是否已归档/已完成
			if (epic.archived) {
				return { result: `⚠️ Story "${storyId}" 所属 Epic "${epic.id}" 已归档，无法添加 Task。` };
			}
			if (epic.status === "done" || epic.status === "dropped") {
				return { result: `⚠️ Story "${storyId}" 所属 Epic "${epic.id}" 状态为 "${epic.status}"，无法添加 Task。` };
			}
			// 检查同名 Task（不阻止，仅警告）
			const existing = story.tasks.find((t) => t.title === title);
			const warning = existing
				? `⚠️ Story ${storyId} 下已存在同名 Task "${title}" (ID: ${existing.id})，确认是否需要重复添加？\n`
				: "";

			const task = {
				id: `${story.id}.T${story.tasks.length + 1}`,
				title,
				status: "todo" as const,
				priority: priority ?? undefined,
				createdDate: today(),
				...(dependsOn ? { dependsOn } : {}),
				...(planPath ? { planPath } : {}),
			};
			story.tasks.push(task);
			let msg = `${warning}✅ Task ${task.id}: ${title} 已添加。`;
			if (planPath) {
				msg += `\n计划文档: ${planPath}。请创建计划文档。`;
			} else {
				msg += `\n💡 复杂 Task 可创建计划文档: ${task.id.replace(/\./g, "-")}.md（Task 级计划：具体步骤、预期产出）。`;
			}
			return {
				result: msg,
				taskId: task.id,
			};
		}
	}
	return { result: `错误：Story "${storyId}" 不存在。` };
}
