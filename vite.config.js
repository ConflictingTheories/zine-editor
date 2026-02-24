import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
    // Load env file based on `mode` in the current working directory.
    const env = loadEnv(mode, process.cwd(), '')

    return {
        plugins: [react()],
        define: {
            // Make all VITE_ prefixed vars available globally
            __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION || '1.0.0'),
        },
        server: {
            port: 5173,
            proxy: {
                '/api': {
                    target: 'http://localhost:3000',
                    changeOrigin: true,
                    secure: false,
                },
                '/mcp': {
                    target: 'http://localhost:3000',
                    changeOrigin: true,
                    secure: false,
                }
            }
        },
        build: {
            outDir: 'dist',
            sourcemap: mode === 'development',
            minify: mode === 'production' ? 'esbuild' : false,
        },
        envPrefix: 'VITE_', // Only expose VITE_ prefixed variables
    }
})
