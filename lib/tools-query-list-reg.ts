/**
 * Roadmap 工具 — list 注册
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { formatProgress, getOverview } from "./parser";
import { filterByProject, listRoadmapFiles, readRoadmap } from "./store";
import type { RoadmapFile } from "./types";
import { ARCHIVE_DIR, GLOBAL_ROADMAP_DIR } from "./types";

export function registerListTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_list",
		label: "Roadmap List",
		description:
			"列出所有路线图及进度概览。默认隐藏已完成和已归档的 Epic 详情，只显示统计行。",
		promptSnippet: "列出所有路线图及进度概览",
		parameters: Type.Object({
			status: Type.Optional(
				Type.String({
					description: "按状态过滤: active/paused/completed/archived",
				}),
			),
			tag: Type.Optional(Type.String({ description: "按标签过滤" })),
			show_completed: Type.Optional(
				Type.Boolean({
					description: "显示已完成 Epic 的详细 Story/Task，默认 false",
				}),
			),
			show_archived: Type.Optional(
				Type.Boolean({ description: "显示已归档的 Epic，默认 false" }),
			),
		}),
		async execute(
			_toolCallId: string,
			params: {
				status?: string;
				tag?: string;
				show_completed?: boolean;
				show_archived?: boolean;
			},
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			_ctx: unknown,
		) {
			const showCompleted = params.show_completed ?? false;
			const showArchived = params.show_archived ?? false;

			let roadmaps = listRoadmapFiles()
				.map((fp) => readRoadmap(fp))
				.filter((r): r is RoadmapFile => r !== null)
				.map((rm) => filterByProject(rm, process.cwd()));

			if (params.status === "archived") {
				const archiveDir = path.join(GLOBAL_ROADMAP_DIR, ARCHIVE_DIR);
				if (fs.existsSync(archiveDir)) {
					roadmaps = roadmaps.concat(
						fs
							.readdirSync(archiveDir)
							.filter((f) => f.endsWith(".roadmap.json"))
							.map((f) => readRoadmap(path.join(archiveDir, f)))
							.filter((r): r is RoadmapFile => r !== null),
					);
				}
			}

			if (params.status) {
				roadmaps = roadmaps.filter(
					(r: RoadmapFile) => r.meta.status === params.status,
				);
			}
			if (params.tag) {
				roadmaps = roadmaps.filter((r: RoadmapFile) =>
					r.meta.tags.includes(params.tag!),
				);
			}

			if (roadmaps.length === 0) {
				return {
					content: [
						{
							type: "text" as const,
							text: "没有找到路线图。使用 roadmap_create 创建新的路线图。",
						},
					],
					details: {},
				};
			}

			const text = roadmaps
				.map((rm: RoadmapFile) => {
					const overview = getOverview(rm);
					const bar = formatProgress(overview.percent);
					const epicLines = rm.epics
						.map((epic) => {
							// 跳过已归档
							if (epic.archived && !showArchived) return null;

							const storyCount = epic.stories.length;
							const taskCount = epic.stories.reduce(
								(sum, s) => sum + s.tasks.length,
								0,
							);
							const doneTasks = epic.stories.reduce(
								(sum, s) =>
									sum + s.tasks.filter((t) => t.status === "done").length,
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
							const planTag = epic.planPath ? ` | 计划: ${epic.planPath}` : "";
							return (
								`  ${epic.id} [${epic.status}/${epic.priority}] ${epic.title}${archiveTag}${planTag}\n` +
								`    Stories: ${storyCount} | Tasks: ${doneTasks}/${taskCount}`
							);
						})
						.filter(Boolean)
						.join("\n");

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
