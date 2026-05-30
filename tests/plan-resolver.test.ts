/**
 * 测试 lib/plan-resolver.ts — 计划文件路径解析、生成、验证
 */

import { describe, expect, it } from "vitest";
import {
	generatePlanFileName,
	resolveAbsolutePath,
	validatePlanPath,
} from "../lib/plan-resolver";

// ============================================================
// generatePlanFileName
// ============================================================
describe("generatePlanFileName", () => {
	it("Epic 级：E1 → E1.md", () => {
		expect(generatePlanFileName("E1")).toBe("E1.md");
	});

	it("Story 级：E1.S3 → E1-S3.md", () => {
		expect(generatePlanFileName("E1.S3")).toBe("E1-S3.md");
	});

	it("Task 级：E1.S3.T2 → E1-S3-T2.md", () => {
		expect(generatePlanFileName("E1.S3.T2")).toBe("E1-S3-T2.md");
	});

	it("多位数字：E12.S34.T56 → E12-S34-T56.md", () => {
		expect(generatePlanFileName("E12.S34.T56")).toBe("E12-S34-T56.md");
	});

	it("空字符串抛错", () => {
		expect(() => generatePlanFileName("")).toThrow();
	});

	it("null/undefined 抛错", () => {
		expect(() => generatePlanFileName(null as any)).toThrow();
		expect(() => generatePlanFileName(undefined as any)).toThrow();
	});
});

// ============================================================
// resolveAbsolutePath
// ============================================================
describe("resolveAbsolutePath", () => {
	it("有 project 时拼项目路径", () => {
		const result = resolveAbsolutePath("E1-S3.md", {
			project: "/home/user/projects/my-app",
			roadmapId: "test-roadmap",
		});
		expect(result).toBe(
			"/home/user/projects/my-app/.pi/plans/E1-S3.md"
		);
	});

	it("无 project 时拼全局路径", () => {
		const result = resolveAbsolutePath("E1.md", {
			roadmapId: "my-roadmap",
		});
		// ~/.pi/roadmap/plans/my-roadmap/E1.md
		expect(result).toMatch(/\/\.pi\/roadmap\/plans\/my-roadmap\/E1\.md$/);
		expect(result).not.toContain("undefined");
	});

	it("project 为空字符串时走全局路径", () => {
		const result = resolveAbsolutePath("E1.md", {
			project: "",
			roadmapId: "my-roadmap",
		});
		expect(result).toMatch(/\/\.pi\/roadmap\/plans\/my-roadmap\/E1\.md$/);
	});

	it("roadmapId 缺失时抛错", () => {
		expect(() =>
			resolveAbsolutePath("E1.md", { roadmapId: "" })
		).toThrow();
	});
});

// ============================================================
// validatePlanPath
// ============================================================
describe("validatePlanPath", () => {
	it("合法 Epic 文件名：E1.md", () => {
		expect(validatePlanPath("E1.md")).toBe(true);
	});

	it("合法 Story 文件名：E1-S3.md", () => {
		expect(validatePlanPath("E1-S3.md")).toBe(true);
	});

	it("合法 Task 文件名：E1-S3-T2.md", () => {
		expect(validatePlanPath("E1-S3-T2.md")).toBe(true);
	});

	it("合法多位数字：E12-S34-T56.md", () => {
		expect(validatePlanPath("E12-S34-T56.md")).toBe(true);
	});

	// 非法路径
	it("禁止目录分隔符 /", () => {
		expect(validatePlanPath("sub/E1.md")).toBe(false);
	});

	it("禁止目录分隔符 \\", () => {
		expect(validatePlanPath("sub\\E1.md")).toBe(false);
	});

	it("禁止 .. 路径穿越", () => {
		expect(validatePlanPath("../E1.md")).toBe(false);
		expect(validatePlanPath("../../etc/passwd.md")).toBe(false);
	});

	it("禁止绝对路径", () => {
		expect(validatePlanPath("/etc/passwd.md")).toBe(false);
	});

	it("禁止非 .md 后缀", () => {
		expect(validatePlanPath("E1.txt")).toBe(false);
		expect(validatePlanPath("E1")).toBe(false);
	});

	it("禁止空字符串", () => {
		expect(validatePlanPath("")).toBe(false);
	});

	it("不以 E 开头时拒绝", () => {
		expect(validatePlanPath("S1.md")).toBe(false);
		expect(validatePlanPath("T1.md")).toBe(false);
	});
});
