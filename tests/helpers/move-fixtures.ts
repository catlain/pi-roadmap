/**
 * Move 操作 — 共享 fixture
 */

import type { RoadmapFile } from "../lib/types";

export function makeMoveRoadmap(): RoadmapFile {
	return {
		meta: {
			id: "test-rm",
			title: "测试路线图",
			status: "active",
			created: "2026-01-01",
			updated: "2026-01-01",
			tags: [],
			nextEid: 100,
		},
		epics: [
			{
				id: "E1",
				eid: 1,
				title: "Epic 1",
				description: "",
				status: "todo",
				priority: "high",
				project: "proj-a",
				stories: [
					{
						id: "E1.S1",
						eid: 10,
						title: "Story 1-1",
						description: "",
						status: "todo",
						tasks: [
							{ id: "E1.S1.T1", eid: 100, title: "Task A", status: "todo" },
							{ id: "E1.S1.T2", eid: 101, title: "Task B", status: "todo" },
						],
					},
					{
						id: "E1.S2",
						eid: 11,
						title: "Story 1-2",
						description: "",
						status: "todo",
						tasks: [
							{ id: "E1.S2.T1", eid: 102, title: "Task C", status: "todo" },
						],
					},
				],
			},
			{
				id: "E2",
				eid: 2,
				title: "Epic 2",
				description: "",
				status: "todo",
				priority: "medium",
				project: "proj-b",
				stories: [
					{
						id: "E2.S1",
						eid: 20,
						title: "Story 2-1",
						description: "",
						status: "todo",
						tasks: [
							{ id: "E2.S1.T1", eid: 200, title: "Task X", status: "todo" },
							{ id: "E2.S1.T2", eid: 201, title: "Task Y", status: "doing" },
							{ id: "E2.S1.T3", eid: 202, title: "Task Z", status: "todo" },
						],
					},
				],
			},
		],
	};
}
