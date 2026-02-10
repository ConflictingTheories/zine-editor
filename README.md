# 📖 Void Press - Zine Publishing Platform

Void Press is an all-in-one platform for creating, reading, and publishing interactive narrative zines. From classic layouts to branching mysteries with hidden passwords and rhythmic shaders, Void Press empowers creators to build rich digital experiences.

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
2. **Start Server**: `node server/server.js`
3. **Launch**: Open `index.html` in your browser.

*Void Press automatically loads a "Making your first Zine" tutorial for new voyagers.*
