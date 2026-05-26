/**
 * Roadmap 增量操作 — 创建工具（create / add_epic / add_story / add_task）
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
import { atomicUpdate } from "./tools-atomic-utils";
import type { Priority } from "./types";
import { FILE_SUFFIX, GLOBAL_ROADMAP_DIR } from "./types";

export function registerCreateTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_create",
		label: "Roadmap Create",
		description:
			"创建新路线图。只需提供 meta 信息，后续用 roadmap_add_epic 等添加内容。",
		parameters: Type.Object({
			roadmapId: Type.String({ description: "路线图 ID（slug 格式）" }),
			title: Type.String({ description: "路线图中文标题" }),
			tags: Type.Optional(Type.Array(Type.String(), { description: "标签" })),
		}),
		async execute(
			_tc: string,
			params: { roadmapId: string; title: string; tags?: string[] },
		) {
			const newPath = path.join(
				GLOBAL_ROADMAP_DIR,
				`${params.roadmapId}${FILE_SUFFIX}`,
			);
			if (existsSync(newPath)) {
				return {
					content: [
						{
							type: "text" as const,
							text: `路线图 "${params.roadmapId}" 已存在。`,
						},
					],
					details: {},
				};
			}
			const rm = _createRoadmap(params.roadmapId, params.title, params.tags);
			writeRoadmap(newPath, rm);
			return {
				content: [
					{
						type: "text" as const,
						text: `✅ 路线图 "${params.title}" (${params.roadmapId}) 已创建。`,
					},
				],
				details: {},
			};
		},
	});
}

export function registerAddEpicTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_add_epic",
		label: "Roadmap Add Epic",
		description: "向指定路线图添加一个 Epic。自动分配 ID 和 createdDate。",
		parameters: Type.Object({
			roadmapId: Type.String({ description: "路线图 ID" }),
			title: Type.String({ description: "Epic 标题（动词开头）" }),
			description: Type.String({ description: "Epic 描述" }),
			priority: Type.Optional(
				Type.String({ description: "优先级: high/medium/low" }),
			),
			project: Type.String({ description: "对应项目路径" }),
		}),
		async execute(
			_tc: string,
			params: {
				roadmapId: string;
				title: string;
				description: string;
				priority?: string;
				project: string;
			},
		) {
			const result = atomicUpdate(params.roadmapId, (rm) => {
				return _addEpic(
					rm,
					params.title,
					params.description,
					params.priority as Priority | undefined,
					params.project,
				).result;
			});
			return {
				content: [{ type: "text" as const, text: result }],
				details: {},
			};
		},
	});
}

export function registerAddStoryTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_add_story",
		label: "Roadmap Add Story",
		description: "向指定 Epic 添加一个 Story。自动分配 ID 和 createdDate。",
		parameters: Type.Object({
			roadmapId: Type.String({ description: "路线图 ID" }),
			epic_id: Type.String({ description: "Epic ID，如 E1" }),
			title: Type.String({ description: "Story 标题" }),
			description: Type.String({ description: "Story 描述" }),
		}),
		async execute(
			_tc: string,
			params: {
				roadmapId: string;
				epic_id: string;
				title: string;
				description: string;
			},
		) {
			const result = atomicUpdate(params.roadmapId, (rm) => {
				return _addStory(rm, params.epic_id, params.title, params.description)
					.result;
			});
			return {
				content: [{ type: "text" as const, text: result }],
				details: {},
			};
		},
	});
}

export function registerAddTaskTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_add_task",
		label: "Roadmap Add Task",
		description: "向指定 Story 添加一个 Task。自动分配 ID 和 createdDate。",
		parameters: Type.Object({
			roadmapId: Type.String({ description: "路线图 ID" }),
			story_id: Type.String({ description: "Story ID，如 E1.S1" }),
			title: Type.String({ description: "Task 标题（动词开头）" }),
			priority: Type.Optional(
				Type.String({ description: "优先级: high/medium/low" }),
			),
		}),
		async execute(
			_tc: string,
			params: {
				roadmapId: string;
				story_id: string;
				title: string;
				priority?: string;
			},
		) {
			const result = atomicUpdate(params.roadmapId, (rm) => {
				return _addTask(
					rm,
					params.story_id,
					params.title,
					params.priority as Priority | undefined,
				).result;
			});
			return {
				content: [{ type: "text" as const, text: result }],
				details: {},
			};
		},
	});
}
