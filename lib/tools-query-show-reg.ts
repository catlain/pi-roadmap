/**
 * Roadmap 工具 — show 注册
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
	filterByProject,
	getRoadmapFilePath,
	readRoadmap,
} from "./store";
import { formatRoadmapDetail } from "./tools-query-format";

export function registerShowTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_show",
		label: "Roadmap Show",
		description:
			"查看某个路线图的详情。默认隐藏已完成和已归档项。可用 epic_id 查看指定 Epic，show_completed/show_archived 控制显示。",
		parameters: Type.Object({
			roadmapId: Type.String({ description: "路线图 ID" }),
			epic_id: Type.Optional(
				Type.String({ description: "只查看指定 Epic，如 E1" }),
			),
			show_completed: Type.Optional(
				Type.Boolean({ description: "显示已完成 Epic 详情，默认 true" }),
			),
			show_archived: Type.Optional(
				Type.Boolean({ description: "显示已归档项，默认 false" }),
			),
		}),
		async execute(
			_toolCallId: string,
			params: {
				roadmapId: string;
				epic_id?: string;
				show_completed?: boolean;
				show_archived?: boolean;
			},
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			_ctx: unknown,
		) {
			const filePath = getRoadmapFilePath(params.roadmapId);
			if (!filePath) {
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

			const data = readRoadmap(filePath);
			if (!data) {
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
			const roadmap = filterByProject(data, process.cwd());

			const showCompleted = params.show_completed ?? true;
			const showArchived = params.show_archived ?? false;
			return {
				content: [
					{
						type: "text" as const,
						text: formatRoadmapDetail(roadmap, {
							epicId: params.epic_id,
							showCompleted,
							showArchived,
						}),
					},
				],
				details: {},
			};
		},
	});
}
