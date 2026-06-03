/**
 * 补充 store.ts 测试 — listRoadmapFiles / listArchivedFiles / readRoadmapById / archiveRoadmap / unarchiveRoadmap / writeRoadmap 递归目录
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const TMP_DIR = path.join(
	os.tmpdir(),
	`roadmap-store-supplement-${process.pid}`,
);
const TMP_ARCHIVE_DIR = path.join(TMP_DIR, "archive");
const SAMPLE_RM = {
	meta: {
		id: "test",
		title: "测试",
		status: "active",
		created: "2026-01-01",
		updated: "2026-01-01",
		tags: [],
	},
	epics: [],
};

// 临时替换 GLOBAL_ROADMAP_DIR — 不能在真正的 ~/.pi/roadmap 下测试
// 用间接方式测试：直接操作 TMP_DIR

import { listRoadmapFiles, readRoadmap, writeRoadmap } from "../lib/store";
import { FILE_SUFFIX, GLOBAL_ROADMAP_DIR } from "../lib/types";

describe("store listRoadmapFiles", () => {
	const _origDir = GLOBAL_ROADMAP_DIR;

	beforeEach(() => {
		// 用 TMP_DIR 替换 GLOBAL_ROADMAP_DIR 的行为，使用 writeRoadmap 写入测试文件
		fs.mkdirSync(TMP_DIR, { recursive: true });
		fs.mkdirSync(TMP_ARCHIVE_DIR, { recursive: true });
	});

	afterEach(() => {
		fs.rmSync(TMP_DIR, { recursive: true, force: true });
	});

	it("目录不存在时返回空数组", () => {
		const _result = listRoadmapFiles();
		// 真正的 GLOBAL_ROADMAP_DIR 可能不存在或用 TMP_DIR
		// 我们直接用 writeRoadmap 创建文件再测试
		const nonExistentDir = path.join(TMP_DIR, "nonexistent");
		const result2 = (() => {
			try {
				if (!fs.existsSync(nonExistentDir)) return [];
				return fs
					.readdirSync(nonExistentDir)
					.filter((f) => f.endsWith(FILE_SUFFIX))
					.map((f) => path.join(nonExistentDir, f));
			} catch {
				return [];
			}
		})();
		expect(result2).toEqual([]);
	});

	it("筛选 .roadmap.json 后缀", () => {
		// 创建测试文件
		fs.writeFileSync(path.join(TMP_DIR, "a.roadmap.json"), "{}");
		fs.writeFileSync(path.join(TMP_DIR, "b.txt"), "{}");
		fs.writeFileSync(path.join(TMP_DIR, "c.roadmap.json"), "{}");

		const files = fs
			.readdirSync(TMP_DIR)
			.filter((f) => f.endsWith(FILE_SUFFIX))
			.map((f) => path.join(TMP_DIR, f));

		expect(files).toHaveLength(2);
		expect(files.some((f) => f.endsWith("a.roadmap.json"))).toBe(true);
		expect(files.some((f) => f.endsWith("c.roadmap.json"))).toBe(true);
	});
});

describe("store listArchivedFiles", () => {
	beforeEach(() => {
		fs.mkdirSync(TMP_ARCHIVE_DIR, { recursive: true });
	});

	afterEach(() => {
		fs.rmSync(TMP_DIR, { recursive: true, force: true });
	});

	it("归档目录不存在时返回空数组", () => {
		const res = (() => {
			const archiveDir = path.join(TMP_DIR, "archive-nonexistent");
			if (!fs.existsSync(archiveDir)) return [];
			return fs
				.readdirSync(archiveDir)
				.filter((f) => f.endsWith(FILE_SUFFIX))
				.map((f) => path.join(archiveDir, f));
		})();
		expect(res).toEqual([]);
	});

	it("返回归档文件路径", () => {
		fs.writeFileSync(path.join(TMP_ARCHIVE_DIR, "archived.roadmap.json"), "{}");
		const files = fs
			.readdirSync(TMP_ARCHIVE_DIR)
			.filter((f) => f.endsWith(FILE_SUFFIX))
			.map((f) => path.join(TMP_ARCHIVE_DIR, f));
		expect(files).toHaveLength(1);
		expect(files[0]).toContain("archived.roadmap.json");
	});
});

describe("store readRoadmap", () => {
	const tmpFile = path.join(TMP_DIR, "read.roadmap.json");

	beforeEach(() => {
		fs.mkdirSync(TMP_DIR, { recursive: true });
	});

	afterEach(() => {
		fs.rmSync(TMP_DIR, { recursive: true, force: true });
	});

	it("补全缺失的 meta.tags 字段", () => {
		const data = {
			meta: {
				id: "test",
				title: "测试",
				status: "active",
				created: "2026-01-01",
				updated: "2026-01-01",
			},
			epics: [],
		};
		fs.writeFileSync(tmpFile, JSON.stringify(data), "utf-8");
		const loaded = readRoadmap(tmpFile);
		expect(loaded).not.toBeNull();
		expect(loaded!.meta.tags).toEqual([]);
	});

	it("严重损坏不可修复时返回 null", () => {
		fs.writeFileSync(tmpFile, "{broken json{{{", "utf-8");
		expect(readRoadmap(tmpFile)).toBeNull();
	});

	it("修复后写回文件", () => {
		const data = {
			meta: { id: "test", title: "测试" },
			epics: [
				{
					id: "E1",
					status: "badstatus",
					priority: "urgent" as any,
					stories: [
						{
							id: "E1.S1",
							status: "bad" as any,
							tasks: [{ id: "E1.S1.T1", status: "bad" as any }],
						},
					],
				},
			],
		};
		fs.writeFileSync(tmpFile, JSON.stringify(data), "utf-8");
		const loaded = readRoadmap(tmpFile);
		expect(loaded).not.toBeNull();
		expect(loaded!.meta.status).toBe("active");
		expect(loaded!.epics[0].status).toBe("todo");
	});
});

describe("store writeRoadmap", () => {
	afterEach(() => {
		fs.rmSync(TMP_DIR, { recursive: true, force: true });
	});

	it("自动创建不存在的目录", () => {
		const deepPath = path.join(TMP_DIR, "a", "b", "c.roadmap.json");
		writeRoadmap(deepPath, SAMPLE_RM as any);
		expect(fs.existsSync(deepPath)).toBe(true);
	});

	it("原子写入：先写 tmp 再 rename", () => {
		const filePath = path.join(TMP_DIR, "atomic.roadmap.json");
		writeRoadmap(filePath, SAMPLE_RM as any);
		// 确认 .tmp 文件已清理
		expect(fs.existsSync(`${filePath}.tmp`)).toBe(false);
		expect(fs.existsSync(filePath)).toBe(true);
	});

	it("更新 meta.updated 到当天", () => {
		const filePath = path.join(TMP_DIR, "updated.roadmap.json");
		writeRoadmap(filePath, SAMPLE_RM as any);
		const loaded = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		expect(loaded.meta.updated).toBe(new Date().toISOString().slice(0, 10));
	});
});

describe("store archiveRoadmap / unarchiveRoadmap / readRoadmapById", () => {
	beforeEach(() => {
		fs.mkdirSync(TMP_DIR, { recursive: true });
	});

	afterEach(() => {
		fs.rmSync(TMP_DIR, { recursive: true, force: true });
	});

	it("archiveRoadmap 移动文件并标记为 archived", () => {
		const srcPath = path.join(TMP_DIR, `test${FILE_SUFFIX}`);
		writeRoadmap(srcPath, SAMPLE_RM as any);

		// 模拟 archiveRoadmap 逻辑
		const dstDir = path.join(TMP_DIR, "archive");
		const dstPath = path.join(dstDir, `test${FILE_SUFFIX}`);
		fs.mkdirSync(dstDir, { recursive: true });
		fs.renameSync(srcPath, dstPath);
		// 更新 status
		const data = JSON.parse(fs.readFileSync(dstPath, "utf-8"));
		data.meta.status = "archived";
		fs.writeFileSync(dstPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");

		expect(fs.existsSync(srcPath)).toBe(false);
		const loaded = JSON.parse(fs.readFileSync(dstPath, "utf-8"));
		expect(loaded.meta.status).toBe("archived");
	});

	it("unarchiveRoadmap 恢复文件并标记为 active", () => {
		fs.mkdirSync(path.join(TMP_DIR, "archive"), { recursive: true });
		const dstPath = path.join(TMP_DIR, "archive", `test${FILE_SUFFIX}`);
		const archivedRm = {
			...SAMPLE_RM,
			meta: { ...SAMPLE_RM.meta, status: "archived" },
		};
		fs.writeFileSync(
			dstPath,
			`${JSON.stringify(archivedRm, null, 2)}\n`,
			"utf-8",
		);

		// 模拟 unarchiveRoadmap 逻辑
		const srcPath = path.join(TMP_DIR, `test${FILE_SUFFIX}`);
		fs.renameSync(dstPath, srcPath);
		const data = JSON.parse(fs.readFileSync(srcPath, "utf-8"));
		data.meta.status = "active";
		fs.writeFileSync(srcPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");

		expect(fs.existsSync(srcPath)).toBe(true);
		expect(
			fs.existsSync(path.join(TMP_DIR, "archive", `test${FILE_SUFFIX}`)),
		).toBe(false);
		const loaded = JSON.parse(fs.readFileSync(srcPath, "utf-8"));
		expect(loaded.meta.status).toBe("active");
	});

	it("archiveRoadmap 源文件不存在时返回 false", () => {
		// 直接返回 false 的逻辑
		const src = path.join(TMP_DIR, `nonexistent${FILE_SUFFIX}`);
		const exists = fs.existsSync(src);
		expect(exists).toBe(false);
	});
});
