/**
 * Roadmap 格式化辅助函数
 *
 * 纯函数，不依赖 typebox / ExtensionAPI，方便测试
 */

import { formatDependencies } from "./dependency";
import { formatProgress, getOverview } from "./parser";
import type { Epic, RoadmapFile, Story, Task } from "./types";

/** 从完整会话 ID 中提取短标识（UUID 最后两段，如 8740-8fce3e7af232） */
export function shortSessionId(sessionId: string): string {
	// 格式：2026-05-27T02-00-31-412Z_019e6729-77b4-7bb8-8740-8fce3e7af232
	const uuid = sessionId.includes("_") ? sessionId.split("_").pop()! : sessionId;
	const parts = uuid.split("-");
	// UUID v7: time_high-mid-ver-clock_seq-node → 取最后两段
	if (parts.length >= 2) return parts.slice(-2).join("-");
	return uuid;
}

/** 格式化时间戳摘要 */
export function formatTimestamps(item: {
	createdDate?: string;
	doingDate?: string;
	doneDate?: string;
	doingSessionId?: string;
	doneBySessionId?: string;
}): string {
	const parts: string[] = [];
	if (item.createdDate) parts.push(`created: ${item.createdDate}`);
	if (item.doingDate) parts.push(`doing: ${item.doingDate}`);
	if (item.doneDate) parts.push(`done: ${item.doneDate}`);
	if (item.doingSessionId)
		parts.push(`session: ${shortSessionId(item.doingSessionId)}`);
	else if (item.doneBySessionId)
		parts.push(`by: ${shortSessionId(item.doneBySessionId)}`);
	return parts.length > 0 ? ` [${parts.join(", ")}]` : "";
}

/** 获取 Epic 下最近活动日期（所有 task 时间戳中最新者） */
export function getLatestActivityDate(epic: Epic): string | undefined {
	const dates: string[] = [];
	for (const story of epic.stories) {
		for (const task of story.tasks) {
			if (task.doneDate) dates.push(task.doneDate);
			if (task.doingDate) dates.push(task.doingDate);
			if (task.createdDate) dates.push(task.createdDate);
		}
		if (story.doneDate) dates.push(story.doneDate);
		if (story.doingDate) dates.push(story.doingDate);
		if (story.createdDate) dates.push(story.createdDate);
	}
	if (epic.doneDate) dates.push(epic.doneDate);
	if (epic.doingDate) dates.push(epic.doingDate);
	if (epic.createdDate) dates.push(epic.createdDate);
	if (dates.length === 0) return undefined;
	return dates.sort().reverse()[0];
}

/** 格式化选项 */
export interface FormatOptions {
	epicId?: string;
	showCompleted?: boolean;
	showArchived?: boolean;
}

/** 格式化路线图详情文本 */
export function formatRoadmapDetail(
	roadmap: RoadmapFile,
	opts: FormatOptions = {},
): string {
	const { epicId, showCompleted = true, showArchived = false } = opts;
	const overview = getOverview(roadmap);
	const bar = formatProgress(overview.percent);

	let output = `# ${overview.title} ${bar} ${overview.percent}%\n`;
	output += `Status: ${overview.status} | Tags: ${overview.tags.join(", ") || "无"}\n\n`;

	for (const epic of roadmap.epics) {
		if (epicId && epic.id !== epicId) continue;
		if (epic.archived && !showArchived) continue;

		const isComplete = epic.status === "done" || epic.status === "dropped";
		if (isComplete && !showCompleted) {
			const taskCount = epic.stories.reduce(
				(sum, s) => sum + s.tasks.length,
				0,
			);
			output += `✅ ${epic.id}: ${epic.title} [${taskCount} tasks]${formatTimestamps(epic)}\n`;
			continue;
		}

		const archiveTag = epic.archived ? " 📦" : "";
		output += `## Epic ${epic.id}: ${epic.title} [${epic.status}/${epic.priority}]${archiveTag}${formatTimestamps(epic)}\n`;
		output += `${epic.description}\n`;
		const epicDeps = epic.dependsOn
			? `Dependencies: ${formatDependencies(roadmap, epic.dependsOn)}\n`
			: "";
		output += `${epicDeps}`;
		output += `Project: ${epic.project || "未指定"}\n\n`;

		for (const story of epic.stories) {
			if (story.archived && !showArchived) continue;

			const storyComplete =
				story.status === "done" || story.status === "dropped";
			if (storyComplete && !showCompleted) {
				const taskCount = story.tasks.length;
				output += `  ✅ ${story.id}: ${story.title} [${taskCount} tasks]${formatTimestamps(story)}\n`;
				continue;
			}

			const storyArchiveTag = story.archived ? " 📦" : "";
			const storyDeps = story.dependsOn
				? ` [deps: ${formatDependencies(roadmap, story.dependsOn)}]`
				: "";
			output += `### Story ${story.id}: ${story.title} [${story.status}]${storyArchiveTag}${formatTimestamps(story)}${storyDeps}\n`;
			output += `${story.description}\n`;
			if (story.tasks.length === 0) {
				output += "  (暂无 Task)\n";
			}
			for (const task of story.tasks) {
				if (task.archived && !showArchived) continue;

				const check =
					task.status === "done"
						? "✅"
						: task.status === "doing"
							? "🔄"
							: task.status === "blocked"
								? "🚫"
								: task.status === "dropped"
									? "❌"
									: "⬜";
				const note = task.note ? ` — ${task.note}` : "";
				const deps = task.dependsOn
					? ` [deps: ${formatDependencies(roadmap, task.dependsOn)}]`
					: "";
				output += `  ${check} ${task.id}: ${task.title}${formatTimestamps(task)}${note}${deps}\n`;
			}
			output += "\n";
		}
	}

	return output;
}
