/*
 * SVRN Reader — preload script (context bridge).
 *
 * Exposes a minimal, audited API to the renderer. The renderer runs with
 * contextIsolation + sandbox; it cannot require('fs') or touch the OS.
 * All file access goes through these channels.
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('svrnDesktop', {
  /** True when running inside the desktop wrapper (vs. the web build). */
  isDesktop: true,

  /**
   * Called with a filesystem path when the user opens a .svrn/.pxz file
   * at OS level (double-click, drag-onto-dock, File > Open).
   * Handler receives the absolute path; use svrnDesktop.readFile to load it.
   */
  onOpenFile: (handler) => ipcRenderer.on('svrn:open-file', (_event, filePath) => handler(filePath)),

  /** Page-turn requests from the application menu (delta: -1 | 1). */
  onPageTurn: (handler) => ipcRenderer.on('svrn:page', (_event, delta) => handler(delta)),

  /**
   * Read a bundle file into bytes. Returns a Promise<Uint8Array>.
   * The renderer feeds this to unpackSvrn() like any other archive source.
   */
  readFile: (filePath) => ipcRenderer.invoke('svrn:read-file', filePath),
})
