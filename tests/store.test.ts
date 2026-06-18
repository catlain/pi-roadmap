/**
 * Roadmap 存储层测试
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { filterByProject, readRoadmap, writeRoadmap } from "../lib/store";
import type { RoadmapFile } from "../lib/types";
import { makeEpic, makeRoadmapMeta } from "./helpers/test-factories";

// 临时覆盖全局目录
const TMP_DIR = path.join(os.tmpdir(), `roadmap-test-${process.pid}`);

// monkey-patch: store.ts 使用 GLOBAL_ROADMAP_DIR，这里用 tmpdir 测试
// 需要通过路径间接测试

const SAMPLE_ROADMAP: RoadmapFile = {
	meta: makeRoadmapMeta({
		id: "test",
		title: "测试路线图",
		created: "2026-05-25",
		updated: "2026-05-25",
		tags: ["test"],
	}),
	epics: [
		makeEpic({
			title: "Epic 1",
			description: "测试",
			priority: "high",
			project: "/tmp/project",
		}),
	],
};

/** 多项目 roadmap，用于 filterByProject 测试 */
const MULTI_PROJECT_ROADMAP: RoadmapFile = {
	meta: makeRoadmapMeta({
		id: "multi",
		title: "多项目路线图",
		created: "2026-05-25",
		updated: "2026-05-25",
	}),
	epics: [
		{
			id: "E1",
			eid: 1,
			title: "项目 A Epic",
			description: "",
			status: "todo",
			priority: "high",
			project: "/home/user/project-a",
			stories: [
				{
					id: "E1.S1",
					eid: 2,
					title: "S1",
					description: "",
					status: "todo",
					tasks: [{ id: "E1.S1.T1", eid: 3, title: "T1", status: "todo" }],
				},
			],
		},
		{
			id: "E2",
			eid: 4,
			title: "项目 B Epic",
			description: "",
			status: "doing",
			priority: "medium",
			project: "/home/user/project-b",
			stories: [
				{
					id: "E2.S1",
					eid: 5,
					title: "S1",
					description: "",
					status: "doing",
					tasks: [{ id: "E2.S1.T1", eid: 6, title: "T1", status: "doing" }],
				},
			],
		},
		{
			id: "E3",
			eid: 7,
			title: "共享 Epic",
			description: "",
			status: "todo",
			priority: "low",
			project: "/home/user/project-a",
			stories: [],
		},
	],
};

describe("store", () => {
	const tmpFile = path.join(TMP_DIR, "test.roadmap.json");
	const _archiveFile = path.join(TMP_DIR, "archive", "test.roadmap.json");

	beforeEach(() => {
		fs.mkdirSync(TMP_DIR, { recursive: true });
	});

	afterEach(() => {
		fs.rmSync(TMP_DIR, { recursive: true, force: true });
	});

	it("writeRoadmap + readRoadmap 往返", () => {
		writeRoadmap(tmpFile, SAMPLE_ROADMAP);
		expect(fs.existsSync(tmpFile)).toBe(true);

		const loaded = readRoadmap(tmpFile);
		expect(loaded).not.toBeNull();
		expect(loaded!.meta.id).toBe("test");
		expect(loaded!.epics).toHaveLength(1);
	});

	it("writeRoadmap 自动更新 meta.updated", () => {
		writeRoadmap(tmpFile, SAMPLE_ROADMAP);
		const loaded = readRoadmap(tmpFile);
		expect(loaded!.meta.updated).toBe(new Date().toISOString().slice(0, 10));
	});

	it("readRoadmap 返回 null 对不存在的文件", () => {
		expect(readRoadmap("/nonexistent/file.json")).toBeNull();
	});

	it("readRoadmap 修复轻微损坏的数据", () => {
		// 写入一个缺少 tags 的数据
		const broken = JSON.parse(JSON.stringify(SAMPLE_ROADMAP));
		delete broken.meta.tags;
		fs.writeFileSync(tmpFile, JSON.stringify(broken), "utf-8");

		const loaded = readRoadmap(tmpFile);
		expect(loaded).not.toBeNull();
		expect(loaded!.meta.tags).toEqual([]);
	});

	it("readRoadmap 返回 null 对严重损坏的 JSON", () => {
		fs.writeFileSync(tmpFile, "{ broken json", "utf-8");
		expect(readRoadmap(tmpFile)).toBeNull();
	});
});

describe("filterByProject", () => {
	it("匹配单个项目只返回该项目的 epic", () => {
		const result = filterByProject(
			MULTI_PROJECT_ROADMAP,
			"/home/user/project-a",
		);
		expect(result.epics).toHaveLength(2);
		expect(result.epics.map((e) => e.id)).toEqual(["E1", "E3"]);
	});

	it("匹配另一个项目只返回对应的 epic", () => {
		const result = filterByProject(
			MULTI_PROJECT_ROADMAP,
			"/home/user/project-b",
		);
		expect(result.epics).toHaveLength(1);
		expect(result.epics[0].id).toBe("E2");
	});

	it("无匹配时返回全部 epic（非项目目录）", () => {
		const result = filterByProject(
			MULTI_PROJECT_ROADMAP,
			"/home/user/unrelated",
		);
		expect(result.epics).toHaveLength(3);
	});

	it("空 epics 返回空数组", () => {
		const empty: RoadmapFile = { ...MULTI_PROJECT_ROADMAP, epics: [] };
		const result = filterByProject(empty, "/home/user/project-a");
		expect(result.epics).toHaveLength(0);
	});

	it("不修改原始 roadmap 对象", () => {
		const original = JSON.parse(JSON.stringify(MULTI_PROJECT_ROADMAP));
		filterByProject(MULTI_PROJECT_ROADMAP, "/home/user/project-a");
		expect(MULTI_PROJECT_ROADMAP.epics).toEqual(original.epics);
	});

	it("meta 信息保持不变", () => {
		const result = filterByProject(
			MULTI_PROJECT_ROADMAP,
			"/home/user/project-a",
		);
		expect(result.meta.id).toBe("multi");
		expect(result.meta.title).toBe("多项目路线图");
	});

	describe("路径分隔符归一化（Windows 兼容）", () => {
		it("正斜杠 cwd 匹配反斜杠 project", () => {
			// Windows: process.cwd() 可能返回 D:/Project/foo
			// 但 epic.project 存储的是 D:\\Project\\foo
			const rm: RoadmapFile = {
				...MULTI_PROJECT_ROADMAP,
				epics: [
					{ ...MULTI_PROJECT_ROADMAP.epics[0], project: "D:\\Project\\foo" },
					{ ...MULTI_PROJECT_ROADMAP.epics[1], project: "D:\\Project\\bar" },
				],
			};
			const result = filterByProject(rm, "D:/Project/foo");
			expect(result.epics).toHaveLength(1);
			expect(result.epics[0].id).toBe("E1");
		});

		it("反斜杠 cwd 匹配正斜杠 project", () => {
			const rm: RoadmapFile = {
				...MULTI_PROJECT_ROADMAP,
				epics: [
					{ ...MULTI_PROJECT_ROADMAP.epics[0], project: "D:/Project/foo" },
					{ ...MULTI_PROJECT_ROADMAP.epics[1], project: "D:/Project/bar" },
				],
			};
			const result = filterByProject(rm, "D:\\Project\\foo");
			expect(result.epics).toHaveLength(1);
			expect(result.epics[0].id).toBe("E1");
		});

		it("混合分隔符的 roadmap 能正确过滤", () => {
			// 模拟真实场景：一些 Epic 用 / 另一些用 \
			const rm: RoadmapFile = {
				...MULTI_PROJECT_ROADMAP,
				epics: [
					{ ...MULTI_PROJECT_ROADMAP.epics[0], project: "D:\\Project\\foo" }, // 反斜杠
					{ ...MULTI_PROJECT_ROADMAP.epics[1], project: "D:/Project/foo" }, // 正斜杠
					{ ...MULTI_PROJECT_ROADMAP.epics[2], project: "D:/Project/bar" }, // 正斜杠，不同项目
				],
			};
			const result = filterByProject(rm, "D:\\Project\\foo");
			expect(result.epics).toHaveLength(2);
			expect(result.epics.map((e) => e.id).sort()).toEqual(["E1", "E2"]);
		});
	});
});
