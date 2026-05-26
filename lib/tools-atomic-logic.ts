/**
 * Roadmap 原子操作 — 纯逻辑函数（从注册函数中提取，方便测试）
 *
 * 所有函数不依赖 pi API，只操作数据结构，可独立测试。
 */

import type { RoadmapFile, Epic, Story, Task, Priority } from "./types";
import { today } from "./tools-atomic-utils";

// ── Create roadmap ──

export function createRoadmap(roadmapId: string, title: string, tags?: string[]): RoadmapFile {
	const now = new Date().toISOString();
	return {
		meta: { id: roadmapId, title, status: "active", created: now, updated: now, tags: tags ?? [] },
		epics: [],
	};
}

// ── Add Epic ──

export function addEpic(rm: RoadmapFile, title: string, description: string, priority: Priority | undefined, project: string): { result: string; epicId: string } {
	const epic: Epic = {
		id: `E${rm.epics.length + 1}`,
		title,
		description,
		status: "todo",
		priority: priority ?? "medium",
		project,
		createdDate: today(),
		stories: [],
	};
	rm.epics.push(epic);
	return { result: `✅ Epic ${epic.id}: ${title} 已添加。`, epicId: epic.id };
}

// ── Add Story ──

export function addStory(rm: RoadmapFile, epicId: string, title: string, description: string): { result: string; storyId?: string } {
	const epic = rm.epics.find((e) => e.id === epicId);
	if (!epic) return { result: `错误：Epic "${epicId}" 不存在。` };
	const story: Story = {
		id: `${epic.id}.S${epic.stories.length + 1}`,
		title,
		description,
		status: "todo",
		createdDate: today(),
		tasks: [],
	};
	epic.stories.push(story);
	return { result: `✅ Story ${story.id}: ${title} 已添加。`, storyId: story.id };
}

// ── Add Task ──

export function addTask(rm: RoadmapFile, storyId: string, title: string, priority: Priority | undefined): { result: string; taskId?: string } {
	for (const epic of rm.epics) {
		const story = epic.stories.find((s) => s.id === storyId);
		if (story) {
			const task: Task = {
				id: `${story.id}.T${story.tasks.length + 1}`,
				title,
				status: "todo",
				priority: priority ?? undefined,
				createdDate: today(),
			};
			story.tasks.push(task);
			return { result: `✅ Task ${task.id}: ${title} 已添加。`, taskId: task.id };
		}
	}
	return { result: `错误：Story "${storyId}" 不存在。` };
}

// ── Archive logic ──

export interface ArchiveResult {
	result: string;
	archivedIds: string[];
}

export function archiveEpic(rm: RoadmapFile, epicId: string): ArchiveResult {
	const epic = rm.epics.find((e) => e.id === epicId);
	if (!epic) return { result: `错误：Epic "${epicId}" 不存在。`, archivedIds: [] };
	if (epic.status !== "done" && epic.status !== "dropped") {
		return { result: `⚠️ Epic ${epic.id} 状态为 "${epic.status}"，建议只归档已完成/已放弃的 Epic。`, archivedIds: [] };
	}
	epic.archived = true;
	for (const story of epic.stories) {
		story.archived = true;
		for (const task of story.tasks) {
			task.archived = true;
		}
	}
	return { result: `📦 已归档 Epic ${epic.id}: ${epic.title}`, archivedIds: [epic.id] };
}

export function archiveAllDone(rm: RoadmapFile): ArchiveResult {
	const archived: string[] = [];
	for (const epic of rm.epics) {
		const allDone = epic.stories.length > 0 && epic.stories.every((s) =>
			s.tasks.every((t) => t.status === "done" || t.status === "dropped"),
		);
		if (allDone && !epic.archived) {
			epic.archived = true;
			epic.status = epic.status === "dropped" ? "dropped" : "done";
			if (!epic.doneDate) epic.doneDate = today();
			for (const story of epic.stories) {
				story.archived = true;
				for (const task of story.tasks) {
					task.archived = true;
				}
			}
			archived.push(`${epic.id}: ${epic.title}`);
		}
	}
	if (archived.length === 0) {
		return { result: "没有可归档的已完成 Epic。", archivedIds: [] };
	}
	return { result: `📦 已归档 ${archived.length} 个 Epic：\n${archived.map((a) => `  ${a}`).join("\n")}`, archivedIds: archived };
}

export function getArchivedEpics(rm: RoadmapFile): string[] {
	return rm.epics.filter((e) => e.archived).map((e) => {
		const taskCount = e.stories.reduce((s, st) => s + st.tasks.length, 0);
		return `📦 ${e.id}: ${e.title} [${taskCount} tasks]${e.doneDate ? ` done: ${e.doneDate}` : ""}`;
	});
}

// ── Done logic (with cascade + timestamps) ──

export interface DoneResult {
	result: string;
	doneTaskId: string;
	cascadeInfo: string[];
}

export function markTaskDone(rm: RoadmapFile, taskId: string, sessionId: string): DoneResult {
	const cascadeInfo: string[] = [];

	for (const epic of rm.epics) {
		for (const story of epic.stories) {
			const task = story.tasks.find((t) => t.id === taskId);
			if (!task) continue;

			// 标记 task
			task.status = "done";
			task.doneDate = today();
			task.doneBySessionId = sessionId;
			delete task.doingSessionId;

			// 级联检查 story
			const allStoryDone = story.tasks.every((t) => t.status === "done" || t.status === "dropped");
			if (allStoryDone && story.status !== "done") {
				story.status = "done";
				story.doneDate = today();
				cascadeInfo.push(`Story ${story.id} 已自动完成`);

				// 级联检查 epic
				const allEpicDone = epic.stories.every((s) => s.status === "done" || s.status === "dropped");
				if (allEpicDone && epic.status !== "done") {
					epic.status = "done";
					epic.doneDate = today();
					cascadeInfo.push(`Epic ${epic.id} 已自动完成`);
				}
			}

			return { result: `✅ Task ${taskId}: ${task.title} 已完成。`, doneTaskId: taskId, cascadeInfo };
		}
	}
	return { result: `错误：Task "${taskId}" 不存在。`, doneTaskId: "", cascadeInfo };
}
