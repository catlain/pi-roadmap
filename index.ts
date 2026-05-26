/**
 * Roadmap 扩展 — Epic→Story→Task 三层路线图管理
 *
 * 工具：roadmap_list / roadmap_show / roadmap_plan / roadmap_next / roadmap_done
 *
 * 存储：
 *   全局: ~/.pi/roadmap/<id>.roadmap.json
 *   项目: <project>/.pi/roadmap/roadmap.json（派生）
 *   归档: ~/.pi/roadmap/archive/<id>.roadmap.json
 *
 * 进度同步：
 *   roadmap_plan 把 task 状态改为 doing → 写 doing.json
 *   roadmap_done 标记完成 → 清 doing.json
 *   agent_end → 检查 doing.json，有未同步任务则显示提醒（display only，不触发新 turn）
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerListTool, registerShowTool } from "./lib/tools-query";
import { registerPlanTool } from "./lib/tools-plan";
import { registerNextTool, registerDoneTool } from "./lib/tools-action";
import { readDoing, syncDoing } from "./lib/doing-store";
import { listRoadmapFiles, readRoadmap } from "./lib/store";

export default function roadmapExtension(pi: ExtensionAPI) {
	// ── 注册所有工具 ──
	registerListTool(pi);
	registerShowTool(pi);
	registerPlanTool(pi);
	registerNextTool(pi);
	registerDoneTool(pi);

	// ── agent_end：检查未同步的 doing 任务（仅当前会话） ──
	pi.on("agent_end", async (_event, _ctx) => {
		// 获取当前会话 ID
		const sessionFile = _ctx?.sessionManager?.getSessionFile?.() ?? "";
		const currentSessionId = sessionFile.split("/").pop()?.replace(/\.jsonl$/, "") ?? "";

		// 先 syncDoing：清理已 done/dropped/孤儿条目
		const rmFiles = listRoadmapFiles();
		const rms = rmFiles.map((f) => readRoadmap(f)).filter(Boolean) as NonNullable<ReturnType<typeof readRoadmap>>[];
		syncDoing(rms);

		// 只提醒当前会话的 doing 条目
		const allDoing = readDoing();
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
			pi.sendMessage(
				{
					customType: "roadmap-doing-reminder",
					content: reminder,
					display: true,
				},
			);
		} catch {
			// session 已关闭或替换，忽略
		}
	});
}
