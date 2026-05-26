# pi-roadmap

Project roadmap management for [pi](https://github.com/earendil-works/pi-coding-agent) — structured Epic/Story/Task planning with progress tracking, priority inheritance, and cross-session continuity.

## Why You Need It

AI coding agents are great at writing code, but terrible at remembering what they were supposed to do yesterday. pi-roadmap gives your agent a **persistent, structured project plan** that survives session restarts:

- **Epic → Story → Task hierarchy** — Break any project into actionable chunks
- **Automatic progress tracking** — Task completion cascades up to Story and Epic
- **Priority inheritance** — Tasks without explicit priority inherit from parent Story/Epic
- **"What's next?" on demand** — Get the highest-priority actionable task instantly
- **Cross-project sync** — One roadmap can span multiple projects, each getting its own filtered view
- **Session continuity** — Reminds you of in-progress tasks when a session ends

## How It Works

```
┌─────────────────────────────────────────────────┐
│                   Roadmap                        │
│  ┌─────────────────────────────────────────────┐ │
│  │ Epic E0 [high] ← maps to a project          │ │
│  │  ┌────────────────────────────────────────┐  │ │
│  │  │ Story E0.S0 [doing]                    │  │ │
│  │  │  ✅ T0: Design schema         [done]   │  │ │
│  │  │  🔄 T1: Implement storage      [doing] │  │ │
│  │  │  ⬜ T2: Write tests            [todo]   │  │ │
│  │  └────────────────────────────────────────┘  │ │
│  │  ┌────────────────────────────────────────┐  │ │
│  │  │ Story E0.S1 [todo]                     │  │ │
│  │  │  ⬜ T0: ...                   [todo]    │  │ │
│  │  └────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  Priority: Task > Story > Epic > "medium"         │
│  Statuses: todo → doing → done | blocked | dropped│
│  Auto-cascade: all Tasks done → Story done         │
│                all Stories done → Epic done         │
└───────────────────────────────────────────────────┘
```

**Core mechanisms**:

- **Priority inheritance** — Each task resolves its priority as: own > parent Story > parent Epic > `medium`
- **Status cascade** — Marking the last Task `done` automatically flips the parent Story to `done`, and the parent Epic when all its Stories are done
- **Two-level storage** — Global roadmap in `~/.pi/roadmap/`, project-level filtered view in `<project>/.pi/roadmap/`

## Installation

```bash
pi install git:github.com/catlain/pi-roadmap
```

Restart pi to activate. No configuration required.

> **Prerequisite**: [pi](https://github.com/earendil-works/pi-coding-agent) must be installed.

## Tools

### `roadmap_list` — List all roadmaps

Returns every roadmap with a progress bar and per-Epic breakdown. Optionally filter by status or tag.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status`  | string | No | Filter by status: `active` / `paused` / `completed` / `archived` |
| `tag`     | string | No | Filter by tag |

**Example output**:
```
### My Project Roadmap (active) ████████░░ 80%
ID: my-project | Tags: v2
  E0 [done/high] Core feature
    Stories: 2 | Tasks: 5/5
  E1 [doing/medium] Polish & docs
    Stories: 1 | Tasks: 2/5
```

**When to use**: Start of a session to see what's active, or to find a specific roadmap by tag.

---

### `roadmap_show` — View full roadmap details

Displays every Epic, Story, and Task with status icons, descriptions, and completion dates.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `roadmapId` | string | Yes | Roadmap ID (slug format, e.g. `"my-project"`) |

**Example output**:
```
# My Project Roadmap ████████░░ 80%
Status: active | Tags: v2

## Epic E0: Core feature [done/high]
...
  ✅ E0.S0.T1: Design schema (2025-01-15) — approved
  🔄 E0.S1.T2: Write API docs
```

**When to use**: When you need to inspect the full hierarchy, check descriptions, or find a specific task ID.

---

### `roadmap_plan` — Create or update roadmaps

Creates a new roadmap or updates an existing one. The `content` parameter takes a full roadmap JSON object following the structure below.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `roadmapId` | string | Yes | Roadmap ID (slug format, e.g. `pi-atelier-split`) |
| `action`   | string | Yes | `"create"` for new, `"update"` for existing |
| `content`  | object | Yes | Full roadmap JSON (see structure below) |

**Content structure**:

```json
{
  "meta": {
    "id": "my-project",
    "title": "My Project Roadmap",
    "status": "active",
    "created": "2025-01-15",
    "updated": "2025-01-15",
    "tags": ["v2"]
  },
  "epics": [
    {
      "id": "E0",
      "title": "Build core feature",
      "description": "What and why",
      "status": "todo",
      "priority": "high",
      "project": "my-project-dir",
      "stories": [
        {
          "id": "E0.S0",
          "title": "Data model design",
          "description": "Scope, acceptance criteria",
          "status": "todo",
          "priority": "high",
          "tasks": [
            { "id": "E0.S0.T0", "title": "Design schema", "status": "todo" },
            { "id": "E0.S0.T1", "title": "Write migration", "status": "todo" }
          ]
        }
      ]
    }
  ]
}
```

**ID format**: `E{epicIndex}` → `E{epicIndex}.S{storyIndex}` → `E{epicIndex}.S{storyIndex}.T{taskIndex}` (zero-based).

**When to use**: When the user says "let's plan", "break this down", "create a roadmap", or confirms a discussion into actionable tasks. Also for adjusting existing plans.

**Important rules**:
- `done` tasks are never modified — only `todo`/`doing`/`blocked` items are updated
- Each Epic must have a `project` field pointing to an actual project directory
- Tasks are the leaf level — no nesting below Task

---

### `roadmap_next` — Get next actionable tasks

Returns the highest-priority tasks across all active roadmaps. Sort order: `doing` first, then by priority (`high` > `medium` > `low`).

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `roadmapId` | string | No | Limit to one roadmap; omit to search all active roadmaps |
| `limit`     | number | No | Max tasks to return (default: 5) |

**Example output**:
```
## My Project Roadmap
- [doing] E1.S0.T2: Implement storage (Epic: Build core)
- [todo] E1.S1.T0: Write API docs (Epic: Polish & docs)
```

**When to use**: When you start working and want to know what to pick up next.

---

### `roadmap_done` — Mark task complete

Marks a task as `done`, cascades status to parent Story/Epic if all siblings are done, and syncs to the associated project.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `roadmapId` | string | Yes | Roadmap ID |
| `taskId`    | string | Yes | Task ID, e.g. `"E1.S2.T3"` |
| `note`      | string | No | Completion note or output link |

**Example output**:
```
✅ Task "E1.S2.T3" marked as done.
Synced to projects: my-project
```

**When to use**: When you finish a task and want to record progress.

## Storage

| Location | Path | Purpose |
|----------|------|---------|
| Global   | `~/.pi/roadmap/<id>.roadmap.json` | Full roadmap data |
| Project  | `<project>/.pi/roadmap/roadmap.json` | Filtered view for one project |
| Archive  | `~/.pi/roadmap/archive/<id>.roadmap.json` | Completed/archived roadmaps |
| Doing    | `~/.pi/roadmap/doing.json` | Tracks in-progress tasks for session-end reminders |

## Best Practices

### ✅ Recommended
- Let the agent propose a plan with `roadmap_plan`, then confirm before executing
- Use `roadmap_next` at session start to pick up where you left off
- Tag roadmaps for easy filtering (e.g. `v2`, `docs`, `infra`)
- Keep tasks small (30 min–2 hours) for meaningful progress tracking
- Add completion notes via the `note` parameter for future reference

### ❌ Not Recommended
- Don't manually edit `.roadmap.json` files — always use the tools
- Don't create tasks larger than 2 hours; break them into smaller tasks
- Don't skip `project` on Epics — cross-project sync won't work without it

## Limitations

| Limitation | Detail |
|------------|--------|
| ID format | Zero-indexed, manual assignment — no auto-increment |
| No undo | Once a task is `done`, it can't be reverted via tools |
| Single writer | No concurrency control — one agent at a time per roadmap |
| No due dates | Only priority-based ordering, no calendar scheduling |

## Architecture

```
pi-roadmap/
├── index.ts              # Entry: register tools + agent_end hook
├── lib/
│   ├── types.ts          # Type definitions, constants, priority helpers
│   ├── store.ts          # File I/O: read/write roadmap JSON
│   ├── parser.ts         # Formatting: progress bars, overview text
│   ├── progress.ts       # Logic: progress calc, next-task extraction
│   ├── validator.ts      # JSON schema validation
│   ├── planner.ts        # Plan creation/update orchestration
│   ├── sync.ts           # Global → project-level sync
│   ├── injector.ts       # before_agent_start context injection
│   ├── doing-store.ts    # In-progress task persistence
│   ├── tools-query.ts    # roadmap_list + roadmap_show
│   ├── tools-plan.ts     # roadmap_plan
│   └── tools-action.ts   # roadmap_next + roadmap_done
├── prompts/
│   ├── plan-description.md    # Tool description for roadmap_plan
│   ├── plan-output-format.md  # JSON format spec (appended to description)
│   ├── plan-diff.md           # Diff analysis guidance
│   ├── decompose-epic.md      # Epic decomposition rules
│   ├── decompose-story.md     # Story decomposition rules
│   └── decompose-task.md      # Task decomposition rules
└── package.json
```

**Dependencies**:
- `@earendil-works/pi-coding-agent` — ExtensionAPI (peer)

## License

MIT
