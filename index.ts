/**
 * Roadmap 扩展 — Epic→Story→Task 三层路线图管理
 *
 * 工具：roadmap_list / roadmap_show / roadmap_plan / roadmap_next / roadmap_done
 * 增量工具：roadmap_create / roadmap_add_epic / roadmap_add_story / roadmap_add_task / roadmap_update / roadmap_archive
 *
 * 存储：
 *   全局: ~/.pi/roadmap/<id>.roadmap.json（唯一数据源）
 *   归档: ~/.pi/roadmap/archive/<id>.roadmap.json
 *
 * 读端过滤：
 *   在项目目录下时，只返回 epic.project 匹配 cwd 的 Epic（roadmap_list/show/next）
 *
 * 进度同步：
 *   roadmap_plan 把 task 状态改为 doing → 写 doing.json
 *   roadmap_done 标记完成 → 清 doing.json
 *   agent_end → 检查 doing.json，有未同步任务则显示提醒（display only，不触发新 turn）
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readDoing, syncDoing } from "./lib/doing-store";
import { listRoadmapFiles, readRoadmap } from "./lib/store";
import { registerAddTool } from "./lib/tools-add-reg";
import { checkArchiveableEpics } from "./lib/tools-atomic-logic";
import { registerPlanTool } from "./lib/tools-plan";
import {
	registerListTool,
	registerSearchTool,
	registerShowTool,
} from "./lib/tools-query";
import { registerUpdateTool } from "./lib/tools-update-reg";

export default function roadmapExtension(pi: ExtensionAPI) {
	// ── 注册所有工具 ──
	registerListTool(pi);
	registerShowTool(pi);
	registerSearchTool(pi);
	registerPlanTool(pi);
	registerAddTool(pi);
	registerUpdateTool(pi);

	// ── agent_end：检查未同步的 doing 任务（仅当前会话） ──
	pi.on("agent_end", async (_event, _ctx) => {
		// 获取当前会话 ID
		const sessionFile = _ctx?.sessionManager?.getSessionFile?.() ?? "";
		const currentSessionId =
			sessionFile
				.split("/")
				.pop()
				?.replace(/\.jsonl$/, "") ?? "";

		// 快速检查：如果 doing.json 为空则跳过
		const allDoing = readDoing();
		if (allDoing.length === 0) return;

		// 有 doing 条目才遍历 roadmap 文件
		const rmFiles = listRoadmapFiles();
		const rms = rmFiles
			.map((f) => readRoadmap(f))
			.filter(Boolean) as NonNullable<ReturnType<typeof readRoadmap>>[];
		syncDoing(rms);

		// 只提醒当前会话的 doing 条目
		const doingEntries = currentSessionId
			? allDoing.filter((e) => e.sessionId === currentSessionId)
			: allDoing;
		if (doingEntries.length === 0) return;

		const taskList = doingEntries
			.map((e) => `  - ${e.taskId}: ${e.taskTitle} (${e.roadmapId})`)
			.join("\n");

		const reminder =
			`📋 **Roadmap 进度同步提醒**\n\n` +
			`以下任务仍在进行中，请检查是否已完成并调用 roadmap_done 同步进度：\n\n` +
			`${taskList}\n\n` +
			`如果任务已完成，请调用 \`roadmap_done\` 标记。如果未完成，可以忽略此提醒。`;

		// 仅 display 展示，不触发新 turn（防止 agent_end → sendMessage → AI 回复 → agent_end 循环）
		try {
			pi.sendMessage({
				customType: "roadmap-doing-reminder",
				content: reminder,
				display: true,
			});
		} catch {
			// session 已关闭或替换，忽略
		}

		// ── 检查可归档的已完成 Epic ──
		const archiveReminder = checkArchiveableEpics(rms);
		if (archiveReminder) {
			try {
				pi.sendMessage({
					customType: "roadmap-archive-reminder",
					content: archiveReminder,
					display: true,
				});
			} catch {
				// session 已关闭或替换，忽略
			}
		}
	});
}
