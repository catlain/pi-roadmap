/**
 * Roadmap 搜索工具注册
 *
 * 将 registerSearchTool 从 tools-query.ts 拆出，保持文件 < 200 行
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
	filterByProject,
	listRoadmapFiles,
	readRoadmap,
} from "./store";
import type { RoadmapFile } from "./types";
import { searchRoadmapData } from "./tools-query-search";

export function registerSearchTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_search",
		label: "Roadmap Search",
		description:
			"搜索路线图内容。根据关键词在所有路线图的 Epic/Story/Task 中搜索 title 和 description，返回匹配项的完整详情（含子级上下文）。支持 scope 指定搜索层级。",
		parameters: Type.Object({
			query: Type.String({ description: "搜索关键词（大小写不敏感）" }),
			scope: Type.Optional(
				Type.String({
					description: "搜索范围: epic/story/task/all，默认 all",
				}),
			),
			include_archived: Type.Optional(
				Type.Boolean({ description: "是否包含已归档项，默认 false" }),
			),
		}),
		async execute(
			_toolCallId: string,
			params: {
				query: string;
				scope?: string;
				include_archived?: boolean;
			},
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			_ctx: unknown,
		) {
			const trimmed = params.query.trim();
			if (!trimmed) {
				return {
					content: [
						{
							type: "text" as const,
							text: "请输入搜索关键词。",
						},
					],
					details: {},
				};
			}

			const validScopes = ["epic", "story", "task", "all"];
			const scope = validScopes.includes(params.scope ?? "")
				? (params.scope as "epic" | "story" | "task" | "all")
				: "all";

			const roadmaps = listRoadmapFiles()
				.map((fp) => readRoadmap(fp))
				.filter((r): r is RoadmapFile => r !== null)
				.map((rm) => filterByProject(rm, process.cwd()));

			const results = searchRoadmapData(roadmaps, trimmed, {
				scope,
				includeArchived: params.include_archived ?? false,
			});

			if (results.length === 0) {
				return {
					content: [
						{
							type: "text" as const,
							text: `未找到匹配 "${trimmed}" 的路线图内容。`,
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
						`---\n[${r.roadmapTitle}] ${scopeLabel} ${r.matchedId}: ${r.matchedTitle}\n\n` +
						r.detail
					);
				})
				.join("\n");

			const header = `搜索 "${trimmed}" (scope: ${scope}) — 找到 ${results.length} 条结果\n\n`;

			return {
				content: [{ type: "text" as const, text: header + text }],
				details: {},
			};
		},
	});
}
