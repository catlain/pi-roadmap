/**
 * doing 测试共享 — helper 函数（无 lifecycle 副作用）
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { homedir } from "node:os";

export const DOING_FILE = path.join(homedir(), ".pi", "roadmap", "doing.json");
export const ROADMAP_DIR = path.join(homedir(), ".pi", "roadmap");

/** 创建最小有效 roadmap */
export function makeRoadmap(id: string, tasks: { id: string; status: string; title?: string }[][]) {
	return {
		meta: { id, title: `测试路线图 ${id}`, status: "active", created: "2026-01-01", updated: "2026-01-01", tags: [] },
		epics: tasks.map((epicTasks, ei) => ({
			id: `E${ei}`,
			title: `Epic ${ei}`,
			description: `Epic ${ei}`,
			status: "todo",
			priority: "medium" as const,
			project: "/tmp/test",
			stories: [{
				id: `E${ei}.S0`,
				title: `Story ${ei}.0`,
				description: `Story`,
				status: "todo",
				tasks: epicTasks.map((t, ti) => ({
					id: t.id || `E${ei}.S0.T${ti}`,
					title: t.title || `Task ${ei}.0.${ti}`,
					status: t.status,
				})),
			}],
		})),
	};
}

/** 在 beforeEach 中调用：用 fs 直接清空 doing.json（避免 ESM import 缓存问题） */
export function setupCleanDoing() {
	const dir = path.dirname(DOING_FILE);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	fs.writeFileSync(DOING_FILE, "[]\n", "utf-8");
}

/** 在 afterEach 中调用：清空 doing.json + 清理测试 roadmap 文件 */
export async function cleanupDoing(createdRoadmaps: string[]) {
	const { clearAllDoing } = await import("../lib/doing-store");
	clearAllDoing();
	for (const id of createdRoadmaps) {
		const fp = path.join(ROADMAP_DIR, `${id}.roadmap.json`);
		if (fs.existsSync(fp)) fs.unlinkSync(fp);
	}
}
