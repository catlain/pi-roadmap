/**
 * Type-safe mock 工厂 — 提供合法默认值，允许 override
 *
 * 用途：让测试只传关心的字段，工厂补全必填字段
 */
import type { RoadmapMeta, Epic, Story, Task, RoadmapFile } from "../../lib/types.js";

/** 创建 RoadmapMeta */
export function makeRoadmapMeta(
	overrides: Partial<RoadmapMeta> = {},
): RoadmapMeta {
	return {
		id: "test-rm",
		title: "测试路线图",
		status: "active",
		created: "2026-01-01T00:00:00.000Z",
		updated: "2026-01-01T00:00:00.000Z",
		tags: [],
		nextEid: 1,
		...overrides,
	};
}

/** 创建 Epic */
export function makeEpic(overrides: Partial<Epic> = {}): Epic {
	return {
		id: "E1",
		eid: 1,
		title: "Epic 1",
		description: "测试 Epic",
		status: "todo",
		priority: "medium",
		project: "/test",
		stories: [],
		...overrides,
	};
}

/** 创建 Story */
export function makeStory(overrides: Partial<Story> = {}): Story {
	return {
		id: "E1.S1",
		eid: 2,
		title: "Story 1",
		description: "测试 Story",
		status: "todo",
		tasks: [],
		...overrides,
	};
}

/** 创建 Task */
export function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: "E1.S1.T1",
		eid: 3,
		title: "Task 1",
		status: "todo",
		...overrides,
	};
}

/** 创建完整 RoadmapFile */
export function makeRoadmapFile(
	overrides: Partial<RoadmapFile> = {},
): RoadmapFile {
	return {
		meta: makeRoadmapMeta(overrides.meta),
		epics: [],
		...overrides,
	};
}