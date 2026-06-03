/**
 * Roadmap 数据验证辅助 — dependsOn 校验
 *
 * 兼容 string[]（旧格式）和 number[]（新格式 eid）。
 */

/**
 * 验证 dependsOn 引用
 *
 * 旧格式 string[]：检查 allIds 中是否存在
 * 新格式 number[]：检查 allEids 中是否存在
 */
export function validateDependsOn(
	dependsOn: unknown[],
	allIds: Set<string>,
	allEids: Set<number>,
	label: string,
	errors: string[],
): void {
	if (dependsOn.length === 0) return;

	if (typeof dependsOn[0] === "string") {
		for (const depId of dependsOn as string[]) {
			if (!allIds.has(depId)) {
				errors.push(`${label} dependsOn 引用了不存在的 ID "${depId}"`);
			}
		}
	} else if (typeof dependsOn[0] === "number") {
		for (const depEid of dependsOn as number[]) {
			if (!allEids.has(depEid)) {
				errors.push(`${label} dependsOn 引用了不存在的 eid #${depEid}`);
			}
		}
	}
}
