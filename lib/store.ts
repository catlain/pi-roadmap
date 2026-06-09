/**
 * Roadmap 存储层 — JSON 文件读写、归档
 *
 * JSON 是唯一真相源。验证逻辑在 validator.ts。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { migrateToEid } from "./migrate";
import {
	ARCHIVE_DIR,
	type Epic,
	FILE_SUFFIX,
	GLOBAL_ROADMAP_DIR,
	type RoadmapFile,
} from "./types";
import { repairRoadmap, validateRoadmap } from "./validator";

// ── 路径工具 ──

export function getRoadmapFilePath(id: string): string {
	return path.join(GLOBAL_ROADMAP_DIR, `${id}${FILE_SUFFIX}`);
}

export function getArchivePath(id: string): string {
	return path.join(GLOBAL_ROADMAP_DIR, ARCHIVE_DIR, `${id}${FILE_SUFFIX}`);
}

/** 列出所有活跃路线图文件路径 */
export function listRoadmapFiles(): string[] {
	if (!fs.existsSync(GLOBAL_ROADMAP_DIR)) return [];
	return fs
		.readdirSync(GLOBAL_ROADMAP_DIR)
		.filter((f) => f.endsWith(FILE_SUFFIX))
		.map((f) => path.join(GLOBAL_ROADMAP_DIR, f));
}

/** 列出归档文件路径 */
export function listArchivedFiles(): string[] {
	const archiveDir = path.join(GLOBAL_ROADMAP_DIR, ARCHIVE_DIR);
	if (!fs.existsSync(archiveDir)) return [];
	return fs
		.readdirSync(archiveDir)
		.filter((f) => f.endsWith(FILE_SUFFIX))
		.map((f) => path.join(archiveDir, f));
}

// ── 读写 ──

/** 读取并解析 roadmap 文件 */
export function readRoadmap(filePath: string): RoadmapFile | null {
	try {
		const raw = fs.readFileSync(filePath, "utf-8");
		const data = JSON.parse(raw);
		const validation = validateRoadmap(data);
		if (!validation.valid) {
			const repaired = repairRoadmap(data);
			if (repaired) {
				writeRoadmap(filePath, repaired);
				return repaired;
			}
			return null;
		}
		// 验证通过，补全可选字段（tags 默认空数组）
		if (!data.meta.tags) data.meta.tags = [];

		// 迁移到 eid 格式（旧数据无 eid / dependsOn 是 string[]）
		migrateToEid(data as RoadmapFile);

		// 归一化 project 路径（修复 Windows 正反斜杠不一致）
		return normalizeProjectPaths(data as RoadmapFile);
	} catch {
		// JSON 损坏或权限异常 → 视为不存在
		return null;
	}
}

/** 写入 roadmap 文件（原子写入：临时文件 + rename，防止中途崩溃丢数据） */
export function writeRoadmap(filePath: string, data: RoadmapFile): void {
	data.meta.updated = new Date().toISOString().slice(0, 10);
	const dir = path.dirname(filePath);
	fs.mkdirSync(dir, { recursive: true });
	const tmpPath = `${filePath}.tmp`;
	fs.writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
	fs.renameSync(tmpPath, filePath);
}

/** 按 ID 写入（活跃文件优先，找不到返回 false） */
export function writeRoadmapById(
	id: string,
	data: RoadmapFile,
): boolean {
	const activePath = getRoadmapFilePath(id);
	if (fs.existsSync(activePath)) {
		writeRoadmap(activePath, data);
		return true;
	}
	const archivePath = getArchivePath(id);
	if (fs.existsSync(archivePath)) {
		writeRoadmap(archivePath, data);
		return true;
	}
	return false;
}

/** 按 ID 读取（先找活跃，再找归档） */
export function readRoadmapById(id: string): RoadmapFile | null {
	const activePath = getRoadmapFilePath(id);
	if (fs.existsSync(activePath)) return readRoadmap(activePath);
	const archivePath = getArchivePath(id);
	if (fs.existsSync(archivePath)) return readRoadmap(archivePath);
	return null;
}

// ── 项目过滤 ──

/** 按 epic.project 过滤 roadmap，只返回匹配 cwd 的 epic。
 *  无匹配时返回全部（非项目目录场景）。
 *  不修改原始对象。 */
export function filterByProject(rm: RoadmapFile, cwd: string): RoadmapFile {
	const normalizedCwd = path.normalize(cwd).toLowerCase();
	const matched = rm.epics.filter(
		(e: Epic) => path.normalize(e.project).toLowerCase() === normalizedCwd,
	);
	if (matched.length > 0) {
		return { ...rm, epics: matched };
	}
	return rm;
}

// ── 归档 ──

/** 归档：移动到 archive/ 子目录 */
export function archiveRoadmap(id: string): boolean {
	const src = getRoadmapFilePath(id);
	const dst = getArchivePath(id);
	if (!fs.existsSync(src)) return false;
	fs.mkdirSync(path.dirname(dst), { recursive: true });
	fs.renameSync(src, dst);
	const data = readRoadmap(dst);
	if (data) {
		data.meta.status = "archived";
		writeRoadmap(dst, data);
	}
	return true;
}

/** 恢复归档 */
export function unarchiveRoadmap(id: string): boolean {
	const src = getArchivePath(id);
	const dst = getRoadmapFilePath(id);
	if (!fs.existsSync(src)) return false;
	fs.renameSync(src, dst);
	const data = readRoadmap(dst);
	if (data) {
		data.meta.status = "active";
		writeRoadmap(dst, data);
	}
	return true;
}

// ── 迁移 ──

// ── 数据修复 ──

/** 归一化 roadmap 中所有 Epic 的 project 路径（修复 Windows 正反斜杠不一致） */
export function normalizeProjectPaths(rm: RoadmapFile): RoadmapFile {
	return {
		...rm,
		epics: rm.epics.map((e: Epic) => ({
			...e,
			project: path.normalize(e.project),
		})),
	};
}
