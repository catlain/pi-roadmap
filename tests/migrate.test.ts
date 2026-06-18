/**
 * migrate.ts 补充测试 — 覆盖迁移主路径 + dependsOn 迁移
 */
import { describe, it, expect } from "vitest";
import { migrateToEid } from "../lib/migrate";
import type { RoadmapFile } from "../lib/types";

/** 构造一个无 eid 的旧格式 roadmap */
function makeLegacyRm(): RoadmapFile {
	return {
		meta: {
			id: "test",
			title: "Test",
			status: "active",
			created: "2025-01-01",
			updated: "2025-01-01",
			tags: [] as unknown as string[],
			nextEid: undefined as unknown as number,
		},
		epics: [
			{
				id: "E1",
				title: "Epic 1",
				description: "",
				status: "todo",
				priority: "high",
				project: "p",
				stories: [
					{
						id: "E1.S1",
						title: "Story 1",
						description: "",
						status: "todo",
						dependsOn: ["E1"] as unknown as number[], // 旧格式
						tasks: [
							{
								id: "E1.S1.T1",
								title: "Task 1",
								status: "todo",
								dependsOn: ["E1.S1"] as unknown as number[], // 旧格式
							},
						],
					} as unknown as any,
				],
			} as unknown as any,
		],
	};
}

describe("migrateToEid — 完整迁移路径", () => {
	it("旧格式：分配 eid + 迁移 dependsOn + rebuildPaths", () => {
		const rm = makeLegacyRm();
		migrateToEid(rm);

		// 分配了 eid
		expect(rm.epics[0].eid).toBe(1);
		expect(rm.epics[0].stories[0].eid).toBe(2);
		expect(rm.epics[0].stories[0].tasks[0].eid).toBe(3);

		// dependsOn 已迁移为 number[]
		expect(rm.epics[0].stories[0].dependsOn).toEqual([1]);
		expect(rm.epics[0].stories[0].tasks[0].dependsOn).toEqual([2]);

		// nextEid 已设置
		expect(rm.meta.nextEid).toBe(4);

		// rebuildPaths 已执行（id 仍是基于位置的）
		expect(rm.epics[0].id).toBe("E1");
	});

	it("已迁移格式：仅 rebuildPaths", () => {
		const rm = makeLegacyRm();
		// 先执行一次完整迁移
		migrateToEid(rm);

		// 打乱 id 位置
		rm.epics[0].id = "WRONG";
		// 再次迁移（nextEid > 0 → 只做 rebuildPaths）
		migrateToEid(rm);
		expect(rm.epics[0].id).toBe("E1"); // 重建了
	});

	it("空 dependsOn 不报错", () => {
		const rm: RoadmapFile = {
			meta: {
				id: "test",
				title: "Test",
				status: "active",
				created: "",
				updated: "",
				tags: [] as unknown as string[],
				nextEid: undefined as unknown as number,
			},
			epics: [
				{
					id: "E1",
					title: "E",
					description: "",
					status: "todo",
					priority: "high",
					project: "p",
					stories: [
						{
							id: "E1.S1",
							title: "S",
							description: "",
							status: "todo",
							tasks: [
								{ id: "E1.S1.T1", title: "T", status: "todo" },
							],
						} as unknown as any,
					],
				} as unknown as any,
			],
		};
		migrateToEid(rm);
		expect(rm.epics[0].stories[0].tasks[0].dependsOn).toBeUndefined();
	});

	it("dependsOn 引用不存在路径时过滤掉", () => {
		const rm: RoadmapFile = {
			meta: {
				id: "test",
				title: "Test",
				status: "active",
				created: "",
				updated: "",
				tags: [] as unknown as string[],
				nextEid: undefined as unknown as number,
			},
			epics: [
				{
					id: "E1",
					title: "E",
					description: "",
					status: "todo",
					priority: "high",
					project: "p",
					stories: [
						{
							id: "E1.S1",
							title: "S",
							description: "",
							status: "todo",
							dependsOn: ["E99"] as unknown as number[], // 不存在的引用
							tasks: [],
						} as unknown as any,
					],
				} as unknown as any,
			],
		};
		migrateToEid(rm);
		// 不存在的引用被过滤掉
		expect(rm.epics[0].stories[0].dependsOn).toEqual([]);
	});
});