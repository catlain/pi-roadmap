# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-05-30

### Roadmap 工作流重构

这是一次较大的架构调整，核心目标是让工具匹配实际工作流，而非强推预设流程。

### Added

- **grill-me 信息充分性评估** — `roadmap_plan` 拆解前必须评估信息是否充分（目标/方案/边界三维检查），不够就追问用户，不假装理解了就动手
- **plan 沙盘推演** — `roadmap_plan` 只输出拆解方案文本，不写入 roadmap JSON。AI 看到方案后逐个 `roadmap_add` 写入
- **add 强制 planPath** — `roadmap_add` 添加 Epic/Story 时必须关联已存在的计划文档（planPath），强制先写方案再建任务
- **show 合并 search** — `roadmap_show` 新增 `query` 参数，传了就只返回匹配项，不传返回全部
- **add 合并 create** — `roadmap_add` 发现目标 roadmap 不存在时自动创建，无需单独 `roadmap_create`
- **planPath 展示验证** — 展示时验证计划文档文件是否存在，不存在标 `⚠️ 未创建`，路径改为 `.pi/plans/xxx` 相对格式
- **planPath 写入后扫描** — `roadmap_plan` 输出后扫描所有 planPath，列出不存在的文件提醒 AI 去创建

### Changed

- **12 个工具压缩到 5 个**：`roadmap_plan`、`roadmap_list`、`roadmap_show`、`roadmap_add`、`roadmap_update`
- `roadmap_add` 合并了 `add_epic` + `add_story` + `add_task`，按 `item_type` 参数区分
- `roadmap_update` 合并了 `update` + `done` + `archive`，统一支持所有层级的状态变更和属性更新
- `roadmap_show` 合并了 `show` + `search` 的功能
- 移除了 `roadmap_plan` 中的 `writeRoadmap` 逻辑，改为纯格式化输出
- 移除了 `roadmap_update` doing 时的 planPath 强制检查（没人走 doing 流程）

### Removed

- `roadmap_search` — 功能合并到 `roadmap_show`（query 参数）
- `roadmap_next` — 实际无人使用
- `roadmap_create` — 改为 `roadmap_add` 的内部自动创建
- `roadmap_add_epic` / `roadmap_add_story` / `roadmap_add_task` — 合并为 `roadmap_add`
- `roadmap_done` / `roadmap_archive` — 合并为 `roadmap_update`

### Fixed

- `resolveAbsolutePath` 未展开 `~` 为实际 home 目录，导致 planPath 文件存在性检查误判
- planPath 展示只显示文件名无路径，改为 `.pi/plans/xxx` 相对路径格式

## [1.0.0] - 2026-05-28

### Added

- 初始 npm 发布
- Epic/Story/Task 三层结构管理
- 依赖关系（dependsOn）支持
- roadmap_plan 拆解工具
- planPath 计划文档关联机制
- roadmap_search 文本搜索
- doneBySessionId 完成追踪
