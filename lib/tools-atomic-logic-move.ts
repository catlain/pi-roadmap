/**
 * Roadmap 原子操作 — Move 逻辑
 *
 * 将 Task/Story 从一个容器移动到另一个容器。
 * 移动后 rebuildPaths 重算路径，dependsOn（eid）不受影响。
 */

import { rebuildPaths, resolveItemId } from "./id-utils";
import type { Epic, RoadmapFile, Story, Task } from "./types";

/**
 * 移动一个项到新容器
 *
 * 支持的场景：
 *   - Task → 另一个 Story：item_id 是 Task，move_to 是 Story path
 *   - Story → 另一个 Epic：item_id 是 Story，move_to 是 Epic path
 *
 * @returns 成功/错误消息
 */
export function moveItem(
	rm: RoadmapFile,
	itemId: string,
	targetPath: string,
): string {
	// 1. 解析源项
	const source = resolveItemId(rm, itemId);
	if (!source) return `❌ 项目 "${itemId}" 不存在。`;

	// 2. 解析目标容器
	const target = resolveItemId(rm, targetPath);
	if (!target) return `❌ 目标 "${targetPath}" 不存在。`;

	// 3. 层级检查 + 执行移动
	if (source.task) {
		// Task 必须移到 Story
		if (!target.story) {
			return `❌ Task 只能移动到 Story 级别，"${targetPath}" 不是 Story。`;
		}
		if (!source.story) {
			return `❌ 内部错误：找不到 Task 的源 Story。`;
		}
		return moveTask(rm, source.task, source.story, target.story);
	}

	if (source.story) {
		// Story 必须移到 Epic
		if (!target.epic || target.story || target.task) {
			return `❌ Story 只能移动到 Epic 级别，"${targetPath}" 不是 Epic。`;
		}
		return moveStory(rm, source.story, source.epic, target.epic);
	}

	// Epic 不能移动
	return `❌ Epic 不能移动（顶层项目没有更高级别容器）。`;
}

/** 移动 Task 到另一个 Story */
function moveTask(
	rm: RoadmapFile,
	task: Task,
	sourceStory: Story,
	targetStory: Story,
): string {
	// 自身检查
	if (sourceStory.eid === targetStory.eid) {
		return `ℹ️ Task "${task.title}" (#${task.eid}) 已在 Story ${targetStory.id} 中，无需移动。`;
	}

	const oldPath = task.id;

	// 从源 Story 取出
	const taskIdx = sourceStory.tasks.findIndex((t) => t.eid === task.eid);
	if (taskIdx === -1) return `❌ 内部错误：找不到 Task。`;
	const [removed] = sourceStory.tasks.splice(taskIdx, 1);

	// 放入目标 Story
	targetStory.tasks.push(removed);

	// 重建路径
	rebuildPaths(rm);

	const remaining = sourceStory.tasks.length;
	const result = [
		`✅ 移动完成：`,
		`  "${removed.title}" (#${removed.eid}): ${oldPath} → ${removed.id}`,
		``,
		`源 Story ${sourceStory.id} 剩余 ${remaining} 个 Task`,
	];
	if (remaining === 0) {
		result.push(`⚠️ 源 Story 已空，可考虑删除或标记 dropped。`);
	}

	return result.join("\n");
}

/** 移动 Story 到另一个 Epic */
function moveStory(
	rm: RoadmapFile,
	story: Story,
	sourceEpic: Epic,
	targetEpic: Epic,
): string {
	// 自身检查
	if (sourceEpic.eid === targetEpic.eid) {
		return `ℹ️ Story "${story.title}" (#${story.eid}) 已在 Epic ${targetEpic.id} 中，无需移动。`;
	}

	const oldPath = story.id;

	// 从源 Epic 取出
	const storyIdx = sourceEpic.stories.findIndex((s) => s.eid === story.eid);
	if (storyIdx === -1) return `❌ 内部错误：找不到 Story。`;
	const [removed] = sourceEpic.stories.splice(storyIdx, 1);

	// 放入目标 Epic
	targetEpic.stories.push(removed);

	// 重建路径
	rebuildPaths(rm);

	const remaining = sourceEpic.stories.length;
	const taskCount = removed.tasks.length;
	const result = [
		`✅ 移动完成：`,
		`  "${removed.title}" (#${removed.eid}): ${oldPath} → ${removed.id}（含 ${taskCount} 个 Task）`,
		``,
		`源 Epic ${sourceEpic.id} 剩余 ${remaining} 个 Story`,
	];
	if (remaining === 0) {
		result.push(`⚠️ 源 Epic 已空，可考虑删除或标记 dropped。`);
	}

	return result.join("\n");
}
