# pi-roadmap

Project roadmap management extension for [pi-coding-agent](https://github.com/earendil-works/pi-coding-agent) — Epic/Story/Task planning, progress tracking, and task prioritization.

## What It Does

AI coding agents are great at writing code, but terrible at remembering what they're supposed to do across sessions. pi-roadmap gives your agent a **persistent, structured project plan**:

- **Epic → Story → Task hierarchy** — Break projects into manageable chunks
- **Progress tracking** — Track completion status across sessions
- **Priority inheritance** — Tasks inherit priority from parent Story/Epic
- **Next task suggestion** — Ask "what should I do next?" and get a prioritized answer
- **Cross-project tracking** — Manage roadmaps for multiple projects simultaneously

## Installation

```bash
pi install git:github.com/catlain/pi-roadmap
```

## Tools

### `roadmap_list`

List all roadmaps with progress overview. Filter by status or tag.

```
roadmap_list()
roadmap_list(status: "active")
roadmap_list(tag: "v2")
```

### `roadmap_show`

View a complete roadmap with all Epics, Stories, and Tasks.

```
roadmap_show(roadmapId: "my-project")
```

### `roadmap_plan`

Create or update roadmaps. Parses discussion content into structured Epic/Story/Task hierarchy.

```
roadmap_plan(
  roadmapId: "my-project",
  action: "create",
  content: { /* full roadmap JSON */ }
)
```

### `roadmap_next`

Get the next tasks to work on, sorted by priority (doing > todo, high > medium > low).

```
roadmap_next()
roadmap_next(roadmapId: "my-project", limit: 3)
```

### `roadmap_done`

Mark a task as completed.

```
roadmap_done(roadmapId: "my-project", taskId: "E1.S2.T3")
```

## Roadmap Structure

```json
{
  "meta": {
    "id": "my-project",
    "title": "My Project Roadmap",
    "status": "active",
    "project": "my-project"
  },
  "epics": [
    {
      "id": "E1",
      "title": "Build core feature",
      "status": "doing",
      "priority": "high",
      "stories": [
        {
          "id": "E1.S1",
          "title": "Data model design",
          "status": "done",
          "tasks": [
            {"id": "E1.S1.T1", "title": "Design schema", "status": "done"},
            {"id": "E1.S1.T2", "title": "Write migration", "status": "todo"}
          ]
        }
      ]
    }
  ]
}
```

## Priority Inheritance

Tasks without an explicit priority inherit from their parent Story, which inherits from its parent Epic:

```
Epic (high) → Story (no priority) → Task (no priority)
Result: Task gets "high" priority
```

## Storage

- **Global roadmaps**: `~/.pi/roadmap/*.roadmap.json`
- **Project roadmaps**: `<project>/.pi/roadmap/roadmap.json`

## Use Cases

- **Multi-session projects** — Pick up exactly where you left off
- **Sprint planning** — Organize work into Epics and Stories
- **Progress reports** — Show stakeholders what's done and what's next
- **Priority management** — Always know what to work on next

## Dependencies

- `@earendil-works/pi-coding-agent` — ExtensionAPI (peer)

## License

MIT
