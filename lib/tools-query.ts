/**
 * Roadmap 工具 — list + show
 *
 * 支持过滤：show_completed、show_archived、epic_id
 * 支持时间戳显示：createdDate、doingDate、doneDate、sessionId
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import * as fs from "node:fs";
import * as path from "node:path";
import type { RoadmapFile } from "./types";
import { GLOBAL_ROADMAP_DIR, ARCHIVE_DIR } from "./types";
import { listRoadmapFiles, readRoadmap, getRoadmapFilePath } from "./store";
import { getOverview, formatProgress } from "./parser";
export { formatTimestamps, formatRoadmapDetail, getLatestActivityDate } from "./tools-query-format";
import { formatRoadmapDetail, getLatestActivityDate } from "./tools-query-format";

export function registerListTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_list",
		label: "Roadmap List",
		description: "列出所有路线图及进度概览。默认隐藏已完成和已归档的 Epic 详情，只显示统计行。",
		parameters: Type.Object({
			status: Type.Optional(
				Type.String({ description: "按状态过滤: active/paused/completed/archived" }),
			),
			tag: Type.Optional(Type.String({ description: "按标签过滤" })),
			show_completed: Type.Optional(
				Type.Boolean({ description: "显示已完成 Epic 的详细 Story/Task，默认 false" }),
			),
			show_archived: Type.Optional(
				Type.Boolean({ description: "显示已归档的 Epic，默认 false" }),
			),
		}),
		async execute(
			_toolCallId: string,
			params: { status?: string; tag?: string; show_completed?: boolean; show_archived?: boolean },
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			_ctx: unknown,
		) {
			const showCompleted = params.show_completed ?? false;
			const showArchived = params.show_archived ?? false;

			let roadmaps = listRoadmapFiles()
				.map((fp) => readRoadmap(fp))
				.filter((r): r is RoadmapFile => r !== null);

			if (params.status === "archived") {
				const archiveDir = path.join(GLOBAL_ROADMAP_DIR, ARCHIVE_DIR);
				if (fs.existsSync(archiveDir)) {
					roadmaps = roadmaps.concat(
						fs.readdirSync(archiveDir)
							.filter((f) => f.endsWith(".roadmap.json"))
							.map((f) => readRoadmap(path.join(archiveDir, f)))
							.filter((r): r is RoadmapFile => r !== null),
					);
				}
			}

			if (params.status) {
				roadmaps = roadmaps.filter((r: RoadmapFile) => r.meta.status === params.status);
			}
			if (params.tag) {
				roadmaps = roadmaps.filter((r: RoadmapFile) => r.meta.tags.includes(params.tag!));
			}

			if (roadmaps.length === 0) {
				return { content: [{ type: "text" as const, text: "没有找到路线图。使用 roadmap_create 创建新的路线图。" }], details: {} };
			}

			const text = roadmaps
				.map((rm: RoadmapFile) => {
					const overview = getOverview(rm);
					const bar = formatProgress(overview.percent);
					const epicLines = rm.epics.map((epic) => {
						// 跳过已归档
						if (epic.archived && !showArchived) return null;

						const storyCount = epic.stories.length;
						const taskCount = epic.stories.reduce((sum, s) => sum + s.tasks.length, 0);
						const doneTasks = epic.stories.reduce(
							(sum, s) => sum + s.tasks.filter((t) => t.status === "done").length,
							0,
						);
						const isComplete = doneTasks === taskCount && taskCount > 0;
						const isArchived = epic.archived ?? false;

						// 已完成且不要求显示详情 → 折叠为统计行
						if (isComplete && !showCompleted) {
							const archiveTag = isArchived ? " 📦" : "";
							return `  ✅ ${epic.id}: ${epic.title} [${doneTasks}/${taskCount}]${archiveTag}`;
						}

						const archiveTag = isArchived ? " 📦" : "";
						return (
							`  ${epic.id} [${epic.status}/${epic.priority}] ${epic.title}${archiveTag}\n` +
							`    Stories: ${storyCount} | Tasks: ${doneTasks}/${taskCount}`
						);
					}).filter(Boolean).join("\n");

					return (
						`### ${overview.title} (${overview.status}) ${bar} ${overview.percent}%\n` +
						`ID: ${overview.id} | Tags: ${overview.tags.join(", ") || "无"}\n` +
						epicLines
					);
				})
				.join("\n\n");

			return { content: [{ type: "text" as const, text }], details: {} };
		},
	});
}

export function registerShowTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_show",
		label: "Roadmap Show",
		description: "查看某个路线图的详情。默认隐藏已完成和已归档项。可用 epic_id 查看指定 Epic，show_completed/show_archived 控制显示。",
		parameters: Type.Object({
			roadmapId: Type.String({ description: "路线图 ID" }),
			epic_id: Type.Optional(Type.String({ description: "只查看指定 Epic，如 E1" })),
			show_completed: Type.Optional(Type.Boolean({ description: "显示已完成 Epic 详情，默认 true" })),
			show_archived: Type.Optional(Type.Boolean({ description: "显示已归档项，默认 false" })),
		}),
		async execute(
			_toolCallId: string,
			params: { roadmapId: string; epic_id?: string; show_completed?: boolean; show_archived?: boolean },
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			_ctx: unknown,
		) {
			const filePath = getRoadmapFilePath(params.roadmapId);
			if (!filePath) {
				return { content: [{ type: "text" as const, text: `路线图 "${params.roadmapId}" 不存在。` }], details: {} };
			}

			const roadmap = readRoadmap(filePath);
			if (!roadmap) {
				return { content: [{ type: "text" as const, text: `路线图 "${params.roadmapId}" 读取失败。` }], details: {} };
			}

			const showCompleted = params.show_completed ?? true;
			const showArchived = params.show_archived ?? false;
			return {
				content: [{
					type: "text" as const,
					text: formatRoadmapDetail(roadmap, {
						epicId: params.epic_id,
						showCompleted,
						showArchived,
					}),
				}],
				details: {},
			};
		},
	});
}

// 格式化函数已提取到 tools-query-format.ts（纯函数，无 typebox 依赖，方便测试）
