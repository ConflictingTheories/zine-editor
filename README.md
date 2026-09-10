# SVRN Publisher - Zine Publishing Platform

SVRN Publisher is an all-in-one platform for creating, reading, and publishing interactive narrative zines. From classic layouts to branching mysteries with hidden passwords and rhythmic shaders, SVRN Publisher empowers creators to build rich digital experiences.

---

## 🚀 Key Features

### 🧠 Interactive Narrative Engine
- **Logic Branching**: Create "Go to Page", "Unlock Page", and "Password Prompt" triggers.
- **Hidden Elements**: Hide/Show elements using the `Label` system to build investigation mechanics.
- **Global Identity**: A robust unique ID system ensures element independence and selection stability.

### 🪄 Magic & Visual FX
- **Mushu Flow Shaders**: Integrated rhythmic GLSL shaders for dynamic, living backgrounds.
- **Screen VFX**: Trigger dramatic "Flash", "Lightning", "Shake", and "Pulse" effects on user interaction.
- **Theme Engine**: Support for multiple visual aesthetics (Classic, Cyberpunk, Arcane, etc.).

### 📤 Export & Portability
- **Standard HTML**: Export your zine as a standalone, responsive webpage.
- **Interactive Mode**: A premium flipbook-style export with page-turn animations and ambient sound.
- **PWA Offline Support**: Fully functional offline with local persistence and background cloud sync.

---

## 🛠 Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3.
- **Rendering**: CSS Flexbox/Grid for layout, WebGL (via Mushu-flow) for shaders.
- **Backend**: Express.js (Node.js) with SQLite3.
- **MCP Interface**: Server-side API interface exposing all editor functionalities, authentication, and detailed zine manipulation capabilities for automation and AI integrations.
- **Offline**: PWA Service Workers + LocalStorage.
- **Export**: jsPDF for print, custom templates for Interactive HTML.

---

## ⌨ Reference Guide

### Narrative Actions
| Action | Description |
| :--- | :--- |
| **Go to Page** | Instant jump to a specific page index. |
| **Unlock Page** | Permanently reveals a hidden page in the linear flow. |
| **Password Prompt** | Blocks access until the correct key (e.g., "VOID") is entered. |
| **Toggle Element** | Toggles the visibility of another object by its `Label`. |
| **VFX (Screen Effect)** | Triggers cinematic effects like Flash or Shake. |

### Keyboard Shortcuts
- `Ctrl+Z` / `Ctrl+Shift+Z`: Undo/Redo
- `Ctrl+C` / `Ctrl+V`: Copy/Paste
- `S`: Toggle Snap-to-Grid
- `G`: Toggle Grid Visibility
- `Ctrl+S`: Manual Cloud Save
- `Esc`: Deselect All

---

## 🏗 Getting Started

1. **Install Dependencies**: `npm install` or `yarn`
2. **Start the API**: `yarn server`
3. **Start the editor**: `yarn dev`
4. **Start the reader**: `yarn dev:reader`

*SVRN Publisher automatically loads a "Making your first Zine" tutorial for new voyagers.*

## Desktop Installers

The desktop builds package the frontend, local Express API, SQLite database, and migrations into installable applications. User data is stored in the operating system's application-data directory.

- `npm run dist:editor`: build the editor installer for the current platform.
- `npm run dist:reader`: build the standalone reader installer for the current platform.
- `npm run desktop -- --reader`: launch the reader locally during development.

Electron native dependencies and application signing are platform-specific. Build macOS artifacts on macOS, Windows artifacts on Windows, and Linux artifacts on Linux in release CI. Configure Apple Developer ID and Windows signing credentials before distribution.
