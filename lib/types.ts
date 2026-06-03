/**
 * Roadmap 扩展 — 核心类型定义
 *
 * 三层结构：Epic → Story → Task
 *   - Epic: 大方向/大块工作，必须对应到一个项目
 *   - Story: 可在 1-3 天内完成的工作块
 *   - Task: 30分钟-2小时的最小执行单元
 */

import { homedir } from "node:os";
import * as path from "node:path";

// ── 状态枚举 ──

/** 路线图级别状态 */
export type RoadmapStatus = "active" | "paused" | "completed" | "archived";

/** 工作项状态 */
export type ItemStatus = "todo" | "doing" | "done" | "blocked" | "dropped";

/** 优先级 */
export type Priority = "low" | "medium" | "high";

// ── 数据模型 ──

/** 路线图元信息 */
export interface RoadmapMeta {
	/** 唯一标识，同时作为文件名 slug（如 "pi-atelier-split"） */
	id: string;
	/** 人类可读标题 */
	title: string;
	/** 路线图整体状态 */
	status: RoadmapStatus;
	/** 创建日期 ISO */
	created: string;
	/** 最后更新日期 ISO */
	updated: string;
	/** 标签，用于分类筛选 */
	tags: string[];
	/** 下一个可分配的永久数字 ID（从 1 开始递增） */
	nextEid: number;
}

/** 最小执行单元（30分钟-2小时） */
export interface Task {
	/** 永久数字 ID，创建后不变，用于 dependsOn 引用 */
	eid: number;
	/** 位置路径 ID，格式 "E{epicIdx}.S{storyIdx}.T{taskIdx}"，由 rebuildPaths 维护 */
	id: string;
	/** 动词开头的简短标题 */
	title: string;
	/** 当前状态 */
	status: ItemStatus;
	/** 优先级（可选，默认继承 Story/Epic 的优先级） */
	priority?: Priority;
	/** 创建日期 ISO */
	createdDate?: string;
	/** 开始执行日期 ISO（status 变为 doing 时填入） */
	doingDate?: string;
	/** 完成日期，仅 done 时有值 */
	doneDate?: string;
	/** 完成备注/产出链接 */
	note?: string;
	/** 正在执行此任务的会话 ID，仅 doing 时有值 */
	doingSessionId?: string;
	/** 完成此任务的会话 ID，仅 done 时有值，用于追溯 */
	doneBySessionId?: string;
	/** 依赖的其他项 eid 列表（如 [42, 17]），这些项必须完成才能开始此项 */
	dependsOn?: number[];
	/** 归档标志，true 时默认不显示 */
	archived?: boolean;
	/** 计划文档文件名（如 "E1-S3-T2.md"），由 plan-resolver 解析为绝对路径 */
	planPath?: string;
}

/** 工作块（1-3 天可完成） */
export interface Story {
	/** 永久数字 ID，创建后不变，用于 dependsOn 引用 */
	eid: number;
	/** 位置路径 ID，格式 "E{epicIdx}.S{storyIdx}"，由 rebuildPaths 维护 */
	id: string;
	/** 标题 */
	title: string;
	/** 描述（输入、产出、验收标准） */
	description: string;
	/** 当前状态 */
	status: ItemStatus;
	/** 优先级（可选，默认继承 Epic 的优先级） */
	priority?: Priority;
	/** 创建日期 ISO */
	createdDate?: string;
	/** 完成日期，仅 done 时有值 */
	doneDate?: string;
	/** 开始执行日期，仅 doing 时有值 */
	doingDate?: string;
	/** 任务列表 */
	tasks: Task[];
	/** 依赖的其他项 eid 列表（如 [42, 17]），这些项必须完成才能开始此项 */
	dependsOn?: number[];
	/** 归档标志，true 时默认不显示 */
	archived?: boolean;
	/** 计划文档文件名（如 "E1-S3.md"），由 plan-resolver 解析为绝对路径 */
	planPath?: string;
}

/** Epic：大方向，必须对应到一个项目 */
export interface Epic {
	/** 永久数字 ID，创建后不变，用于 dependsOn 引用 */
	eid: number;
	/** 位置路径 ID，格式 "E{epicIdx}"，由 rebuildPaths 维护 */
	id: string;
	/** 标题 */
	title: string;
	/** 描述（做什么 + 为什么） */
	description: string;
	/** 当前状态 */
	status: ItemStatus;
	/** 优先级 */
	priority: Priority;
	/** 对应的项目路径（绝对路径） */
	project: string;
	/** 创建日期 ISO */
	createdDate?: string;
	/** 完成日期，仅 done 时有值 */
	doneDate?: string;
	/** 开始执行日期，仅 doing 时有值 */
	doingDate?: string;
	/** Story 列表 */
	stories: Story[];
	/** 依赖的其他项 eid 列表（如 [3, 7]），这些项必须完成才能开始此 Epic */
	dependsOn?: number[];
	/** 归档标志，true 时默认不显示 */
	archived?: boolean;
	/** 计划文档文件名（如 "E1.md"），由 plan-resolver 解析为绝对路径 */
	planPath?: string;
}

/** 完整的路线图文件 */
export interface RoadmapFile {
	/** 元信息 */
	meta: RoadmapMeta;
	/** Epic 列表 */
	epics: Epic[];
}

// ── 常量 ──

/** 全局路线图目录 */
export const GLOBAL_ROADMAP_DIR = path.join(homedir(), ".pi", "roadmap");

/** 归档子目录名 */
export const ARCHIVE_DIR = "archive";

/** 文件后缀 */
export const FILE_SUFFIX = ".roadmap.json";

// ── 优先级工具 ──

/** 优先级排序权重 */
const PRIORITY_WEIGHT: Record<Priority, number> = {
	high: 0,
	medium: 1,
	low: 2,
};

/** 获取有效优先级：自身 > 父级 > medium */
export function getEffectivePriority(
	own?: Priority,
	parent?: Priority,
): Priority {
	return own ?? parent ?? "medium";
}

/** 比较两个优先级，返回可传给 sort() 的比较函数 */
export function comparePriority(a: Priority, b: Priority): number {
	return PRIORITY_WEIGHT[a] - PRIORITY_WEIGHT[b];
}

// ── 辅助类型 ──

/** 进度统计 */
export interface ProgressStats {
	/** 总 task 数 */
	total: number;
	/** 已完成 task 数 */
	done: number;
	/** 百分比 0-100 */
	percent: number;
}

/** 下一步建议 */
export interface NextStep {
	/** 路线图 ID */
	roadmapId: string;
	/** 路线图标题 */
	roadmapTitle: string;
	/** Epic ID */
	epicId: string;
	/** Epic eid */
	epicEid: number;
	/** Epic 标题 */
	epicTitle: string;
	/** Story ID */
	storyId: string;
	/** Story eid */
	storyEid: number;
	/** Story 标题 */
	storyTitle: string;
	/** Task */
	task: Task;
}
