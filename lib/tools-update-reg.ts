/**
 * Roadmap 工具 — roadmap_update（合并 update + done + archive + move）
 *
 * 统一操作入口：
 * - 更新属性（title/description/priority/note/planPath/dependsOn）
 * - 标记完成（status=done，支持级联）
 * - 归档（archive=true）
 * - 移动（move_to，Task 跨 Story / Story 跨 Epic）
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import type { RoadmapStatus } from "./types";
import {
	archiveAllDone as _archiveAllDone,
	archiveEpic as _archiveEpic,
} from "./tools-atomic-logic";
import { handleTaskDone } from "./tools-atomic-logic-done";
import { moveItem } from "./tools-atomic-logic-move";
import { archiveRoadmap, readRoadmapById, writeRoadmapById } from "./store";
import {
	atomicUpdate,
	getSessionId,
	updateItem,
	updateTask,
} from "./tools-atomic-utils";

export function registerUpdateTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_update",
		label: "Roadmap Update",
		description:
			"更新路线图中的 Epic/Story/Task。支持：属性更新（title/description 等）、" +
			"标记完成（status=done）、归档（archive=true）。" +
			"Task 标记 done 时自动级联检查 Story/Epic 是否全部完成。\n" +
			"特殊用法：item_id 等于 roadmapId 时，更新整个路线图的 status（如 completed/archived）。" +
			"status=archived 会将文件移入 archive 目录。",
		parameters: Type.Object({
			roadmapId: Type.String({ description: "路线图 ID" }),
			item_id: Type.String({
				description:
					"项目 ID，如 E1、E1.S2、E1.S1.T3。" +
					"传 roadmapId 本身（或 \"*\"）可更新整个路线图的 status。",
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
			planPath: Type.Optional(Type.String({ description: "计划文档文件名" })),
			dependsOn: Type.Optional(
				Type.Array(Type.String(), { description: "依赖项 ID 列表" }),
			),
			archive: Type.Optional(
				Type.Boolean({ description: "归档该 Epic（仅 Epic 有效）" }),
			),
			move_to: Type.Optional(
				Type.String({
					description:
						"将 Task/Story 移动到新容器。Task → Story（如 E1.S2），Story → Epic（如 E2）。移动后路径自动重建，依赖引用（eid）不受影响。",
				}),
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
			// ── Roadmap 级别更新 ──
			if (
				params.item_id === params.roadmapId ||
				params.item_id === "*"
			) {
				return handleRoadmapLevelUpdate(params);
			}

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

			// ── Move 操作 ──
			if (params.move_to) {
				const result = atomicUpdate(params.roadmapId, (rm) => {
					return moveItem(rm, params.item_id, params.move_to!);
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
					return handleTaskDone(
						params.roadmapId,
						params.item_id,
						params.note,
						_ctx,
					);
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
			if (params.move_to !== undefined) updates.move_to = params.move_to;

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

const VALID_ROADMAP_STATUSES = new Set<string>([
	"active",
	"paused",
	"completed",
	"archived",
]);

/** 处理 roadmap 级别的 status 更新 */
function handleRoadmapLevelUpdate(params: {
	roadmapId: string;
	item_id: string;
	status?: string;
	title?: string;
	description?: string;
}) {
	// 归档操作：移动文件到 archive 目录
	if (params.status === "archived") {
		const ok = archiveRoadmap(params.roadmapId);
		if (!ok) {
			return {
				content: [
					{
						type: "text" as const,
						text: `错误：路线图 "${params.roadmapId}" 不存在。`,
					},
				],
				details: {},
			};
		}
		return {
			content: [
				{
					type: "text" as const,
					text: `✅ 路线图 "${params.roadmapId}" 已归档。`,
				},
			],
			details: {},
		};
	}

	// 校验 status 合法性
	if (params.status && !VALID_ROADMAP_STATUSES.has(params.status)) {
		return {
			content: [
				{
					type: "text" as const,
					text: `错误：status 必须是 ${[...VALID_ROADMAP_STATUSES].join("/")} 之一。`,
				},
			],
			details: {},
		};
	}

	// 先检查有没有字段可改
	const hasStatus = !!params.status;
	const hasTitle = !!params.title;
	if (!hasStatus && !hasTitle) {
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

	const rm = readRoadmapById(params.roadmapId);
	if (!rm) {
		return {
			content: [
				{
					type: "text" as const,
					text: `错误：路线图 "${params.roadmapId}" 不存在。`,
				},
			],
			details: {},
		};
	}

	let changed = false;
	if (params.status) {
		rm.meta.status = params.status as RoadmapStatus;
		changed = true;
	}
	if (params.title) {
		rm.meta.title = params.title;
		changed = true;
	}

	if (!changed) {
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

	writeRoadmapById(params.roadmapId, rm);

	return {
		content: [
			{
				type: "text" as const,
					text: `✅ 路线图 "${params.roadmapId}" 已更新（status=${rm.meta.status}）。`,
			},
		],
		details: {},
	};
}
