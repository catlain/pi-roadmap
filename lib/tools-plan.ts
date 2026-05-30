/**
 * Roadmap 工具 — plan（创建/更新路线图）
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { syncDoingChanges } from "./doing-sync";
import { getRoadmapFilePath, readRoadmap, writeRoadmap } from "./store";
import { resolveAbsolutePath } from "./plan-resolver";
import type { Epic, RoadmapFile } from "./types";
import { GLOBAL_ROADMAP_DIR } from "./types";
import { validateRoadmap } from "./validator";

/**
 * 扫描 roadmap 中所有 planPath，返回不存在的文件路径列表
 * 使用第一个非空 project 作为解析上下文
 */
export function scanPlanPaths(roadmap: RoadmapFile): string[] {
	const missing: string[] = [];

	// 找一个有效的 project 路径用于解析
	const firstProject = roadmap.epics.find(e => e.project)?.project;

	for (const epic of roadmap.epics) {
		const project = epic.project || firstProject;
		const ctx = { project, roadmapId: roadmap.meta.id };

		if (epic.planPath) {
			const absPath = resolveAbsolutePath(epic.planPath, ctx);
			if (!fs.existsSync(absPath)) {
				missing.push(`${epic.planPath} (${epic.id}: ${epic.title})`);
			}
		}

		for (const story of epic.stories) {
			if (story.planPath) {
				const absPath = resolveAbsolutePath(story.planPath, ctx);
				if (!fs.existsSync(absPath)) {
					missing.push(`${story.planPath} (${story.id}: ${story.title})`);
				}
			}

			for (const task of story.tasks) {
				if (task.planPath) {
					const absPath = resolveAbsolutePath(task.planPath, ctx);
					if (!fs.existsSync(absPath)) {
						missing.push(`${task.planPath} (${task.id}: ${task.title})`);
					}
				}
			}
		}
	}

	return missing;
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
			"创建或更新路线图。从讨论中提炼意图，拆解为 Epic→Story→Task。",
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
			const { roadmapId, action } = params;
			let { content } = params;

			// 获取当前会话 ID
			const ctx = _ctx as any;
			const sessionId: string | undefined =
				ctx?.sessionManager
					?.getSessionFile?.()
					?.split("/")
					.pop()
					?.replace(/\.jsonl$/, "") ?? undefined;

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

			roadmap.meta.updated = new Date().toISOString().slice(0, 10);
			fs.mkdirSync(GLOBAL_ROADMAP_DIR, { recursive: true });

			// planPath 格式验证
			const validation = validateRoadmap(roadmap);
			const planPathErrors = validation.errors.filter((e: string) => e.includes("planPath"));
			if (planPathErrors.length > 0) {
				return {
					content: [{
						type: "text" as const,
						text: `⚠️ 计划文档路径格式错误：\n${planPathErrors.join("\n")}`,
					}],
					details: {},
				};
			}

			const filePath = getRoadmapFilePath(roadmapId);

			// update 时：检测 task status 变迁 → 同步 doing.json
			if (action === "update") {
				const oldRoadmap = readRoadmap(filePath);
				if (oldRoadmap) {
					syncDoingChanges(oldRoadmap, roadmap, sessionId);
				}
			}

			writeRoadmap(filePath, roadmap);

			// 扫描 planPath 列表，检查文件是否存在
			const planPathWarnings = scanPlanPaths(roadmap);

			const actionLabel = action === "create" ? "创建" : "更新";
			let text = `路线图 "${roadmap.meta.title}" 已${actionLabel}。`;
			if (planPathWarnings.length > 0) {
				text += `\n\n⚠️ 以下计划文档尚未创建，请用 write 创建后再设置 planPath：\n${planPathWarnings.map(p => `  - ${p}`).join("\n")}`;
			}
			return { content: [{ type: "text" as const, text }], details: {} };
		},
	});
}
