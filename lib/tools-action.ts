/**
 * Roadmap 工具 — next（获取可推进任务）+ done（标记完成）
 */

import { existsSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { clearDoing } from "./doing-store";
import { getNextTasks } from "./progress";
import {
	getRoadmapFilePath,
	listRoadmapFiles,
	readRoadmap,
	writeRoadmap,
} from "./store";
import { syncToProject, writeProjectRoadmap } from "./sync";
import { markTaskDone as _markTaskDone } from "./tools-atomic-logic";
import type { RoadmapFile } from "./types";
import { GLOBAL_ROADMAP_DIR } from "./types";

export function registerNextTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_next",
		label: "Roadmap Next",
		description:
			"获取当前可推进的任务列表。按优先级排序，doing 优先于 todo，high 优先于 medium/low。",
		parameters: Type.Object({
			roadmapId: Type.Optional(
				Type.String({ description: "指定路线图 ID，不填则查所有活跃路线图" }),
			),
			limit: Type.Optional(
				Type.Number({ description: "最多返回几个任务，默认 5" }),
			),
		}),
		async execute(
			_toolCallId: string,
			params: { roadmapId?: string; limit?: number },
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			_ctx: unknown,
		) {
			const { limit = 5 } = params;

			let roadmaps: RoadmapFile[];
			if (params.roadmapId) {
				const rm = readRoadmap(getRoadmapFilePath(params.roadmapId));
				if (!rm) {
					return {
						content: [
							{
								type: "text" as const,
								text: `路线图 "${params.roadmapId}" 不存在。`,
							},
						],
						details: {},
					};
				}
				roadmaps = [rm];
			} else {
				roadmaps = listRoadmapFiles()
					.map((fp) => readRoadmap(fp))
					.filter((r): r is RoadmapFile => r !== null)
					.filter((r: RoadmapFile) => r.meta.status === "active");
			}

			if (roadmaps.length === 0) {
				return {
					content: [{ type: "text" as const, text: "没有活跃的路线图。" }],
					details: {},
				};
			}

			const allNext = roadmaps
				.map((rm: RoadmapFile) => ({
					roadmap: rm,
					tasks: getNextTasks(rm, limit),
				}))
				.filter((item) => item.tasks.length > 0);

			if (allNext.length === 0) {
				return {
					content: [{ type: "text" as const, text: "当前没有待推进的任务。" }],
					details: {},
				};
			}

			const text = allNext
				.map((item) => {
					const header = `## ${item.roadmap.meta.title}`;
					const taskList = item.tasks
						.map(
							(t) =>
								`- [${t.status}] ${t.id}: ${t.title} (Epic: ${t.epicTitle})${t.doingSessionId ? ` [会话 ${t.doingSessionId} 执行中]` : ""}`,
						)
						.join("\n");
					return `${header}\n${taskList}`;
				})
				.join("\n\n");

			return { content: [{ type: "text" as const, text }], details: {} };
		},
	});
}

export function registerDoneTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_done",
		label: "Roadmap Done",
		description:
			"标记路线图中的某个任务为完成。自动填 doneDate、doneBySessionId，级联更新 Story/Epic 状态，同步到关联项目。",
		parameters: Type.Object({
			roadmapId: Type.String({ description: "路线图 ID" }),
			taskId: Type.String({ description: "任务 ID，如 E1.S1.T1" }),
			note: Type.Optional(Type.String({ description: "完成备注或产出链接" })),
		}),
		async execute(
			_toolCallId: string,
			params: { roadmapId: string; taskId: string; note?: string },
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			_ctx: unknown,
		) {
			const filePath = getRoadmapFilePath(params.roadmapId);
			if (!existsSync(filePath)) {
				return {
					content: [
						{
							type: "text" as const,
							text: `路线图 "${params.roadmapId}" 不存在。`,
						},
					],
					details: {},
				};
			}

			const roadmap = readRoadmap(filePath);
			if (!roadmap) {
				return {
					content: [
						{
							type: "text" as const,
							text: `路线图 "${params.roadmapId}" 读取失败。`,
						},
					],
					details: {},
				};
			}

			const sessionId =
				(_ctx as any)?.sessionManager
					?.getSessionFile?.()
					?.split("/")
					.pop()
					?.replace(/\.jsonl$/, "") ?? "unknown";

			const { result: doneResult, cascadeInfo } = _markTaskDone(
				roadmap,
				params.taskId,
				sessionId,
			);
			if (doneResult.includes("错误")) {
				return {
					content: [{ type: "text" as const, text: doneResult }],
					details: {},
				};
			}

			// 补充 note
			if (params.note) {
				for (const epic of roadmap.epics) {
					for (const story of epic.stories) {
						const task = story.tasks.find((t) => t.id === params.taskId);
						if (task) {
							task.note = params.note;
							break;
						}
					}
				}
			}

			roadmap.meta.updated = new Date().toISOString().slice(0, 10);
			writeRoadmap(filePath, roadmap);

			// 同步到关联项目
			const synced: string[] = [];
			for (const epic of roadmap.epics) {
				if (epic.project) {
					const projectData = syncToProject(roadmap, epic.project);
					if (projectData) {
						writeProjectRoadmap(epic.project, projectData);
						synced.push(epic.project);
					}
				}
			}

			// 清除 doing 标志
			clearDoing(params.roadmapId, params.taskId);

			let result = `✅ 任务 "${params.taskId}" 已标记完成。`;
			if (synced.length > 0) {
				result += `\n已同步到项目: ${synced.join(", ")}`;
			}
			return {
				content: [{ type: "text" as const, text: result }],
				details: {},
			};
		},
	});
}
