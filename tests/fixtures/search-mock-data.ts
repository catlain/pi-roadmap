/**
 * 搜索功能的测试数据 fixtures
 */
import type { RoadmapFile } from "../../lib/types";

export const MOCK_RM: RoadmapFile = {
	meta: { id: "rm-1", title: "扩展生态路线图", status: "active", created: "2026-01-01", updated: "2026-01-01", tags: ["pi", "extensions"] },
	epics: [
		{
			id: "E1", title: "重构 roadmap 数据模型", description: "改造 roadmap 为读取时合并模式", status: "doing", priority: "high",
			project: "/test",
			stories: [
				{
					id: "E1.S1", title: "设计合并策略", description: "设计项目级 roadmap 文件格式与合并策略", status: "done",
					tasks: [
						{ id: "E1.S1.T1", title: "调研 shepherd 合并方案", status: "done" },
						{ id: "E1.S1.T2", title: "产出设计文档", status: "done" },
					],
				},
				{
					id: "E1.S2", title: "实现核心改造", description: "实现 readMergedRoadmap 合并读取函数", status: "todo",
					tasks: [
						{ id: "E1.S2.T1", title: "删除 sync 机制", status: "todo", note: "参考 jiti 缓存清理方案" },
					],
				},
			],
		},
		{
			id: "E2", title: "MCP 协议增强", description: "增强 mcp-lite 的工具发现能力", status: "todo", priority: "medium",
			project: "/test",
			stories: [
				{
					id: "E2.S1", title: "动态工具注册", description: "实现 MCP 工具动态注册", status: "todo",
					tasks: [
						{ id: "E2.S1.T1", title: "实现工具发现", status: "todo" },
					],
				},
			],
		},
		{
			id: "E3", title: "已归档的 Epic", description: "归档测试用", status: "done", priority: "low",
			project: "/test", archived: true,
			stories: [{ id: "E3.S1", title: "归档 Story", description: "", status: "done", tasks: [{ id: "E3.S1.T1", title: "归档 Task", status: "done" }] }],
		},
	],
};

export const MOCK_RM_2: RoadmapFile = {
	meta: { id: "rm-2", title: "另一个路线图", status: "active", created: "2026-02-01", updated: "2026-02-01", tags: ["game"] },
	epics: [
		{
			id: "E1", title: "游戏核心逻辑", description: "拼图游戏核心", status: "doing", priority: "high",
			project: "/game",
			stories: [
				{ id: "E1.S1", title: "拼图算法", description: "实现拼图匹配算法", status: "doing", tasks: [] },
			],
		},
	],
};
