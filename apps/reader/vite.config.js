import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// PIXO_ENGINE_DIR: path to the calliope-pixos checkout (engine repo).
// The player bundle imports PixozinePlayer from the engine at build time,
// so the built reader ships the player INSIDE its own package — no separate
// deploy, works offline from the same origin.
// Example: PIXO_ENGINE_DIR=~/workspace/pixo-engine/decisions npm run build
const ENGINE_DIR = process.env.PIXO_ENGINE_DIR || resolve(__dirname, '../../../pixo-engine/decisions')

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  publicDir: resolve(__dirname, '../../public'),
  resolve: {
    alias: {
      // PixozinePlayer (default export) from the engine repo.
      '@pixospritz/player': resolve(ENGINE_DIR, 'packages/core-js/src/spritz/player.js'),
    },
  },
  build: {
    outDir: resolve(__dirname, '../../dist-reader'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Main reader app
        main: resolve(__dirname, 'index.html'),
        // Bundled PixoSpritz player (loaded in a sandboxed iframe by PlayableEmbed)
        player: resolve(__dirname, 'player/index.html'),
      },
    },
  },
})
