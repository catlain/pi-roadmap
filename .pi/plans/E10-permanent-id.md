# Epic E10: Roadmap 永久 ID + Move 操作

## 问题

当前 roadmap 的 `id` 字段（如 `"E1.S2.T3"`）同时承担三个职责：

| 职责 | 需求 | 当前状态 |
|------|------|----------|
| **标识**（dependsOn 引用、doing-store 记录） | 永远不变 | ❌ 移动后会变 |
| **寻址**（find 定位到对象） | 能精确定位 | ✅ 但全表扫描 O(n) |
| **展示**（输出给用户看） | 跟当前层级位置一致 | ✅ |

核心矛盾：`"E2.S1.T1"` 移到 E1.S9 下应该变成 `"E1.S9.T6"`，但所有引用它的 dependsOn 都断了。

### 痛点实例

fuse-bead-puzzle 会话中，AI 需要把 E2 的 Task 搬到 E1.S9：
1. 在 E1.S9 手动 add_task × 4 次
2. 发现有重复，逐个 dropped × 4 次
3. 改 T1-T5 的 title × 5 次
4. 新建 S11，手动 add_task × 5 次
5. **总共 ~19 次工具调用**，本应 1 次 move 搞定

## 方案：分离永久 ID 和位置路径

```typescript
interface Task {
  id: number;          // 永久 ID，创建时分配，永不变
  title: string;
  dependsOn?: number[]; // 引用永久 ID，移动后无需更新
  // ...其他字段不变
}
```

**`path`（如 `"E1.S9.T3"`）不存储，完全从数组位置推导。**

每次写入后调用 `rebuildPaths(rm)` 重算所有 path，存入 JSON 作为可读缓存。
如果 path 与实际位置不一致（手动编辑 JSON 导致），读取时自动修复。

### ID 分配策略

- **全局自增**：一个 roadmap 一个计数器 `meta.nextId`
- Epic、Story、Task 共用同一个序列（保证全局唯一）
- dependsOn 存 `number[]`（永久 ID 引用）

### 向后兼容

- 工具参数 `item_id` 同时支持：
  - `"E1.S9.T3"` — 路径格式（用户习惯）
  - `"#42"` — 数字 ID 格式（精确引用）
- 旧格式 JSON 文件读取时自动迁移（分配数字 ID，dependsOn 字符串→数字）

## 拆分策略

### Phase 1: 永久 ID 基础设施

**目标**：数据模型变更 + 旧数据迁移 + 全部查找逻辑适配。不改变用户接口。

改动清单：

| # | 文件 | 改动 | 风险 |
|---|------|------|------|
| 1 | `types.ts` | Task/Story/Epic 加 `id: number`，dependsOn 改 `number[]`，RoadmapMeta 加 `nextId` | 中 |
| 2 | 新建 `id-utils.ts` | `rebuildPaths()`、`findItemById()`、`resolveItemId()`（路径或 #N → 对象）、`allocateId()` | 低 |
| 3 | `store.ts` | `readRoadmap` 加迁移逻辑：检测旧格式→分配数字 ID→转换 dependsOn→写回 | 高 |
| 4 | `validator.ts` | 适配 number id 验证、dependsOn 数字 ID 存在性检查 | 中 |
| 5 | `dependency.ts` | `findItemStatus` 改为按 number id 查找 | 中 |
| 6 | `tools-atomic-utils.ts` | `updateItem/updateTask` 适配 number dependsOn | 低 |
| 7 | `tools-atomic-logic-create.ts` | 创建时用 `allocateId()` 分配数字 ID | 中 |
| 8 | `tools-atomic-logic.ts` | archive/markDone 适配数字 ID 查找 | 中 |
| 9 | `doing-store.ts` | `DoingEntry.taskId` 改为 number，查找适配 | 中 |
| 10 | `doing-sync.ts` | 适配 number ID | 低 |
| 11 | `progress.ts` | `NextStep` 类型适配 | 低 |
| 12 | 全部 34 个测试文件 | 适配新数据格式 | 高 |

**验收标准**：
- 旧格式 JSON 文件读取时自动迁移，不丢数据
- 所有 451 个现有测试通过（数据模型变了，断言要适配）
- 新旧工具接口不变（item_id 参数仍接受 "E1.S2.T3" 格式）

### Phase 2: Move 操作 + 工具增强

**目标**：在 roadmap_update 中实现 move 操作，批量操作支持。

改动清单：

| # | 文件 | 改动 | 风险 |
|---|------|------|------|
| 1 | 新建 `tools-atomic-logic-move.ts` | move 核心逻辑：取出→插入→rebuildPaths→返回映射 | 中 |
| 2 | `tools-update-reg.ts` | 加 `move_to` 参数 | 低 |
| 3 | `tools-query-format.ts` | 输出同时显示 path 和 #id | 低 |
| 4 | `tools-query-list-reg.ts` | 列表输出适配 | 低 |
| 5 | `tools-query-show-reg.ts` | 详情输出适配 | 低 |
| 6 | `tools-plan.ts` | planner 输出适配 | 低 |
| 7 | `planner.ts` | 解析适配（plan JSON 里的 id 改为 number） | 中 |
| 8 | `injector.ts` | hint 适配 | 低 |
| 9 | `tools-action.ts` | next/plan 操作适配 | 低 |
| 10 | 新建 `move.test.ts` | move 操作端到端测试 | 低 |

**move 操作规格**：

```typescript
// 工具调用
roadmap_update(
  roadmapId: "v1-whole-canvas",
  item_id: "E2.S1.T1",       // 支持 path 或 #N
  move_to: "E1.S9",          // 目标 Story（必须是 Story 级别）
)

// 支持的场景
1. Task → 另一个 Story    item_id="E2.S1.T1", move_to="E1.S9"
2. Story → 另一个 Epic    item_id="E2.S1",    move_to="E1"
```

**不支持**：
- 批量移动（Phase 2 暂不实现，等用户反馈再加）
- Epic 级别的移动（Epic 是顶层，没有更高级别可移）

**move 后的行为**：
1. 从源数组中 splice 取出
2. 插入目标数组末尾
3. `rebuildPaths(rm)` 重算所有 path
4. 返回新旧 path 对应关系（dependsOn 不需要改，因为它是数字 ID）

**验收标准**：
- `roadmap_update(item_id="E2.S1.T3", move_to="E1.S9")` 成功移动
- 移动后所有项的 path 正确重算
- 移动后 dependsOn 引用仍然有效（数字 ID 不变）
- 源 Story 变空时提示用户
- 无效目标（如 Story 移到 Story、Task 移到 Epic 级别）报错

## 边界情况清单

| # | 场景 | 处理方式 |
|---|------|----------|
| 1 | 旧格式 JSON 无 nextId | 迁移时扫描所有 id 取 max + 1，写入 meta.nextId |
| 2 | 手动编辑 JSON 导致 path 与实际位置不一致 | readRoadmap 时检测并自动 rebuildPaths |
| 3 | 空 roadmap（无 Epic） | nextId 初始为 1 |
| 4 | doing.json 中存的是旧的字符串 taskId | 迁移时 doing.json 也要同步更新 |
| 5 | dropped 的项（有空洞） | path 会跳号（E1, E3），数字 ID 不受影响 |
| 6 | 归档的 Epic | 归档不改变 ID，path 也不变 |
| 7 | dependsOn 引用已 dropped 的项 | 行为不变——依赖检查发现 dropped 视为未满足 |
| 8 | 循环移动（A→B→A） | 数字 ID 不变，rebuildPaths 保证一致 |
| 9 | move 到自身所在位置 | 检测并返回"无需移动" |
| 10 | 项目级 roadmap 合并时的 ID 冲突 | Phase 1 暂不涉及项目级（E6 独立处理） |

## 风险

| 风险 | 等级 | 缓解 |
|------|------|------|
| 旧数据迁移丢失 | 高 | 迁移前自动备份（.bak），迁移后 validate |
| 34 个测试文件全量适配 | 中 | Phase 1 用子代理批量改，一次跑通 |
| path 缓存不一致 | 低 | readRoadmap 强制 rebuild |
| doing.json 迁移 | 中 | Phase 1 统一处理 |

## 不在范围内

- 批量 move（多 item_id 一次移）
- Epic 级别移动
- 项目级 roadmap 的 ID 冲突（E6 独立处理）
- roadmap_plan 的 plan JSON 格式变更（planner 适配但格式可兼容）
