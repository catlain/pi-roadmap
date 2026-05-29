/**
 * 搜索功能测试 — searchRoadmapData 纯函数 + registerSearchTool 工具注册
 */
import { describe, expect, it, vi } from "vitest";
import { MOCK_RM, MOCK_RM_2 } from "./fixtures/search-mock-data";
import { searchRoadmapData } from "../lib/tools-query-search";

// 纯函数测试不需要 typebox，但 vitest 会加载依赖链
vi.mock("@sinclair/typebox", () => ({ Type: { Object: () => ({}), String: () => ({}), Number: () => ({}), Boolean: () => ({}), Any: () => ({}), Optional: (t: any) => t, Union: (t: any[]) => t[0], Literal: (v: any) => ({ type: "literal", value: v }), Array: (t: any) => ({ type: "array", items: t }) } }));

// ── 纯函数单元测试 ──

describe("searchRoadmapData 基本匹配", () => {
	it("按 title 匹配 Epic", () => {
		const results = searchRoadmapData([MOCK_RM], "重构");
		expect(results).toHaveLength(1);
		expect(results[0].matchedType).toBe("epic");
		expect(results[0].detail).toContain("设计合并策略");
		expect(results[0].detail).toContain("删除 sync 机制");
	});

	it("按 description 匹配 Epic", () => {
		const results = searchRoadmapData([MOCK_RM], "读取时合并");
		expect(results[0].matchedId).toBe("E1");
	});

	it("按 title 匹配 Story", () => {
		const results = searchRoadmapData([MOCK_RM], "合并策略");
		const storyMatch = results.find(r => r.matchedType === "story" && r.matchedId === "E1.S1");
		expect(storyMatch).toBeDefined();
		expect(storyMatch!.detail).toContain("调研 shepherd");
	});

	it("按 description 匹配 Story", () => {
		const results = searchRoadmapData([MOCK_RM], "readMergedRoadmap");
		expect(results.find(r => r.matchedId === "E1.S2")).toBeDefined();
	});

	it("按 title 匹配 Task", () => {
		const results = searchRoadmapData([MOCK_RM], "sync");
		const taskMatch = results.find(r => r.matchedType === "task" && r.matchedId === "E1.S2.T1");
		expect(taskMatch).toBeDefined();
		expect(taskMatch!.detail).toContain("重构 roadmap");
	});

	it("按 note 匹配 Task", () => {
		const results = searchRoadmapData([MOCK_RM], "jiti");
		const noteMatch = results.find(r => r.matchedId === "E1.S2.T1");
		expect(noteMatch).toBeDefined();
		expect(noteMatch!.detail).toContain("jiti 缓存清理");
	});

	it("大小写不敏感", () => {
		const upper = searchRoadmapData([MOCK_RM], "MCP");
		const lower = searchRoadmapData([MOCK_RM], "mcp");
		expect(upper).toHaveLength(lower.length);
	});

	it("空结果返回空数组", () => {
		expect(searchRoadmapData([MOCK_RM], "不存在的关键词xyz")).toHaveLength(0);
	});

	it("空/空白 query 返回空数组", () => {
		expect(searchRoadmapData([MOCK_RM], "")).toHaveLength(0);
		expect(searchRoadmapData([MOCK_RM], "   ")).toHaveLength(0);
	});
});

// ── scope 过滤 ──

describe("searchRoadmapData scope 过滤", () => {
	it("scope=epic 只搜 Epic", () => {
		const results = searchRoadmapData([MOCK_RM], "合并", { scope: "epic" });
		for (const r of results) expect(r.matchedType).toBe("epic");
		expect(results.some(r => r.matchedId === "E1")).toBe(true);
	});

	it("scope=story 只搜 Story", () => {
		const results = searchRoadmapData([MOCK_RM], "readMergedRoadmap", { scope: "story" });
		for (const r of results) expect(r.matchedType).toBe("story");
	});

	it("scope=task 只搜 Task", () => {
		const results = searchRoadmapData([MOCK_RM], "sync", { scope: "task" });
		for (const r of results) expect(r.matchedType).toBe("task");
	});

	it("scope=all 搜所有层级", () => {
		const results = searchRoadmapData([MOCK_RM], "合并", { scope: "all" });
		expect(results.map(r => r.matchedType)).toContain("epic");
	});
});

// ── 多 roadmap ──

describe("searchRoadmapData 多路线图", () => {
	it("跨多个 roadmap 匹配", () => {
		const results = searchRoadmapData([MOCK_RM, MOCK_RM_2], "算法");
		expect(results.find(r => r.roadmapId === "rm-2")).toBeDefined();
	});

	it("同一个 query 匹配不同 roadmap", () => {
		const results = searchRoadmapData([MOCK_RM, MOCK_RM_2], "实现");
		expect(results.length).toBeGreaterThanOrEqual(2);
	});
});

// ── 归档项 ──

describe("searchRoadmapData 归档项", () => {
	it("默认不搜已归档项", () => {
		expect(searchRoadmapData([MOCK_RM], "归档").find(r => r.matchedId === "E3")).toBeUndefined();
	});

	it("includeArchived=true 包含归档项", () => {
		expect(searchRoadmapData([MOCK_RM], "归档", { includeArchived: true }).find(r => r.matchedId === "E3")).toBeDefined();
	});
});

// registerSearchTool 的集成测试由 index.test.ts 覆盖（12 个工具注册验证）
