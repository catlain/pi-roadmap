/**
 * filterByProject 大小写归一化测试（S-05 bug fix）
 *
 * 问题：Windows 上 path.normalize("D:/Project/Quant") !== path.normalize("D:\\Project\\quant")
 * 因为 === 比较区分大小写。修复：统一 toLowerCase 后再比较。
 */

import { describe, expect, it } from "vitest";
import { filterByProject } from "../lib/store";
import type { RoadmapFile } from "../lib/types";

const BASE_RM: RoadmapFile = {
	meta: {
		id: "test",
		title: "测试路线图",
		status: "active",
		created: "2026-06-05",
		updated: "2026-06-05",
		tags: [],
	},
	epics: [
		{
			id: "E1",
			title: "Epic A",
			description: "",
			status: "todo",
			priority: "high",
			project: "D:/Project/quant",
			stories: [],
		},
		{
			id: "E2",
			title: "Epic B",
			description: "",
			status: "todo",
			priority: "medium",
			project: "D:/Project/other",
			stories: [],
		},
	],
};

describe("filterByProject 大小写归一化", () => {
	it("大小写不同的项目路径应该匹配", () => {
		// Windows: process.cwd() 返回 D:\Project\Quant（大写 Q）
		// epic.project 存储的是 D:/Project/quant（小写 q）
		const result = filterByProject(BASE_RM, "D:\\Project\\Quant");
		expect(result.epics).toHaveLength(1);
		expect(result.epics[0].id).toBe("E1");
	});

	it("盘符大小写不同应该匹配", () => {
		const rm: RoadmapFile = {
			...BASE_RM,
			epics: [
				{ ...BASE_RM.epics[0], project: "d:/Project/quant" }, // 小写 d
			],
		};
		const result = filterByProject(rm, "D:/Project/Quant"); // 大写 D
		expect(result.epics).toHaveLength(1);
		expect(result.epics[0].id).toBe("E1");
	});

	it("正斜杠+大小写混合应该匹配", () => {
		// 真实场景：创建时传 D:/Project/Quant，CWD 是 D:\PROJECT\quant
		const result = filterByProject(BASE_RM, "D:\\PROJECT\\QUANT");
		expect(result.epics).toHaveLength(1);
		expect(result.epics[0].id).toBe("E1");
	});

	it("完全不匹配时返回全部（fallback）", () => {
		const result = filterByProject(BASE_RM, "/home/user/unrelated");
		expect(result.epics).toHaveLength(2);
	});

	it("大小写不同 + 分隔符不同 + 多个匹配", () => {
		const rm: RoadmapFile = {
			...BASE_RM,
			epics: [
				{ ...BASE_RM.epics[0], project: "D:\\Project\\quant" }, // 反斜杠，小写 q
				{ ...BASE_RM.epics[1], project: "d:/Project/OTHER" }, // 正斜杠，大写
				{
					...BASE_RM.epics[0],
					id: "E3",
					project: "D:/Project/unrelated",
				},
			],
		};
		const result = filterByProject(rm, "D:/project/quant"); // 全小写
		expect(result.epics).toHaveLength(1);
		expect(result.epics[0].id).toBe("E1");
	});
});
