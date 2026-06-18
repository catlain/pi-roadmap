/**
 * 搜索功能的测试数据 fixtures（用工厂补全必填字段）
 */
import {
	makeRoadmapFile,
	makeEpic,
	makeStory,
	makeTask,
} from "../helpers/test-factories.js";
import type { RoadmapFile } from "../../lib/types";

export const MOCK_RM: RoadmapFile = makeRoadmapFile({
	meta: {
		id: "rm-1",
		title: "扩展生态路线图",
		status: "active",
		created: "2026-01-01",
		updated: "2026-01-01",
		tags: ["pi", "extensions"],
		nextEid: 8,
	},
	epics: [
		makeEpic({
			id: "E1",
			eid: 1,
			title: "重构 roadmap 数据模型",
			description: "改造 roadmap 为读取时合并模式",
			status: "doing",
			priority: "high",
			project: "/test",
			stories: [
				makeStory({
					id: "E1.S1",
					eid: 2,
					title: "设计合并策略",
					description: "设计项目级 roadmap 文件格式与合并策略",
					status: "done",
					tasks: [
						makeTask({
							id: "E1.S1.T1",
							eid: 3,
							title: "调研 shepherd 合并方案",
							status: "done",
						}),
						makeTask({
							id: "E1.S1.T2",
							eid: 4,
							title: "产出设计文档",
							status: "done",
						}),
					],
				}),
				makeStory({
					id: "E1.S2",
					eid: 5,
					title: "实现核心改造",
					description: "实现 readMergedRoadmap 合并读取函数",
					status: "todo",
					tasks: [
						makeTask({
							id: "E1.S2.T1",
							eid: 6,
							title: "删除 sync 机制",
							status: "todo",
							note: "参考 jiti 缓存清理方案",
						}),
					],
				}),
			],
		}),
		makeEpic({
			id: "E2",
			eid: 7,
			title: "MCP 协议增强",
			description: "增强 mcp-lite 的工具发现能力",
			status: "todo",
			priority: "medium",
			project: "/test",
			stories: [
				makeStory({
					id: "E2.S1",
					eid: 8,
					title: "动态工具注册",
					description: "实现 MCP 工具动态注册",
					status: "todo",
					tasks: [
						makeTask({
							id: "E2.S1.T1",
							eid: 9,
							title: "实现工具发现",
							status: "todo",
						}),
					],
				}),
			],
		}),
		makeEpic({
			id: "E3",
			eid: 10,
			title: "已归档的 Epic",
			description: "归档测试用",
			status: "done",
			priority: "low",
			project: "/test",
			archived: true,
			stories: [
				makeStory({
					id: "E3.S1",
					eid: 11,
					title: "归档 Story",
					description: "",
					status: "done",
					tasks: [
						makeTask({
							id: "E3.S1.T1",
							eid: 12,
							title: "归档 Task",
							status: "done",
						}),
					],
				}),
			],
		}),
	],
});

export const MOCK_RM_2: RoadmapFile = makeRoadmapFile({
	meta: {
		id: "rm-2",
		title: "另一个路线图",
		status: "active",
		created: "2026-02-01",
		updated: "2026-02-01",
		tags: ["game"],
		nextEid: 4,
	},
	epics: [
		makeEpic({
			id: "E1",
			eid: 1,
			title: "游戏核心逻辑",
			description: "拼图游戏核心",
			status: "doing",
			priority: "high",
			project: "/game",
			stories: [
				makeStory({
					id: "E1.S1",
					eid: 2,
					title: "拼图算法",
					description: "实现拼图匹配算法",
					status: "doing",
					tasks: [],
				}),
			],
		}),
	],
});