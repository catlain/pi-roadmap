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
 *   roadmap_next → 写 doing.json（持久化正在执行的任务）
 *   roadmap_done → 清 doing.json
 *   agent_end → 检查 doing.json，有未同步任务则提醒 AI
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerListTool, registerShowTool } from "./lib/tools-query";
import { registerPlanTool } from "./lib/tools-plan";
import { registerNextTool, registerDoneTool } from "./lib/tools-action";
import { readDoing } from "./lib/doing-store";

export default function roadmapExtension(pi: ExtensionAPI) {
	// ── 注册所有工具 ──
	registerListTool(pi);
	registerShowTool(pi);
	registerPlanTool(pi);
	registerNextTool(pi);
	registerDoneTool(pi);

	// ── agent_end：检查未同步的 doing 任务 ──
	pi.on("agent_end", async (_event, _ctx) => {
		const doingEntries = readDoing();
		if (doingEntries.length === 0) return;

		const taskList = doingEntries
			.map((e) => `  - ${e.taskId}: ${e.taskTitle} (${e.roadmapId})`)
			.join("\n");

		const reminder =
			`📋 **Roadmap 进度同步提醒**\n\n` +
			`以下任务仍在进行中，请检查是否已完成并调用 roadmap_done 同步进度：\n\n` +
			`${taskList}\n\n` +
			`如果任务已完成，请调用 \`roadmap_done\` 标记。如果未完成，可以忽略此提醒。`;

		// 注入提醒消息，触发一个新 turn 让 AI 处理
		setTimeout(() => {
			try {
				pi.sendMessage(
					{
						customType: "roadmap-doing-reminder",
						content: reminder,
						display: true,
					},
					{ triggerTurn: true },
				);
			} catch {
				// session 已关闭或替换，忽略
			}
		}, 100);
	});
}
