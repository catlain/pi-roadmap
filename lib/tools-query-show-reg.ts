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
			"查看路线图详情或搜索内容。不传 query 显示完整详情，传 query 搜索匹配的 Epic/Story/Task。" +
			"默认隐藏已完成和已归档项。可用 epic_id 查看指定 Epic。",
		parameters: Type.Object({
			roadmapId: Type.String({ description: "路线图 ID" }),
			epic_id: Type.Optional(
				Type.String({ description: "只查看指定 Epic，如 E1" }),
			),
			query: Type.Optional(
				Type.String({ description: "搜索关键词（大小写不敏感），匹配 title/description" }),
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
				query?: string;
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

			// 搜索模式
			if (params.query) {
				const { searchRoadmapData } = await import("./tools-query-search");
				const results = searchRoadmapData([roadmap], params.query, {
					includeArchived: showArchived,
				});
				if (results.length === 0) {
					return {
						content: [
							{
								type: "text" as const,
								text: `在路线图 "${params.roadmapId}" 中未找到匹配 "${params.query}" 的内容。`,
							},
						],
						details: {},
					};
				}
				const text = results
					.map((r) => {
						const scopeLabel =
							r.matchedType === "epic"
								? "Epic"
								: r.matchedType === "story"
									? "Story"
									: "Task";
						return (
							`---\n${scopeLabel} ${r.matchedId}: ${r.matchedTitle}\n\n` +
							r.detail
						);
					})
					.join("\n");
				const header = `搜索 "${params.query}" — 找到 ${results.length} 条结果\n\n`;
				return {
					content: [{ type: "text" as const, text: header + text }],
					details: {},
				};
			}

			// 普通展示模式
			return {
				content: [
					{
						type: "text" as const,
						text: formatRoadmapDetail(roadmap, {
							epicId: params.epic_id,
							showCompleted,
							showArchived,
							planPathCheck: { roadmapId: roadmap.meta.id, project: roadmap.epics[0]?.project },
						}),
					},
				],
				details: {},
			};
		},
	});
}
