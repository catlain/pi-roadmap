/**
 * Roadmap — Task done 处理（级联 + doing 清理）
 *
 * 从 tools-update-reg.ts 拆出，减少文件体积。
 */

import { existsSync } from "node:fs";
import { clearDoing } from "./doing-store";
import { getRoadmapFilePath, readRoadmap, writeRoadmap } from "./store";
import { markTaskDone as _markTaskDone } from "./tools-atomic-logic";
import { getSessionId } from "./tools-atomic-utils";

/** Task done 处理（带级联 + doing 清理） */
export function handleTaskDone(
	roadmapId: string,
	taskId: string,
	note: string | undefined,
	_ctx: unknown,
) {
	const filePath = getRoadmapFilePath(roadmapId);
	if (!filePath || !existsSync(filePath)) {
		return {
			content: [
				{ type: "text" as const, text: `路线图 "${roadmapId}" 不存在。` },
			],
			details: {},
		};
	}

	const roadmap = readRoadmap(filePath);
	if (!roadmap) {
		return {
			content: [
				{ type: "text" as const, text: `路线图 "${roadmapId}" 读取失败。` },
			],
			details: {},
		};
	}

	const sessionId = getSessionId(_ctx);
	const { result: doneResult } = _markTaskDone(roadmap, taskId, sessionId);

	if (doneResult.includes("错误")) {
		return {
			content: [{ type: "text" as const, text: doneResult }],
			details: {},
		};
	}

	// 补充 note
	if (note) {
		for (const epic of roadmap.epics) {
			for (const story of epic.stories) {
				const task = story.tasks.find((t) => t.id === taskId);
				if (task) {
					task.note = note;
					break;
				}
			}
		}
	}

	roadmap.meta.updated = new Date().toISOString().slice(0, 10);
	writeRoadmap(filePath, roadmap);
	clearDoing(roadmapId, taskId);

	return {
		content: [
			{
				type: "text" as const,
				text: `✅ 任务 "${taskId}" 已标记完成。`,
			},
		],
		details: {},
	};
}
