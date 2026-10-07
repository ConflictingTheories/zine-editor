# SVRN Reader — Desktop App

Electron wrapper around the web reader (`apps/reader`). Fully offline: the
built reader — including the bundled PixoSpritz player — loads from `file://`.

## Prerequisites

1. Build the web reader first (this produces `dist-reader/`, which the
   desktop app packages):
   ```bash
   cd apps/reader
   npm install
   npm run build
   ```
2. Install desktop dependencies:
   ```bash
   cd apps/reader-desktop
   npm install
   ```

## Run in development

```bash
npm start
```

## Build installers

```bash
npm run dist        # current platform
npm run dist:mac    # macOS (.dmg)
npm run dist:win    # Windows (NSIS installer)
npm run dist:linux  # Linux (AppImage)
```

Output goes to `dist-reader-desktop/`.

## What the wrapper provides

- **File association**: `.svrn` / `.pxz` bundles open in the reader on
  double-click (macOS, Windows, Linux desktop entries).
- **Application menu**: Open pixozine (⌘/Ctrl+O), page navigation (←/→),
  fullscreen, reload.
- **Security**: renderer runs with `contextIsolation`, `sandbox`, and no Node
  integration. The only privileged surface is the preload context bridge
  (`window.svrnDesktop`): file-open events, page-turn events, and scoped file
  reads. The web reader detects `window.svrnDesktop` to wire OS-level
  file opens into its import flow.

## Before release

- Add icons (`build/icon.icns`, `build/icon.ico`, `build/icons/`).
- macOS: enable `hardenedRuntime` + notarization for distribution.
- Windows: code-sign the installer.
- The web reader's `window.svrnDesktop.onOpenFile` hook needs wiring into
  its import flow (currently the hook exists; the reader side is a TODO).
