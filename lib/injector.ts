/**
 * Roadmap 注入 — before_agent_start 自动生成概览文本
 *
 * 注入策略：
 *   - 只注入活跃 roadmap 的概览（≤200 token）
 *   - 每个 Epic 只显示 1 个"下一步"
 *   - 详情按需 roadmap_show
 */

import { filterByStatus, formatProgress } from "./parser";
import { calcProgress, getNextTasks } from "./progress";
import { shortSessionId } from "./tools-query-format";
import type { RoadmapFile } from "./types";

export interface InjectionConfig {
	/** 是否显示进度条 */
	showProgressBar?: boolean;
	/** 每个 roadmap 最多显示几个 next 任务 */
	maxNextPerRoadmap?: number;
	/** 最大注入行数 */
	maxLines?: number;
}

/** 生成注入文本 */
export function generateInjection(
	roadmaps: RoadmapFile[],
	config: InjectionConfig = {},
): string {
	const {
		showProgressBar = true,
		maxNextPerRoadmap = 3,
		maxLines = 20,
	} = config;

	const active = filterByStatus(roadmaps, "active");
	if (active.length === 0) return "";

	const lines: string[] = [];
	lines.push("# 项目路线图");
	lines.push("");

	// ── 🔄 进行中任务（跨会话可见性）
	const doingTasks: Array<{
		roadmapTitle: string;
		epicId: string;
		storyId: string;
		taskId: string;
		taskTitle: string;
		sessionId?: string;
		doingDate?: string;
	}> = [];
	for (const rm of active) {
		for (const epic of rm.epics) {
			for (const story of epic.stories) {
				for (const task of story.tasks) {
					if (task.status === "doing") {
						doingTasks.push({
							roadmapTitle: rm.meta.title,
							epicId: epic.id,
							storyId: story.id,
							taskId: task.id,
							taskTitle: task.title,
							sessionId: task.doingSessionId,
							doingDate: task.doingDate,
						});
					}
				}
			}
		}
	}
	if (doingTasks.length > 0) {
		lines.push("## 🔄 进行中");
		lines.push("");
		for (const dt of doingTasks) {
			const session = dt.sessionId ? `session: ${shortSessionId(dt.sessionId)}` : "";
			const timeAgo = dt.doingDate ? timeSince(dt.doingDate) : "";
			const meta = [session, timeAgo].filter(Boolean).join(", ");
			const metaStr = meta ? ` (${meta})` : "";
			lines.push(`  🔄 ${dt.taskId} ${dt.taskTitle}${metaStr}`);
		}
		lines.push("");
	}

	for (const rm of active) {
		const progress = calcProgress(rm);

		// 跳过 100% 完成且没有进行中任务的 roadmap
		if (progress.percent === 100 && progress.total > 0) continue;

		const bar = showProgressBar ? ` ${formatProgress(progress.percent)}` : "";
		lines.push(`## ${rm.meta.title} ${bar} ${progress.percent}%`);
		lines.push("");

		// 每个 epic 一行状态（跳过已归档和已完成）
		const allNextTasks = getNextTasks(rm, maxNextPerRoadmap);

		for (const epic of rm.epics) {
			if (epic.archived) continue;
			if (epic.status === "done" || epic.status === "dropped") continue;
			const nextForEpic = allNextTasks.filter((t) => t.epicId === epic.id);
			const statusLabel = epic.status === "doing" ? "doing" : "todo";
			const nextHint =
				nextForEpic.length > 0 ? ` — 下一步: ${nextForEpic[0].title}` : "";
			const planMark = epic.planPath ? ` [plan: ${epic.planPath}]` : "";
			lines.push(`  Epic ${epic.id} ${epic.title} [${statusLabel}]${planMark}${nextHint}`);
		}
		lines.push("");
	}

	// 截断控制
	if (lines.length > maxLines) {
		lines.length = maxLines;
		lines.push("... (截断，调用 roadmap_show 查看详情)");
	}

	lines.push("调用 roadmap_next 查看可执行任务。");

	return lines.join("\n");
}

/** 计算时间差的人类可读描述（如 "5分钟前"、"2小时前"、"1天前"） */
export function timeSince(isoDate: string): string {
	const now = Date.now();
	const then = new Date(isoDate).getTime();
	if (isNaN(then)) return "";
	const diffMs = now - then;
	if (diffMs < 0) return "刚刚";

	const seconds = Math.floor(diffMs / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}天前`;
	if (hours > 0) return `${hours}小时前`;
	if (minutes > 0) return `${minutes}分钟前`;
	return "刚刚";
}
