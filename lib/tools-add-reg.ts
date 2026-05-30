/**
 * Roadmap 工具 — roadmap_add（合并 add_epic + add_story + add_task + create）
 *
 * 统一入口：按 item_type 区分操作类型
 * - epic: 自动创建 roadmap（如不存在）+ 添加 Epic
 * - story: 添加 Story
 * - task: 添加 Task
 *
 * Epic/Story 强制要求 planPath，Task 不强制
 */

import { existsSync } from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { writeRoadmap } from "./store";
import {
	addEpic as _addEpic,
	addStory as _addStory,
	addTask as _addTask,
	createRoadmap as _createRoadmap,
} from "./tools-atomic-logic";
import { atomicUpdate, getOrCreateRoadmap } from "./tools-atomic-utils";
import type { Priority } from "./types";
import { FILE_SUFFIX, GLOBAL_ROADMAP_DIR } from "./types";

export function registerAddTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_add",
		label: "Roadmap Add",
		description:
			"向路线图添加 Epic/Story/Task。Epic/Story 必须关联计划文档（planPath），Task 可选。" +
			"如果目标路线图不存在，添加 Epic 时会自动创建。" +
			"⚠ 添加前必须确认信息充分——如果不确定要做什么，先向用户追问确认。",
		parameters: Type.Object({
			roadmapId: Type.String({ description: "路线图 ID" }),
			item_type: Type.String({
				description: "添加类型: epic / story / task",
			}),
			// Epic 参数
			title: Type.String({ description: "标题" }),
			description: Type.Optional(Type.String({ description: "描述" })),
			priority: Type.Optional(
				Type.String({ description: "优先级: high/medium/low" }),
			),
			project: Type.Optional(
				Type.String({ description: "项目路径（epic 必填）" }),
			),
			epic_id: Type.Optional(
				Type.String({ description: "Epic ID（story/task 必填，如 E1）" }),
			),
			story_id: Type.Optional(
				Type.String({ description: "Story ID（task 必填，如 E1.S1）" }),
			),
			dependsOn: Type.Optional(
				Type.Array(Type.String(), { description: "依赖的其他项 ID 列表" }),
			),
			planPath: Type.Optional(
				Type.String({ description: "计划文档文件名（Epic/Story 必填，Task 可选）" }),
			),
		}),
		async execute(
			_tc: string,
			params: {
				roadmapId: string;
				item_type: string;
				title: string;
				description?: string;
				priority?: string;
				project?: string;
				epic_id?: string;
				story_id?: string;
				dependsOn?: string[];
				planPath?: string;
			},
		) {
			const itemType = params.item_type.toLowerCase();

			if (itemType === "epic") {
				// Epic: roadmap 不存在则自动创建
				const rmPath = path.join(
					GLOBAL_ROADMAP_DIR,
					`${params.roadmapId}${FILE_SUFFIX}`,
				);
				if (!existsSync(rmPath)) {
					const rm = _createRoadmap(params.roadmapId, params.roadmapId);
					writeRoadmap(rmPath, rm);
				}

				const result = atomicUpdate(params.roadmapId, (rm) => {
					return _addEpic(
						rm,
						params.title,
						params.description ?? "",
						params.priority as Priority | undefined,
						params.project ?? process.cwd(),
						params.planPath,
					).result;
				});
				return {
					content: [{ type: "text" as const, text: result }],
					details: {},
				};
			}

			if (itemType === "story") {
				if (!params.epic_id) {
					return {
						content: [
							{
								type: "text" as const,
								text: "添加 Story 必须指定 epic_id（如 E1）。",
							},
						],
						details: {},
					};
				}
				const result = atomicUpdate(params.roadmapId, (rm) => {
					return _addStory(
						rm,
						params.epic_id!,
						params.title,
						params.description ?? "",
						params.dependsOn,
						params.planPath,
					).result;
				});
				return {
					content: [{ type: "text" as const, text: result }],
					details: {},
				};
			}

			if (itemType === "task") {
				if (!params.story_id) {
					return {
						content: [
							{
								type: "text" as const,
								text: "添加 Task 必须指定 story_id（如 E1.S1）。",
							},
						],
						details: {},
					};
				}
				const result = atomicUpdate(params.roadmapId, (rm) => {
					return _addTask(
						rm,
						params.story_id!,
						params.title,
						params.priority as Priority | undefined,
						params.dependsOn,
						params.planPath,
					).result;
				});
				return {
					content: [{ type: "text" as const, text: result }],
					details: {},
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `未知的 item_type: "${params.item_type}"。支持: epic / story / task。`,
					},
				],
				details: {},
			};
		},
	});
}
