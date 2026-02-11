# Missing Features Implementation Plan

## Phase 1: Fix Context Menu Positioning
- [x] Update ContextMenu.jsx to position relative to canvas container instead of viewport

## Phase 2: Implement Missing Symbols
- [x] Ensure addAsset in VPContext.jsx fully handles symbols
- [x] Verify Canvas.jsx renders symbols correctly

## Phase 3: Add Blending Modes
- [x] Add blend mode selector to property panel (PropertyPanel.jsx or Editor.jsx)

## Phase 4: Improve Image Placement
- [x] Adjust objectFit in Canvas.jsx for better image handling

## Phase 5: Add Hotkeys for Layer Movement
- [x] Add keyboard event listeners for move back/forward/to back/to front (Ctrl+[ / Ctrl+] / Ctrl+Shift+[ / Ctrl+Shift+])
- [x] Implement in useEditor.js or Canvas.jsx
