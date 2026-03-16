# Zine Editor Complete Upgrade TODO

## Phase 1: UI Polish (Clean Feel) ✅ Complete
- [x] Create TODO.md
- [x] Editor.jsx: Refactor toolbar (icons/groups, responsive)
- [x] PropertyPanel.jsx: Tabbed interface with accordions, live previews
- [x] Canvas.jsx: Multi-select, alignment guides, better snap/grid
- [x] Global: New theme system, dark/light toggle, responsive breakpoints
- [x] src/styles.css: CSS vars/animations cleanup

## Phase 2: Fix Monetization/DB ✅ Complete
- [x] CreatorMonetization.jsx: Real-time funding dashboard
- [x] server/server.cjs: Zine versioning, transactions, funding APIs
- [x] VPContext: Optimistic updates, error handling

## Phase 3: Export/Preview Overhaul
- [x] ExportModal.jsx: Live preview tab, thumbnails
- [ ] exportSystem.js: Modular HTML (ReactDOMServer), worker PDF
- [ ] New Preview.jsx: iframe sandbox

## Phase 4: Advanced Widgets/Effects/DLT
- [ ] WidgetRegistry.jsx: Full RSS/ticker/countdown
- [ ] ShaderElement.jsx/VfxSystem.jsx: Shader editor, particles
- [ ] Sovereign gates: Drag-drop, multi-token logic

## Phase 5: Missing Controls
- [ ] Bulk select/edit/delete
- [ ] Find/replace text
- [ ] Asset library browser
- [ ] Undo/redo history panel
- [ ] Collaboration (WebSockets)

## Testing/Deployment
- [ ] Test exports (PDF/HTML/interactive + shaders)
- [ ] Backend tests (funding/token gates/MCP)
- [ ] UI tests (responsive/interactions)
- [ ] Migrate existing zines
- [ ] Docker rebuild/test
- [ ] Performance optimizations
