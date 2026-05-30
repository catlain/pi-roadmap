/**
 * Roadmap 搜索功能
 *
 * 纯函数，不依赖 typebox / ExtensionAPI，方便测试
 */

import type { Epic, RoadmapFile, Story, Task } from "./types";
import { formatRoadmapDetail, statusIcon } from "./tools-query-format";

// ── 类型定义 ──

/** 搜索结果条目 */
export interface SearchResult {
	roadmapId: string;
	roadmapTitle: string;
	matchedType: "epic" | "story" | "task";
	matchedId: string;
	matchedTitle: string;
	detail: string;
}

/** 搜索选项 */
export interface SearchOptions {
	scope?: "epic" | "story" | "task" | "all";
	includeArchived?: boolean;
}

// ── 辅助函数 ──

function matches(text: string | undefined, query: string): boolean {
	if (!text) return false;
	return text.toLowerCase().includes(query.toLowerCase());
}

function formatStoryDetail(epic: Epic, story: Story, includeArchived: boolean): string {
	let out = `## Epic ${epic.id}: ${epic.title} [${epic.status}/${epic.priority}]`;
	if (epic.planPath) out += ` [plan: ${epic.planPath}]`;
	out += `\n### Story ${story.id}: ${story.title} [${story.status}]`;
	if (story.planPath) out += ` [plan: ${story.planPath}]`;
	out += `\n${story.description}\n\n`;
	for (const task of story.tasks) {
		if (task.archived && !includeArchived) continue;
		const note = task.note ? ` — ${task.note}` : "";
		const plan = task.planPath ? ` [plan: ${task.planPath}]` : "";
		out += `  ${statusIcon(task.status)} ${task.id}: ${task.title}${note}${plan}\n`;
	}
	return out;
}

function formatTaskDetail(epic: Epic, story: Story, task: Task): string {
	const note = task.note ? ` — ${task.note}` : "";
	const plan = task.planPath ? ` [plan: ${task.planPath}]` : "";
	let out = `## Epic ${epic.id}: ${epic.title}`;
	if (epic.planPath) out += ` [plan: ${epic.planPath}]`;
	out += `\n### Story ${story.id}: ${story.title}`;
	if (story.planPath) out += ` [plan: ${story.planPath}]`;
	out += `\n\n${statusIcon(task.status)} ${task.id}: ${task.title} [${task.status}]${note}${plan}\n`;
	return out;
}

// ── 搜索逻辑 ──

/**
 * 搜索路线图数据
 *
 * 纯函数，直接传 RoadmapFile[] 进行搜索，无副作用。
 * 对 Epic/Story/Task 的 title + description/note 做大小写不敏感匹配。
 */
export function searchRoadmapData(
	roadmaps: RoadmapFile[],
	query: string,
	options: SearchOptions = {},
): SearchResult[] {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const { scope = "all", includeArchived = false } = options;
	const results: SearchResult[] = [];

	for (const rm of roadmaps) {
		for (const epic of rm.epics) {
			if (epic.archived && !includeArchived) continue;

			if ((scope === "all" || scope === "epic")
				&& (matches(epic.title, trimmed) || matches(epic.description, trimmed))) {
				results.push({
					roadmapId: rm.meta.id,
					roadmapTitle: rm.meta.title,
					matchedType: "epic",
					matchedId: epic.id,
					matchedTitle: epic.title,
					// 复用 formatRoadmapDetail，传入 epicId 只展示该 Epic
					detail: formatRoadmapDetail(rm, { epicId: epic.id, showCompleted: true, showArchived: includeArchived }),
				});
			}

			for (const story of epic.stories) {
				if (story.archived && !includeArchived) continue;

				if ((scope === "all" || scope === "story")
					&& (matches(story.title, trimmed) || matches(story.description, trimmed))) {
					results.push({
						roadmapId: rm.meta.id,
						roadmapTitle: rm.meta.title,
						matchedType: "story",
						matchedId: story.id,
						matchedTitle: story.title,
						detail: formatStoryDetail(epic, story, includeArchived),
					});
				}

				for (const task of story.tasks) {
					if (task.archived && !includeArchived) continue;

					if ((scope === "all" || scope === "task")
						&& (matches(task.title, trimmed) || matches(task.note ?? "", trimmed))) {
						results.push({
							roadmapId: rm.meta.id,
							roadmapTitle: rm.meta.title,
							matchedType: "task",
							matchedId: task.id,
							matchedTitle: task.title,
							detail: formatTaskDetail(epic, story, task),
						});
					}
				}
			}
		}
	}

	return results;
}
