# Kariana Desktop (AnythingLLM Fork) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fork AnythingLLM and rebrand it as Kariana Desktop — same structure, same features, Kariana identity.

**Architecture:** Fork the MIT-licensed AnythingLLM monorepo (React + Express + SQLite). Rebrand all visual and textual references. Customize the color palette to Kariana's deep blue-gray theme. Run as a web app (frontend + server + collector).

**Tech Stack:** React 18, Vite, Tailwind CSS, Node.js/Express, Prisma/SQLite, LangChain

---

## Decision Log

- **Why fork instead of Tauri?** AnythingLLM has a mature, feature-complete UI with 35+ LLM providers, workspace management, document RAG, agents, and MCP support. Building this from scratch in Tauri/Solid.js would take months. The fork gives us a working product immediately.
- **Desktop packaging:** The open-source repo is web-only. Electron packaging can be added later. For now, we run as a local web app on localhost (same as self-hosted mode).
- **DCC/MCP features:** Will be added in a future phase on top of the fork's existing MCP client support.

---

### Task 1: Fork and Clone

Fork `Mintplex-Labs/anything-llm` to `INGIPSA` GitHub org as `kariana-anythingllm`. Clone to `D:/Developer/Kariana/kariana-anythingllm`.

### Task 2: Rebrand Logos & Icons

Replace all image assets:
- `frontend/public/favicon.png` and `favicon.ico`
- `frontend/src/media/logo/anything-llm.png` (sidebar logo dark)
- `frontend/src/media/logo/anything-llm-dark.png` (sidebar logo light)
- `frontend/src/media/logo/anything-llm-icon.png` (square icon)
- `frontend/src/media/illustrations/login-logo.svg`

Generate Kariana-branded SVG logos programmatically.

### Task 3: Rebrand Text

Find-replace "AnythingLLM" → "Kariana" across:
- Root, frontend, server `package.json`
- `frontend/index.html` (title, meta tags)
- `frontend/public/manifest.json`
- `server/utils/boot/MetaGenerator.js`
- `frontend/src/LogoContext.jsx`
- English locale files in `frontend/src/locales/en/`
- URLs: `anythingllm.com` → remove or replace

### Task 4: Customize Color Theme

Update `frontend/src/index.css` CSS variables:
- Primary bg: `#0f1729` (deep navy)
- Secondary bg: `#1a2332`
- Sidebar: `#0c1220`
- Accent/CTA: `#6366f1` (indigo) or `#818cf8`
- Text: white/light gray

Update `frontend/tailwind.config.js` named colors to match.

### Task 5: Install & Run

```bash
cd kariana-anythingllm
yarn setup       # or npm install in each directory
yarn dev:server  # Express API on port 3001
yarn dev:frontend # Vite on port 3000
```

Verify rebranded app at http://localhost:3000
