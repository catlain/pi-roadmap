/**
 * Roadmap 工具 — plan（讨论沙盘推演，不写入数据）
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import type { RoadmapFile } from "./types";
import { validateRoadmap } from "./validator";

/**
 * 格式化 plan 输出：拆解结果 + 下一步 add 操作指南
 */
export function formatPlanOutput(
	roadmap: RoadmapFile,
	action: "create" | "update",
): string {
	const lines: string[] = [];
	const actionLabel = action === "create" ? "新建" : "更新";

	lines.push(`📋 路线图拆解方案："${roadmap.meta.title}" (${actionLabel})`);
	lines.push("━".repeat(40));
	lines.push("");

	for (const epic of roadmap.epics) {
		lines.push(`Epic ${epic.id}: ${epic.title} [${epic.priority ?? "medium"}]`);
		if (epic.description) lines.push(`  ${epic.description}`);
		lines.push("");

		for (const story of epic.stories) {
			lines.push(`  Story ${story.id}: ${story.title}`);
			if (story.description) lines.push(`    ${story.description}`);
			lines.push("");

			for (const task of story.tasks) {
				lines.push(`    Task ${task.id}: ${task.title}`);
			}
			if (story.tasks.length > 0) lines.push("");
		}
	}

	// 下一步操作指南
	lines.push("━".repeat(40));
	lines.push("📌 下一步：逐个创建计划文档，然后用 roadmap_add 写入");
	lines.push("");

	let stepNum = 1;
	for (const epic of roadmap.epics) {
		// Epic 需要计划文档
		lines.push(
			`${stepNum}. write .pi/plans/${epic.id}.md → roadmap_add(roadmapId, item_type="epic", title="${epic.title}", planPath="${epic.id}.md")`,
		);
		stepNum++;

		for (const story of epic.stories) {
			// Story 需要计划文档
			const storyPlanFile = `${story.id.replace(".", "-S")}.md`;
			lines.push(
				`${stepNum}. write .pi/plans/${storyPlanFile} → roadmap_add(roadmapId, item_type="story", epic_id="${epic.id}", title="${story.title}", planPath="${storyPlanFile}")`,
			);
			stepNum++;

			for (const task of story.tasks) {
				// Task 不强制计划文档
				lines.push(
					`${stepNum}. roadmap_add(roadmapId, item_type="task", story_id="${story.id}", title="${task.title}")`,
				);
				stepNum++;
			}
		}
	}

	return lines.join("\n");
}

/** 加载单个提示词文件 */
function loadPrompt(filename: string): string {
	const promptsDir = path.join(__dirname, "..", "prompts");
	const filePath = path.join(promptsDir, filename);
	if (!fs.existsSync(filePath)) return "";
	return fs.readFileSync(filePath, "utf-8").trim();
}

/** 按顺序加载并拼接多个提示词文件 */
function loadPrompts(filenames: string[]): string {
	return filenames
		.map((f) => loadPrompt(f))
		.filter(Boolean)
		.join("\n\n");
}

export function registerPlanTool(pi: ExtensionAPI) {
	const planDescription = loadPrompts([
		"plan-description.md",
		"plan-output-format.md",
	]);

	pi.registerTool({
		name: "roadmap_plan",
		label: "Roadmap Plan",
		description:
			planDescription ||
			"路线图拆解沙盘。讨论结论拆解为 Epic→Story→Task 结构，输出拆解方案和下一步操作指南。不写入数据，AI 需用 add_epic/add_story/add_task 逐个写入。",
		promptSnippet: "路线图拆解沙盘（不写入数据）",
		parameters: Type.Object({
			roadmapId: Type.String({
				description: "路线图 ID（slug 格式，如 pi-atelier-split）",
			}),
			content: Type.Any({ description: "完整的 roadmap JSON 对象" }),
			action: Type.Union([Type.Literal("create"), Type.Literal("update")], {
				description: "create=新建，update=更新已有",
			}),
		}),
		async execute(
			_toolCallId: string,
			params: {
				roadmapId: string;
				content: unknown;
				action: "create" | "update";
			},
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			_ctx: unknown,
		) {
			const { action } = params;
			let { content } = params;

			// 兼容 LLM 传字符串的情况
			if (typeof content === "string") {
				try {
					content = JSON.parse(content);
				} catch {
					/* fallback below */
				}
			}

			if (!content || typeof content !== "object") {
				return {
					content: [
						{
							type: "text" as const,
							text: "错误：content 必须是有效的 JSON 对象。",
						},
					],
					details: {},
				};
			}

			const roadmap = content as RoadmapFile;

			if (!roadmap.meta?.id || !roadmap.meta?.title) {
				return {
					content: [
						{
							type: "text" as const,
							text: "错误：meta.id 和 meta.title 必填。",
						},
					],
					details: {},
				};
			}

			// planPath 格式验证
			const validation = validateRoadmap(roadmap);
			const planPathErrors = validation.errors.filter((e: string) =>
				e.includes("planPath"),
			);
			if (planPathErrors.length > 0) {
				return {
					content: [
						{
							type: "text" as const,
							text: `⚠️ 计划文档路径格式错误：\n${planPathErrors.join("\n")}`,
						},
					],
					details: {},
				};
			}

			// plan 是讨论沙盘，不写入 roadmap JSON
			// 格式化输出拆解结果，AI 用 add_epic/add_story/add_task 逐个写入
			const text = formatPlanOutput(roadmap, action);

			return { content: [{ type: "text" as const, text }], details: {} };
		},
	});
}
