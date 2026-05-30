# Epic 拆解指导

你将一个大方向或愿景拆解为 2-5 个 Epic。

## 输入
{{direction}}

## 拆解原则

1. **每个 Epic 是一个独立的价值交付**：完成后可以独立展示或使用
2. **Epic 之间尽量解耦**：可以并行推进，不强制顺序
3. **粒度适中**：每个 Epic 预计 2-8 周完成
4. **有明确的完成标准**：能说清"这个 Epic 做完了"是什么状态
5. **必须对应项目**：每个 Epic 的 project 字段指向一个实际项目路径

## 每个 Epic 必须包含
- id: "E1", "E2", ...（顺序编号）
- title: 动词开头，如"发布 pi-memory npm 包"、"实现 ETF 轮动回测"
- description: 1-3 句话说清做什么、为什么做、做完后什么效果
- status: "todo"（新建 Epic 默认 todo）
- priority: "high" / "medium" / "low"
- project: 实际项目路径（必填）
- planPath: "E{n}.md"（自动生成，对应计划文档）
- stories: []（初始为空，后续用 decompose-story 进一步拆解）

## 计划文档（plan）

每个 Epic **必须**有计划文档，回答 Why（为什么做）和 What（做什么）。

创建 Epic 后，你需要用 `write` 工具创建计划文档：
- **路径**：`{project}/.pi/plans/E{n}.md`
- **模板**：参考 `plan-template-epic.md`
- **命名规则**：`E{n}.md`（Epic ID 中 `.` 保留，无短横线）
- **内容**：背景目标、成功指标、范围（含排除项）、方案概述、Story 概览、风险

如果 Epic 已有 planPath 但文件不存在，show/update 工具会提示创建。

## 优先级判断
- high: 直接影响核心目标，不做会卡住后续工作
- medium: 重要但不紧急，可以排期
- low: 锦上添花，有时间再做

## 常见错误
- ❌ Epic 太细（应该是 Story 级别）→ 合并到更大的 Epic
- ❌ Epic 太大（超过 2 个月）→ 拆分为两个 Epic
- ❌ Epic 之间强依赖 → 尽量重新组织为并行可做
- ❌ Epic 没有对应项目 → 每个必须是实际可推进的工作
