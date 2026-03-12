# Kariana Desktop — Design Document

**Date:** 2026-03-10
**Status:** Approved
**Repo:** `INGIPSA/kariana-desktop`

---

## 1. Overview

Kariana Desktop is a standalone AI assistant that connects to creative applications (Unreal Engine, Blender, Maya, Houdini, Unity, Godot) via MCP protocol, with system-level agent fallback for unsupported apps.

It is a universal MCP host — a ChatGPT-like desktop app where users chat with an AI that can control any connected DCC application.

### Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Desktop framework | **Tauri v2** | ~5MB installer, native perf, Rust backend, secure |
| Frontend | **Solid.js + Tailwind CSS** | True reactivity, fast, React-like DX |
| Backend (app logic) | **Rust** | LLM API clients, MCP host, IPC, state management |
| LLM integrations | **Native Rust HTTP clients** | Claude API, Bedrock, OpenAI-compat (LM Studio/Ollama) |
| DCC communication | **MCP protocol** | Universal standard, KARIANA plugin already speaks it |
| System-level agent | **Screen capture + input automation** | Fallback for apps without MCP plugins |
| Local storage | **SQLite (via rusqlite)** | Conversation history, settings, connection configs |
| UI style | **ChatGPT-clean + Perplexity richness** | Sidebar, model selector, rich cards, dark theme |

### Design Inspirations

- **AnythingLLM** — workspace sidebar, settings layout, LLM provider cards, dark theme
- **ChatGPT** — clean chat UX, conversation management
- **Perplexity** — rich cards, citations, expandable sections
- **Claude Code** — agent capabilities, tool execution feedback

---

## 2. Architecture

```
+-------------------------------------------------------------+
|                    KARIANA DESKTOP (Tauri v2)                |
|                                                             |
|  +-----------------------------------------------------+   |
|  |              FRONTEND (Solid.js + Tailwind)          |   |
|  |                                                     |   |
|  |  +----------+  +----------+  +------------------+   |   |
|  |  | Sidebar  |  | Chat     |  | Settings Pages   |   |   |
|  |  | - Projs  |  | - Msgs   |  | - AI Providers   |   |   |
|  |  | - Conns  |  | - Input  |  | - Connections    |   |   |
|  |  | - Search |  | - Tools  |  | - Appearance     |   |   |
|  |  +----------+  +----------+  | - Agent Skills   |   |   |
|  |                              | - Chat Settings   |   |   |
|  |                              +------------------+   |   |
|  +------------------------+----------------------------+   |
|                           | Tauri IPC (invoke/events)       |
|  +------------------------+----------------------------+   |
|  |              BACKEND (Rust)                          |   |
|  |                                                     |   |
|  |  +------------+  +------------+  +--------------+   |   |
|  |  | LLM Engine |  | MCP Host   |  | State/DB     |   |   |
|  |  | - Claude   |  | - Discover |  | - SQLite     |   |   |
|  |  | - Bedrock  |  | - Connect  |  | - Convos     |   |   |
|  |  | - Ollama   |  | - Execute  |  | - Settings   |   |   |
|  |  | - LMStudio |  | - Filter   |  | - Connections|   |   |
|  |  +------------+  +------+-----+  +--------------+   |   |
|  +------------------------------+----------------------+   |
+---------------------------------+---------------------------+
                                  | MCP Protocol (socket/stdio)
          +-----------------------+-------------------+
          |                       |                   |
  +-------+------+  +------------+---+  +------------+----+
  | Unreal Engine|  | Blender        |  | Future DCCs     |
  | (KARIANA     |  | (Future MCP    |  | Maya, Houdini   |
  |  Plugin)     |  |  addon)        |  | Unity, Godot    |
  | Port 9877    |  |                |  |                 |
  +--------------+  +----------------+  +-----------------+
```

### Data Flow (user message)

1. User types in chat input (Solid.js frontend)
2. Frontend calls Rust backend via Tauri IPC `invoke("send_message", { ... })`
3. Rust backend's **LLM Engine** sends message + conversation history to selected provider
4. LLM responds with text and/or tool calls
5. If tool calls: **MCP Host** routes them to the connected DCC's MCP server
6. Tool results go back to the LLM for the next turn (agent loop)
7. Final response streams back to frontend via Tauri events
8. Frontend renders markdown, code blocks, rich cards

### Connection Model

- **Hybrid:** Plugin bridges for deep integration (MCP), system-level agent fallback for unsupported apps
- **Smart routing:** AI analyzes the message and routes to the correct connected app automatically
- **Disambiguation:** If multiple connections could handle a request, Kariana asks the user

---

## 3. UI Structure

### Organization Model

- **Projects** = top-level (e.g., "MyGame", "Client Cinematic")
- **Threads** = chat conversations inside each project
- **Connections** = global infrastructure, managed in a separate sidebar section
- Smart routing means projects are not tied to a specific connection

### Sidebar

```
SIDEBAR
+-- KARIANA logo + version
+-- [+ New Project] button
+-- PROJECT LIST
|   +-- MyGame
|   |   +-- scene lighting (chat)
|   |   +-- blueprint help (chat)
|   |   +-- + New Chat
|   +-- Client Cinematic
|   |   +-- default
|   |   +-- + New Chat
|   +-- ...
+-- --------------------
+-- CONNECTIONS
|   +-- [green] Unreal Engine (localhost:9877)
|   +-- [gray] Blender
|   +-- + Add Connection
+-- --------------------
+-- [gear] Settings
```

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Chat | `/project/:id/chat/:threadId` | Main chat inside a project |
| Welcome | `/` | Recent projects, quick-start, connection status |
| Setup Wizard | `/setup` | Skippable onboarding (provider + first connection) |
| Project Settings | `/project/:id/settings` | Project name, notes |
| Settings: AI Providers | `/settings/providers` | LLM provider cards, API keys, model selection |
| Settings: Connections | `/settings/connections` | Manage DCC connections, ports, auto-discovery |
| Settings: Appearance | `/settings/appearance` | Theme, accent color, font size |
| Settings: Chat | `/settings/chat` | History, temperature, system prompt, max tokens |
| Settings: Agent | `/settings/agent` | Tool filter config |

### Chat Layout

```
+----------------------------------------------------------+
| [Sidebar]  |  Project: MyGame          Model: v Claude   |
|            |---------------------------------------------|
| PROJECTS   |                                             |
|            |  +-------------------------------------+    |
| v MyGame   |  | User: Move the directional light    |    |
|   lighting |  |       30 degrees to the east         |    |
|   blueprnt |  +-------------------------------------+    |
|   + New    |                                             |
|            |  +-------------------------------------+    |
| v Client   |  | Kariana: Done! Rotated via Unreal.  |    |
|   default  |  |                                      |    |
|            |  | +-- [green] Unreal Engine ----------+|    |
| ---------- |  | | > set_actor_transform             ||    |
| CONNECTIONS|  | |   DirectionalLight -> Yaw +30     ||    |
| [g] Unreal |  | +----------------------------------+|    |
| [x] Blender|  +-------------------------------------+    |
| + Add      |                                             |
| ---------- |  +-------------------------------------+    |
| [gear]     |  | Type a message...    [clip] / @ >   |    |
|            |  +-------------------------------------+    |
+----------------------------------------------------------+
```

### Chat Input Features

- Plain text messaging
- File attachments (drag-and-drop images, screenshots)
- `/commands` — slash command autocomplete popup
- `@mentions` — target specific connections or agents
- Inline code blocks
- Streaming response rendering

---

## 4. Rust Backend Modules

```
src-tauri/src/
+-- main.rs                    # Tauri app bootstrap
+-- lib.rs                     # Module declarations
+-- commands/                  # Tauri IPC command handlers
|   +-- chat.rs                # send_message, stop_generation, retry
|   +-- projects.rs            # CRUD projects & threads
|   +-- connections.rs         # add/remove/test DCC connections
|   +-- settings.rs            # get/set all settings
|   +-- providers.rs           # list/configure LLM providers
+-- llm/                       # LLM provider engine
|   +-- mod.rs                 # Provider trait definition
|   +-- claude.rs              # Anthropic Messages API (streaming)
|   +-- bedrock.rs             # AWS Bedrock Converse API
|   +-- openai_compat.rs       # OpenAI-compatible (LM Studio, Ollama)
|   +-- router.rs              # Smart model routing & fallback
|   +-- streaming.rs           # SSE/streaming token handler
+-- mcp/                       # MCP host implementation
|   +-- mod.rs                 # MCP client trait
|   +-- discovery.rs           # Auto-discover running MCP servers
|   +-- connection.rs          # Connect/disconnect to MCP servers
|   +-- executor.rs            # Execute tool calls, collect results
|   +-- router.rs              # Smart routing (which connection for which tool)
+-- agent/                     # Agent loop orchestration
|   +-- mod.rs                 # Agent trait
|   +-- loop.rs                # Message -> LLM -> tool calls -> LLM -> response
|   +-- tool_selector.rs       # Context-aware tool filtering per query
|   +-- context.rs             # Conversation context & history management
+-- db/                        # SQLite persistence
|   +-- mod.rs                 # Connection pool, migrations
|   +-- projects.rs            # Projects & threads table
|   +-- messages.rs            # Chat messages & tool results
|   +-- connections.rs         # DCC connection configs
|   +-- settings.rs            # User preferences & provider configs
+-- utils/
    +-- markdown.rs            # Server-side markdown processing
    +-- errors.rs              # Unified error types
```

### Module Responsibilities

| Module | What it does | Key trait/struct |
|--------|-------------|-----------------|
| `commands/` | Tauri IPC boundary — receives calls from Solid.js | `#[tauri::command]` functions |
| `llm/` | Talks to LLM APIs, each provider implements trait | `trait LlmProvider { async fn chat_stream(...) }` |
| `mcp/` | Connects to DCC MCP servers, discovers tools, executes | `trait McpConnection { async fn call_tool(...) }` |
| `agent/` | Runs the agent loop (message -> LLM -> tools -> done) | `struct AgentLoop { provider, connections, selector }` |
| `db/` | SQLite persistence for all app state | `struct Database { pool: Pool }` |

### Agent Loop (core flow)

```rust
async fn run_agent_loop(message: &str, context: &Context) -> Stream<AgentEvent> {
    let history = db.get_conversation_history(context.thread_id);
    let connections = mcp.get_active_connections();
    let tools = tool_selector.select_relevant(message, &connections);

    loop {
        let response = provider.chat_stream(history, tools).await;

        match response {
            TextChunk(text) => yield AgentEvent::Token(text),
            ToolCall(call) => {
                let connection = mcp_router.route(&call, &connections);
                let result = connection.execute(call).await;
                yield AgentEvent::ToolResult(connection.name, call, result);
                history.push(result);
            }
            Done => break,
        }
    }
}
```

---

## 5. Frontend Component Tree (Solid.js)

```
src/
+-- index.tsx                      # App entry, router setup
+-- App.tsx                        # Root layout (sidebar + main area)
+-- stores/                        # Solid.js reactive state
|   +-- projects.ts                # Projects & threads state
|   +-- chat.ts                    # Messages, streaming state, input
|   +-- connections.ts             # DCC connection statuses
|   +-- settings.ts                # All user preferences
|   +-- providers.ts               # LLM provider configs
+-- components/
|   +-- layout/
|   |   +-- Sidebar.tsx            # Full sidebar container
|   |   +-- ProjectList.tsx        # Collapsible project tree
|   |   +-- ConnectionList.tsx     # Connection status badges
|   |   +-- TopBar.tsx             # Project name, model selector
|   +-- chat/
|   |   +-- ChatView.tsx           # Main chat page container
|   |   +-- MessageList.tsx        # Scrollable message history
|   |   +-- MessageBubble.tsx      # Single message (user or AI)
|   |   +-- ToolCallCard.tsx       # Collapsible tool execution card
|   |   +-- ConnectionBadge.tsx    # Connection label on tool cards
|   |   +-- ChatInput.tsx          # Rich input with all features
|   |   +-- SlashCommandMenu.tsx   # /command autocomplete popup
|   |   +-- MentionMenu.tsx        # @mention autocomplete popup
|   |   +-- FileDropZone.tsx       # Drag-and-drop file attachments
|   |   +-- CodeBlock.tsx          # Syntax-highlighted code blocks
|   |   +-- StreamingIndicator.tsx # Typing/thinking animation
|   +-- settings/
|   |   +-- SettingsLayout.tsx     # Settings page with left nav
|   |   +-- ProvidersPage.tsx      # LLM provider cards + config
|   |   +-- ProviderCard.tsx       # Single provider (logo, fields)
|   |   +-- ConnectionsPage.tsx    # Manage DCC connections
|   |   +-- ConnectionForm.tsx     # Add/edit connection (URL, port)
|   |   +-- AppearancePage.tsx     # Theme, colors, font
|   |   +-- ChatSettingsPage.tsx   # Temperature, history, prompts
|   |   +-- AgentPage.tsx          # Tool filter config
|   +-- wizard/
|   |   +-- SetupWizard.tsx        # Multi-step onboarding container
|   |   +-- StepProvider.tsx       # Pick your LLM provider
|   |   +-- StepConnection.tsx     # Connect to first DCC app
|   |   +-- StepReady.tsx          # All set, start chatting
|   +-- welcome/
|   |   +-- WelcomePage.tsx        # Landing: recent projects, status
|   +-- shared/
|       +-- Button.tsx
|       +-- Input.tsx
|       +-- Select.tsx
|       +-- Toggle.tsx
|       +-- Modal.tsx
|       +-- Tooltip.tsx
|       +-- Badge.tsx
|       +-- Markdown.tsx
+-- lib/
|   +-- tauri.ts                   # Typed wrappers for invoke() calls
|   +-- events.ts                  # Tauri event listeners (streaming)
|   +-- markdown.ts                # Markdown parsing config
+-- styles/
|   +-- globals.css                # Tailwind base + CSS variables
|   +-- themes/
|       +-- dark.css               # Dark theme (default)
|       +-- light.css              # Light theme
+-- assets/
    +-- kariana-logo.svg
    +-- provider-icons/            # Claude, Ollama, LM Studio logos
```

### Styling

- Tailwind CSS utility classes for layout and spacing
- CSS variables for theming (`--bg-primary`, `--text-primary`, etc.)
- Dark theme default: deep blue-gray like AnythingLLM (`#1a1e2e` to `#252a3a`)
- Smooth transitions on theme switch
- Responsive sidebar (collapsible on narrow windows)

---

## 6. Data Models & SQLite Schema

```sql
CREATE TABLE projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    icon        TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    sort_order  INTEGER DEFAULT 0
);

CREATE TABLE threads (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title       TEXT NOT NULL DEFAULT 'New Chat',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    sort_order  INTEGER DEFAULT 0
);

CREATE TABLE messages (
    id          TEXT PRIMARY KEY,
    thread_id   TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content     TEXT NOT NULL,
    provider    TEXT,
    model       TEXT,
    created_at  INTEGER NOT NULL,
    token_count INTEGER
);

CREATE TABLE tool_calls (
    id             TEXT PRIMARY KEY,
    message_id     TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    connection_id  TEXT REFERENCES connections(id),
    tool_name      TEXT NOT NULL,
    input_json     TEXT NOT NULL,
    output_json    TEXT,
    status         TEXT NOT NULL CHECK(status IN ('pending', 'success', 'error')),
    duration_ms    INTEGER,
    created_at     INTEGER NOT NULL
);

CREATE TABLE connections (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    app_type    TEXT NOT NULL,
    protocol    TEXT NOT NULL DEFAULT 'mcp',
    host        TEXT NOT NULL DEFAULT 'localhost',
    port        INTEGER NOT NULL,
    auto_connect BOOLEAN DEFAULT true,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE providers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    provider_type TEXT NOT NULL,
    base_url    TEXT,
    api_key     TEXT,
    model       TEXT,
    is_default  BOOLEAN DEFAULT false,
    config_json TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE INDEX idx_threads_project ON threads(project_id);
CREATE INDEX idx_messages_thread ON messages(thread_id, created_at);
CREATE INDEX idx_tool_calls_message ON tool_calls(message_id);
```

### Security

- API keys encrypted at rest using OS keychain (`tauri-plugin-stronghold`)
- Never sent to frontend — backend proxies all LLM calls
- SQLite file stored in Tauri app data directory (`~/.kariana-desktop/data.db`)
- Forward-only migrations, version-tracked in `schema_version` table

---

## 7. MCP Protocol Integration

### Connection Lifecycle

1. User adds connection (app type + host + port)
2. Kariana connects via MCP `initialize` handshake
3. Discovers all tools via `tools/list`
4. Caches tool schemas locally
5. Health monitor pings every 5 seconds
6. Auto-reconnect on disconnect

### Tool Namespacing

```
Single connection:     tool names as-is
                       "set_actor_transform", "spawn_object"

Multiple connections:  prefixed with connection name
                       "unreal::set_actor_transform"
                       "blender::spawn_object"

LLM sees:             prefix tells it which app to target
Router strips:        prefix before sending to MCP server
```

### Smart Routing

```
User: "move the directional light 30 degrees"

1. LLM picks tool: set_actor_transform
2. Router checks: which connections have this tool?
   -> Unreal (yes), Blender (not connected)
3. Routes to Unreal, executes, returns result

User: "export this model to FBX and import in Blender"

1. LLM picks tools: [export_asset (Unreal), import_file (Blender)]
2. Router: export_asset -> Unreal, import_file -> Blender
3. Executes sequentially across both connections
```

### Adding Future DCCs

To add Blender support:
1. Build a Blender addon that runs an MCP server
2. User adds connection in Kariana Desktop: `localhost:9878`
3. Kariana auto-discovers Blender's tools, merges with Unreal's
4. LLM operates both apps in a single conversation

Zero changes to Kariana Desktop — just a new MCP server per DCC.

---

## 8. Implementation Phases

| Phase | Scope | Deliverable |
|-------|-------|-------------|
| **0 — Scaffold** | Tauri + Solid.js + Tailwind + SQLite. Empty shell that launches. | Running window with sidebar skeleton |
| **1 — Chat core** | Single LLM provider (Ollama). Send message, get response, render markdown. | Basic chatbot that works |
| **2 — Projects & threads** | CRUD projects, threads, message persistence. Sidebar navigation. | Full conversation management |
| **3 — MCP host** | Connect to KARIANA plugin via MCP. Discover tools. Agent loop. Tool cards. | Unreal Engine control from desktop app |
| **4 — Multi-provider** | Claude, Bedrock, LM Studio providers. Model selector. Provider settings. | Choose your LLM |
| **5 — Rich input** | Slash commands, @mentions, file attachments, drag-and-drop. | Full input experience |
| **6 — Settings suite** | All settings pages: Appearance, Chat, Agent, Connections. Themes. | Complete settings |
| **7 — Setup wizard** | Skippable onboarding flow. Auto-detect running apps. | First-run experience |
| **8 — Polish** | Animations, keyboard shortcuts, system tray, auto-update. | Production-ready |

### Phase Dependencies

```
Phase 0 (scaffold)
  +-> Phase 1 (chat core)
        +-> Phase 2 (projects & threads)
        |     +-> Phase 5 (rich input)
        |           +-> Phase 7 (wizard)
        +-> Phase 3 (MCP host)          <-- the big one
        |     +-> Phase 4 (multi-provider)
        +-> Phase 6 (settings)
              +-> Phase 8 (polish)
```

### CI/CD

- Dev builds: auto on push to `main` -> `dev-latest` pre-release
- Stable releases: manual tag -> full build -> GitHub Release + auto-update
- Tauri built-in auto-update via `tauri-plugin-updater`
- Build matrix: Windows, macOS, Linux

---

## 9. Key Dependencies

### Rust (Cargo.toml)

| Crate | Version | Purpose |
|-------|---------|---------|
| `tauri` | 2.x | Desktop framework |
| `tauri-plugin-stronghold` | 2.x | Encrypted key storage |
| `serde` / `serde_json` | 1.x | Serialization |
| `tokio` | 1.x | Async runtime |
| `rusqlite` | 0.31 | SQLite database |
| `reqwest` | 0.12 | HTTP client for LLM APIs |
| `futures` | 0.3 | Streaming support |
| `uuid` | 1.x | ID generation |
| `thiserror` | 2.x | Error handling |
| `tracing` | 0.1 | Structured logging |

### Frontend (package.json)

| Package | Purpose |
|---------|---------|
| `solid-js` | UI framework |
| `@solidjs/router` | Client-side routing |
| `solid-markdown` | Markdown rendering |
| `shiki` | Syntax highlighting |
| `tailwindcss` | Styling |
| `vite` | Build tool |
| `@tauri-apps/cli` | Tauri dev tooling |

---

## 10. Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Tauri v2 | Lightweight (~5MB), Rust backend, secure |
| Frontend | Solid.js + Tailwind | True reactivity, fast, good DX |
| Backend | Native Rust | Performance, single binary, no Python dependency |
| LLM integration | Native Rust HTTP | Clean, no sidecar process needed |
| DCC communication | MCP protocol | Universal standard, plugin already supports it |
| Organization | Projects > Threads | DCC-agnostic, user's mental model |
| Connections | Separate sidebar section | Global infrastructure, not project-specific |
| Tool routing | Fully automatic | AI picks the right connection per tool call |
| Tool selection | Smart auto-filter | AI selects relevant tools per query |
| UI style | Dark, ChatGPT + Perplexity | Clean, professional, proven UX |
| Storage | SQLite + OS keychain | Simple, portable, secure for secrets |
| Onboarding | Skippable wizard | Guided but not forced |
| Chat input | Rich (text + files + / + @) | Full-featured for power users |
| Repo | `INGIPSA/kariana-desktop` | Clear naming alongside existing repos |
