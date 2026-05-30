/**
 * Roadmap 工具 — roadmap_update（合并 update + done + archive）
 *
 * 统一操作入口：
 * - 更新属性（title/description/priority/note/planPath/dependsOn）
 * - 标记完成（status=done，支持级联）
 * - 归档（archive=true）
 */

import { existsSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { clearDoing } from "./doing-store";
import {
	archiveAllDone as _archiveAllDone,
	archiveEpic as _archiveEpic,
	getArchivedEpics as _getArchivedEpics,
	markTaskDone as _markTaskDone,
} from "./tools-atomic-logic";
import {
	atomicUpdate,
	getSessionId,
	updateItem,
	updateTask,
} from "./tools-atomic-utils";
import { getRoadmapFilePath, readRoadmap, writeRoadmap } from "./store";

export function registerUpdateTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_update",
		label: "Roadmap Update",
		description:
			"更新路线图中的 Epic/Story/Task。支持：属性更新（title/description 等）、" +
			"标记完成（status=done）、归档（archive=true）。" +
			"Task 标记 done 时自动级联检查 Story/Epic 是否全部完成。",
		parameters: Type.Object({
			roadmapId: Type.String({ description: "路线图 ID" }),
			item_id: Type.String({
				description: "项目 ID，如 E1、E1.S2、E1.S1.T3",
			}),
			status: Type.Optional(
				Type.String({
					description: "新状态: todo/doing/done/blocked/dropped",
				}),
			),
			title: Type.Optional(Type.String({ description: "新标题" })),
			description: Type.Optional(Type.String({ description: "新描述" })),
			priority: Type.Optional(
				Type.String({ description: "新优先级: high/medium/low" }),
			),
			note: Type.Optional(Type.String({ description: "备注" })),
			planPath: Type.Optional(
				Type.String({ description: "计划文档文件名" }),
			),
			dependsOn: Type.Optional(
				Type.Array(Type.String(), { description: "依赖项 ID 列表" }),
			),
			archive: Type.Optional(
				Type.Boolean({ description: "归档该 Epic（仅 Epic 有效）" }),
			),
		}),
		async execute(
			_toolCallId: string,
			params: {
				roadmapId: string;
				item_id: string;
				status?: string;
				title?: string;
				description?: string;
				priority?: string;
				note?: string;
				planPath?: string;
				dependsOn?: string[];
				archive?: boolean;
			},
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			_ctx: unknown,
		) {
			// ── 归档操作 ──
			if (params.archive) {
				const result = atomicUpdate(params.roadmapId, (rm) => {
					// item_id 为空 → 归档所有已完成 Epic
					if (!params.item_id || params.item_id === "all") {
						return _archiveAllDone(rm).result;
					}
					return _archiveEpic(rm, params.item_id).result;
				});
				return {
					content: [{ type: "text" as const, text: result }],
					details: {},
				};
			}

			// ── Done 操作（带级联 + doing 清理） ──
			if (params.status === "done") {
				const parts = params.item_id.split(".");
				// 只有 Task 做 done 级联
				if (parts.length === 3) {
					return handleTaskDone(params.roadmapId, params.item_id, params.note, _ctx);
				}
				// Epic/Story 的 done 走普通 update
			}

			// ── 普通属性更新 ──
			const sessionId = getSessionId(_ctx);
			const updates: Record<string, string | string[]> = {};
			if (params.title !== undefined) updates.title = params.title;
			if (params.description !== undefined)
				updates.description = params.description;
			if (params.priority !== undefined) updates.priority = params.priority;
			if (params.note !== undefined) updates.note = params.note;
			if (params.planPath !== undefined) updates.planPath = params.planPath;
			if (params.dependsOn !== undefined) updates.dependsOn = params.dependsOn;
			if (params.status !== undefined) updates.status = params.status;

			if (Object.keys(updates).length === 0) {
				return {
					content: [
						{
							type: "text" as const,
							text: "没有指定任何要更新的字段。",
						},
					],
					details: {},
				};
			}

			const result = atomicUpdate(params.roadmapId, (rm) => {
				const parts = params.item_id.split(".");
				const epicId = parts[0];
				const epic = rm.epics.find((e) => e.id === epicId);
				if (!epic) return `错误：Epic "${epicId}" 不存在。`;

				if (parts.length === 1) {
					return updateItem(rm, epic, updates, sessionId);
				}

				const storyId = `${parts[0]}.${parts[1]}`;
				const story = epic.stories.find((s) => s.id === storyId);
				if (!story) return `错误：Story "${storyId}" 不存在。`;

				if (parts.length === 2) {
					return updateItem(rm, story, updates, sessionId);
				}

				const taskId = params.item_id;
				const task = story.tasks.find((t) => t.id === taskId);
				if (!task) return `错误：Task "${taskId}" 不存在。`;
				return updateTask(rm, task, updates, sessionId);
			});

			return {
				content: [{ type: "text" as const, text: result }],
				details: {},
			};
		},
	});
}

/** Task done 处理（带级联 + doing 清理） */
function handleTaskDone(
	roadmapId: string,
	taskId: string,
	note: string | undefined,
	_ctx: unknown,
) {
	const filePath = getRoadmapFilePath(roadmapId);
	if (!filePath || !existsSync(filePath)) {
		return {
			content: [
				{ type: "text" as const, text: `路线图 "${roadmapId}" 不存在。` },
			],
			details: {},
		};
	}

	const roadmap = readRoadmap(filePath);
	if (!roadmap) {
		return {
			content: [
				{ type: "text" as const, text: `路线图 "${roadmapId}" 读取失败。` },
			],
			details: {},
		};
	}

	const sessionId = getSessionId(_ctx);
	const { result: doneResult } = _markTaskDone(roadmap, taskId, sessionId);

	if (doneResult.includes("错误")) {
		return {
			content: [{ type: "text" as const, text: doneResult }],
			details: {},
		};
	}

	// 补充 note
	if (note) {
		for (const epic of roadmap.epics) {
			for (const story of epic.stories) {
				const task = story.tasks.find((t) => t.id === taskId);
				if (task) {
					task.note = note;
					break;
				}
			}
		}
	}

	roadmap.meta.updated = new Date().toISOString().slice(0, 10);
	writeRoadmap(filePath, roadmap);
	clearDoing(roadmapId, taskId);

	return {
		content: [
			{
				type: "text" as const,
				text: `✅ 任务 "${taskId}" 已标记完成。`,
			},
		],
		details: {},
	};
}
