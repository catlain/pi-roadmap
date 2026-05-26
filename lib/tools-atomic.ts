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
import { archiveEpic as _archiveEpic, archiveAllDone as _archiveAllDone, getArchivedEpics as _getArchivedEpics } from "./tools-atomic-logic";

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

				const lines = _getArchivedEpics(rm);
				if (lines.length === 0) {
					return { content: [{ type: "text" as const, text: "没有已归档的 Epic。" }], details: {} };
				}
				return { content: [{ type: "text" as const, text: `已归档 Epic：\n${lines.join("\n")}` }], details: {} };
			}

			// 归档模式
			const result = atomicUpdate(params.roadmapId, (rm) => {
				if (params.epic_id) {
					return _archiveEpic(rm, params.epic_id).result;
				} else {
					return _archiveAllDone(rm).result;
				}
			});
			return { content: [{ type: "text" as const, text: result }], details: {} };
		},
	});
}
