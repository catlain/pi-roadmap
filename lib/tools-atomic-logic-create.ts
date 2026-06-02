/**
 * Roadmap 原子操作 — 创建类逻辑（addEpic / addStory / addTask / createRoadmap）
 *
 * 纯函数，不依赖 pi API，只操作数据结构。
 */

import { today } from "./tools-atomic-utils";
import type { Priority, RoadmapFile } from "./types";

/** 遍历整个 roadmap，查找已使用指定 planPath 的条目（返回 [{id, title}] */
function findPlanPathUsers(rm: RoadmapFile, planPath: string): { id: string; title: string }[] {
	const users: { id: string; title: string }[] = [];
	for (const epic of rm.epics) {
		if (epic.planPath === planPath) users.push({ id: epic.id, title: epic.title });
		for (const story of epic.stories) {
			if (story.planPath === planPath) users.push({ id: story.id, title: story.title });
			for (const task of story.tasks) {
				if (task.planPath === planPath) users.push({ id: task.id, title: task.title });
			}
		}
	}
	return users;
}

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
): { result: string; epicId?: string } {

	if (!planPath) {
		return { result: `⚠️ Epic 必须关联计划文档。请先用 write 创建计划文件（如 .pi/plans/E${rm.epics.length + 1}.md），然后传 planPath 参数。` };
	}

	// planPath 唯一性检查（硬拒绝）
	if (planPath) {
		const users = findPlanPathUsers(rm, planPath);
		if (users.length > 0) {
			return { result: `❌ planPath "${planPath}" 已被以下条目使用：${users.map((u) => `${u.id}(${u.title})`).join(", ")}。请使用不同的 planPath，或为该条目创建新的计划文档。` };
		}
	}

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
		msg += `\n计划文档: .pi/plans/${planPath}`;
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
	if (!planPath) {
		const epic = rm.epics.find((e) => e.id === epicId);
		const storyNum = epic ? epic.stories.length + 1 : 1;
		return { result: `⚠️ Story 必须关联计划文档。请先用 write 创建计划文件（如 .pi/plans/${epicId}-S${storyNum}.md），然后传 planPath 参数。` };
	}
	const epic = rm.epics.find((e) => e.id === epicId);
	if (!epic) return { result: `错误：Epic "${epicId}" 不存在。` };
	if (epic.archived) {
		return { result: `⚠️ Epic "${epicId}" 已归档，无法添加 Story。请先取消归档或使用其他 Epic。` };
	}
	if (epic.status === "done") {
		// done 未归档时允许添加 Story（自动重开为 doing）
		// 但 dropped 仍不允许
	}
	if (epic.status === "dropped") {
		return { result: `⚠️ Epic "${epicId}" 状态为 "dropped"，无法添加 Story。` };
	}
	// 检查同名 Story（不阻止，仅警告）
	const existing = epic.stories.find((s) => s.title === title);
	const warning = existing
		? `⚠️ Epic ${epicId} 下已存在同名 Story "${title}" (ID: ${existing.id})，确认是否需要重复添加？\n`
		: "";

	// planPath 唯一性检查（硬拒绝）
	if (planPath) {
		const users = findPlanPathUsers(rm, planPath);
		if (users.length > 0) {
			return { result: `❌ planPath "${planPath}" 已被以下条目使用：${users.map((u) => `${u.id}(${u.title})`).join(", ")}。请使用不同的 planPath，或为该条目创建新的计划文档。` };
		}
	}

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
		msg += `\n计划文档: .pi/plans/${planPath}`;
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
			if (story.status === "dropped") {
				return { result: `⚠️ Story "${storyId}" 状态为 "dropped"，无法添加 Task。` };
			}
			// done 状态允许添加 Task（未归档可继续修改）
			// 检查所属 epic 是否已归档/已完成
			if (epic.archived) {
				return { result: `⚠️ Story "${storyId}" 所属 Epic "${epic.id}" 已归档，无法添加 Task。` };
			}
			if (epic.status === "dropped") {
				return { result: `⚠️ Story "${storyId}" 所属 Epic "${epic.id}" 状态为 "dropped"，无法添加 Task。` };
			}
			// done 状态允许添加 Task（未归档可继续修改）
			// 检查同名 Task（不阻止，仅警告）
			const existing = story.tasks.find((t) => t.title === title);
			const warning = existing
				? `⚠️ Story ${storyId} 下已存在同名 Task "${title}" (ID: ${existing.id})，确认是否需要重复添加？\n`
				: "";

			// planPath 唯一性检查（硬拒绝）
			if (planPath) {
				const users = findPlanPathUsers(rm, planPath);
				if (users.length > 0) {
					return { result: `❌ planPath "${planPath}" 已被以下条目使用：${users.map((u) => `${u.id}(${u.title})`).join(", ")}。请使用不同的 planPath，或为该条目创建新的计划文档。` };
				}
			}

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
				msg += `\n计划文档: .pi/plans/${planPath}`;
			}
			return {
				result: msg,
				taskId: task.id,
			};
		}
	}
	return { result: `错误：Story "${storyId}" 不存在。` };
}
