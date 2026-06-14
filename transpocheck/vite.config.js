import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa' // <-- 1. NUEVO IMPORT

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // 2. NUEVO PLUGIN PARA MODO OFFLINE
    VitePWA({ 
      registerType: 'autoUpdate',
      workbox: {
        // Le dice al caché que guarde también tus imágenes, CSS y código
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    }) 
  ],
})