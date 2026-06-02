/**
 * Roadmap 工具 — 查询类工具注册（薄壳 re-export）
 *
 * 实际注册逻辑已拆分到：
 * - tools-query-list-reg.ts  → registerListTool
 * - tools-query-show-reg.ts  → registerShowTool
 * - tools-query-format.ts    → 纯格式化函数
 *
 * 搜索功能（独立模块）：
 * - tools-query-search.ts    → searchRoadmapData 纯函数
 * - tools-query-search-reg.ts → registerSearchTool
 */

export {
	formatRoadmapDetail,
	formatTimestamps,
	getLatestActivityDate,
} from "./tools-query-format";

export { registerListTool } from "./tools-query-list-reg";
export { registerShowTool } from "./tools-query-show-reg";
export { registerSearchTool } from "./tools-query-search-reg";
