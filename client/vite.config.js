import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        viteCompression({
            algorithm: 'gzip',
            ext: '.gz',
        })
    ],
    server: {
        host: '0.0.0.0',
    },
    build: {
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom', 'react-router-dom', 'axios', 'recharts', 'lucide-react', 'file-saver', 'exceljs']
                }
            }
        }
    }
})
