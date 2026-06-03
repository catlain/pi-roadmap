/**
 * plan-resolver.ts — 计划文件路径解析、生成、验证
 *
 * 核心职责：
 * 1. 根据 item ID 生成计划文件名（E1.S3 → E1-S3.md）
 * 2. 根据上下文解析为绝对路径（项目级 or 全局级）
 * 3. 验证 planPath 格式合法（禁止路径穿越）
 */

import * as os from "node:os";
import * as path from "node:path";

/**
 * 根据 item ID 生成计划文件名
 * E1       → E1.md
 * E1.S3    → E1-S3.md
 * E1.S3.T2 → E1-S3-T2.md
 */
export function generatePlanFileName(itemId: string): string {
	if (!itemId) {
		throw new Error("itemId 不能为空");
	}
	const fileName = `${itemId.replace(/\./g, "-")}.md`;
	return fileName;
}

export interface PlanResolutionContext {
	/** Epic 的 project 路径（项目目录绝对路径） */
	project?: string;
	/** 路线图 ID */
	roadmapId: string;
}

/**
 * 将 planPath（纯文件名）解析为绝对路径
 * - 有 project → {project}/.pi/plans/{planPath}
 * - 无 project → ~/.pi/roadmap/plans/{roadmapId}/{planPath}
 */
export function resolveAbsolutePath(
	planPath: string,
	context: PlanResolutionContext,
): string {
	const { project, roadmapId } = context;

	if (!roadmapId) {
		throw new Error("roadmapId 不能为空");
	}

	// 有 project 且非空字符串 → 项目级
	if (project) {
		const resolvedProject = project.startsWith("~")
			? path.join(os.homedir(), project.slice(1))
			: project;
		return path.join(resolvedProject, ".pi", "plans", planPath);
	}

	// 无 project → 全局级
	const home = os.homedir();
	return path.join(home, ".pi", "roadmap", "plans", roadmapId, planPath);
}

/**
 * 验证 planPath 格式是否合法
 * 只允许 E{数字}(-{字母?数字})*.md 格式
 * 禁止目录分隔符 / \ 和路径穿越 ..
 */
export function validatePlanPath(planPath: string): boolean {
	if (!planPath) return false;

	// 禁止路径穿越和目录分隔符
	if (planPath.includes("/") || planPath.includes("\\")) return false;
	if (planPath.includes("..")) return false;

	// 必须匹配 E{数字}(-{字母?数字})*.md 格式
	const pattern = /^E\d+(-[A-Za-z]?\d+)*\.md$/;
	return pattern.test(planPath);
}
