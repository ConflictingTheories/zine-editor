/*
 * SVRN Reader — Electron main process.
 *
 * Wraps the built web reader (../reader/dist-reader) in a desktop shell:
 * - File association for .svrn / .pxz bundles (open-with + double-click).
 * - Application menu with reader shortcuts.
 * - No Node integration in the renderer; all privileged access goes through
 *   the preload context bridge.
 */

const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

const READER_DIR = path.resolve(__dirname, '../../dist-reader')
const READER_INDEX = path.join(READER_DIR, 'index.html')

let mainWindow = null
let pendingFile = null // file opened before the window was ready

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 900,
    minWidth: 720,
    minHeight: 600,
    title: 'SVRN Reader',
    backgroundColor: '#111111',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // The reader is a static build; everything (including the bundled player)
  // loads from file:// — fully offline capable.
  if (fs.existsSync(READER_INDEX)) {
    mainWindow.loadFile(READER_INDEX)
  } else {
    mainWindow.loadURL(`data:text/html,<h1 style="font-family:system-ui;color:%23eee;background:%23111;height:100vh;display:flex;align-items:center;justify-content:center;margin:0">Build the reader first: <code>npm run build</code> in apps/reader</h1>`)
  }

  // Keep navigation inside the app; external links open in the browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (pendingFile) {
    openBundleFile(pendingFile)
    pendingFile = null
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

/** Tell the renderer to import a bundle file dropped/opened at OS level. */
function openBundleFile(filePath) {
  if (!mainWindow) { pendingFile = filePath; return }
  mainWindow.webContents.send('svrn:open-file', filePath)
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open pixozine…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [{ name: 'Pixozine bundles', extensions: ['svrn', 'pxz'] }],
            })
            if (!canceled && filePaths[0]) openBundleFile(filePaths[0])
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Previous page', accelerator: 'Left', click: () => mainWindow?.webContents.send('svrn:page', -1) },
        { label: 'Next page', accelerator: 'Right', click: () => mainWindow?.webContents.send('svrn:page', 1) },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About SVRN Reader', click: () => dialog.showMessageBox(mainWindow, { message: 'SVRN Reader — read pixozines offline.' }) },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// macOS: file opened via Finder / dock.
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  openBundleFile(filePath)
})

// Windows/Linux: file path passed as argv.
const bundleArg = process.argv.slice(1).find(a => /\.(svrn|pxz)$/i.test(a))
if (bundleArg && !app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', (_event, argv) => {
  const f = argv.slice(1).find(a => /\.(svrn|pxz)$/i.test(a))
  if (f && mainWindow) { openBundleFile(f); if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus() }
})

app.whenReady().then(() => {
  buildMenu()

  // Renderer file reads (preload context bridge). Reads are scoped to files
  // the user explicitly opened — no directory browsing from the renderer.
  ipcMain.handle('svrn:read-file', async (_event, filePath) => {
    const data = await fs.promises.readFile(filePath)
    return new Uint8Array(data)
  })

  createWindow()
  if (bundleArg) openBundleFile(bundleArg)
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
