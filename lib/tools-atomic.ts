/**
 * Roadmap 增量操作工具 — Update + Archive
 *
 * roadmap_update: 更新任意 Epic/Story/Task 的属性
 * roadmap_archive: 归档已完成的 Epic
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { getRoadmapFilePath, readRoadmap } from "./store";
import { getSessionId, atomicUpdate, updateItem, updateTask } from "./tools-atomic-utils";

// ── roadmap_update ──

export function registerUpdateTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_update",
		label: "Roadmap Update",
		description: "更新任意 Epic/Story/Task 的属性（status、title、description、priority、note 等）。status→doing 时自动填 doingDate 和 sessionId。",
		parameters: Type.Object({
			roadmapId: Type.String({ description: "路线图 ID" }),
			item_id: Type.String({ description: "要更新的项目 ID，如 E1、E1.S2、E1.S1.T3" }),
			updates: Type.Object({
				status: Type.Optional(Type.String({ description: "新状态: todo/doing/done/blocked/dropped" })),
				title: Type.Optional(Type.String({ description: "新标题" })),
				description: Type.Optional(Type.String({ description: "新描述" })),
				priority: Type.Optional(Type.String({ description: "新优先级: high/medium/low" })),
				note: Type.Optional(Type.String({ description: "备注" })),
			}, { description: "要更新的字段（只传需要改的）" }),
		}),
		async execute(
			_toolCallId: string,
			params: { roadmapId: string; item_id: string; updates: Record<string, string> },
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			_ctx: unknown,
		) {
			const sessionId = getSessionId(_ctx);
			const result = atomicUpdate(params.roadmapId, (rm) => {
				const parts = params.item_id.split(".");
				const epicId = parts[0];
				const epic = rm.epics.find((e) => e.id === epicId);
				if (!epic) return `错误：Epic "${epicId}" 不存在。`;

				if (parts.length === 1) {
					return updateItem(epic, params.updates, sessionId);
				}

				const storyId = `${parts[0]}.${parts[1]}`;
				const story = epic.stories.find((s) => s.id === storyId);
				if (!story) return `错误：Story "${storyId}" 不存在。`;

				if (parts.length === 2) {
					return updateItem(story, params.updates, sessionId);
				}

				const taskId = params.item_id;
				const task = story.tasks.find((t) => t.id === taskId);
				if (!task) return `错误：Task "${taskId}" 不存在。`;
				return updateTask(task, params.updates, sessionId);
			});
			return { content: [{ type: "text" as const, text: result }], details: {} };
		},
	});
}

// ── roadmap_archive ──

export function registerArchiveTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_archive",
		label: "Roadmap Archive",
		description: "归档已完成的 Epic/Story。归档后默认不显示，可用 show_archived=true 查看。",
		parameters: Type.Object({
			roadmapId: Type.String({ description: "路线图 ID" }),
			epic_id: Type.Optional(Type.String({ description: "归档指定 Epic。不传则归档所有已完成 Epic。" })),
			show_archived: Type.Optional(Type.Boolean({ description: "查看已归档项，默认 false（仅查看模式）" })),
		}),
		async execute(
			_toolCallId: string,
			params: { roadmapId: string; epic_id?: string; show_archived?: boolean },
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			_ctx: unknown,
		) {
			// 查看模式
			if (params.show_archived) {
				const filePath = getRoadmapFilePath(params.roadmapId);
				if (!filePath) return { content: [{ type: "text" as const, text: `路线图 "${params.roadmapId}" 不存在。` }], details: {} };
				const rm = readRoadmap(filePath);
				if (!rm) return { content: [{ type: "text" as const, text: `读取失败。` }], details: {} };

				const archivedEpics = rm.epics.filter((e) => e.archived);
				if (archivedEpics.length === 0) {
					return { content: [{ type: "text" as const, text: "没有已归档的 Epic。" }], details: {} };
				}
				const text = archivedEpics.map((e) => {
					const taskCount = e.stories.reduce((s, st) => s + st.tasks.length, 0);
					return `📦 ${e.id}: ${e.title} [${taskCount} tasks]${e.doneDate ? ` done: ${e.doneDate}` : ""}`;
				}).join("\n");
				return { content: [{ type: "text" as const, text: `已归档 Epic：\n${text}` }], details: {} };
			}

			// 归档模式
			const result = atomicUpdate(params.roadmapId, (rm) => {
				const archived: string[] = [];

				if (params.epic_id) {
					const epic = rm.epics.find((e) => e.id === params.epic_id);
					if (!epic) return `错误：Epic "${params.epic_id}" 不存在。`;
					if (epic.status !== "done" && epic.status !== "dropped") {
						return `⚠️ Epic ${epic.id} 状态为 "${epic.status}"，建议只归档已完成/已放弃的 Epic。`;
					}
					epic.archived = true;
					for (const story of epic.stories) {
						story.archived = true;
						for (const task of story.tasks) {
							task.archived = true;
						}
					}
					archived.push(`${epic.id}: ${epic.title}`);
				} else {
					for (const epic of rm.epics) {
						const allDone = epic.stories.every((s) =>
							s.tasks.every((t) => t.status === "done" || t.status === "dropped"),
						);
						if (allDone && epic.stories.length > 0 && !epic.archived) {
							epic.archived = true;
							epic.status = epic.status === "dropped" ? "dropped" : "done";
							if (!epic.doneDate) epic.doneDate = new Date().toISOString().slice(0, 10);
							for (const story of epic.stories) {
								story.archived = true;
								for (const task of story.tasks) {
									task.archived = true;
								}
							}
							archived.push(`${epic.id}: ${epic.title}`);
						}
					}
				}

				if (archived.length === 0) {
					return "没有可归档的已完成 Epic。";
				}
				return `📦 已归档 ${archived.length} 个 Epic：\n${archived.map((a) => `  ${a}`).join("\n")}`;
			});
			return { content: [{ type: "text" as const, text: result }], details: {} };
		},
	});
}
