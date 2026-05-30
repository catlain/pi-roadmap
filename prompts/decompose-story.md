# Story 拆解指导

你将一个 Epic 拆解为 3-7 个 Story。

## 输入
Epic: {{epicTitle}}
描述: {{epicDescription}}
项目: {{project}}

## 拆解原则

1. **每个 Story 是 1-3 天可完成的工作块**
2. **Story 有明确的交付物**：完成时能产出具体的文件/功能/文档
3. **Story 之间可以有依赖，但要在描述中标注**
4. **Story 不再标记 project**（继承 Epic 的 project）

## 每个 Story 必须包含
- id: "E1.S1", "E1.S2", ...（父 Epic 编号 + 顺序号）
- title: 名词短语，如"文档与发布准备"、"核心模块拆分"
- description: 输入是什么、产出是什么、验收标准
- status: "todo"
- planPath: "E{n}-S{m}.md"（自动生成，对应计划文档）
- tasks: []（初始为空，后续用 decompose-task 进一步拆解）

## 计划文档（plan）

每个 Story **必须**有计划文档，回答 How（怎么做）和 Acceptance（验收标准）。

创建 Story 后，你需要用 `write` 工具创建计划文档：
- **路径**：`{project}/.pi/plans/E{n}-S{m}.md`
- **模板**：参考 `plan-template-story.md`
- **命名规则**：`E{n}-S{m}.md`（Story ID 中 `.` 替换为 `-`）
- **内容**：用户故事、验收标准、实现步骤、依赖、测试计划
- **上层引用**：在文档中注明所属 Epic 计划路径：`.pi/plans/E{n}.md`

如果 Story 已有 planPath 但文件不存在，show/update 工具会提示创建。

## 拆解思路
按以下维度选择最适合的拆法：
- **按工作类型分**：文档、开发、测试、发布
- **按模块分**：如果 Epic 涉及多个独立模块
- **按阶段分**：准备 → 实现 → 验证 → 收尾

## 常见错误
- ❌ Story 太大（超过 3 天）→ 拆成更小的 Story
- ❌ Story 太小（不到半天）→ 合并到相邻 Story
- ❌ Story 之间有隐含依赖没标注 → 明确标注
- ❌ Story 缺少验收标准 → description 中必须说清"做完什么样"
