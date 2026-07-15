import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // CACHÉ AGRESIVO EXTREMO PWA
    VitePWA({ 
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'LogoLogistica.png', 'robots.txt', 'apple-touch-icon.png'],
      
      // FORZAMOS EL COLOR NEGRO PARA LA BARRA DE NAVEGACIÓN DEL SISTEMA
      manifest: {
        name: 'LogisticAPP',
        short_name: 'LogisticAPP',
        description: 'Sistema Operativo Logístico',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        share_target: {
          action: "/",
          method: "GET",
          params: {
            title: "shared_title",
            text: "shared_text",
            url: "shared_url"
          }
        },
        icons: [
          {
            src: '/logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'],
        maximumFileSizeToCacheInBytes: 6000000, // Permite cachear archivos de hasta 6MB
        runtimeCaching: [
          {
            // Guarda las tipografías de Google Fonts para siempre en el celular
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }, // 1 año
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    }) 
  ],
  
  // --- OPTIMIZACIÓN: ESTRATEGIA DE EMPAQUETADO (CHUNKING) PARA VERCEL ---
  build: {
    target: 'esnext',
    outDir: 'dist',
    chunkSizeWarningLimit: 1500, // Evita la advertencia amarilla de Vite
    rollupOptions: {
      output: {
        // Separa las librerías grandes en archivos (chunks) individuales para que la app cargue mucho más rápido.
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/firestore', 'firebase/auth', 'firebase/storage'],
          'icons-vendor': ['lucide-react'],
          'pdf-vendor': ['jspdf', 'html2canvas']
        }
      }
    }
  },
  
  // --- OPTIMIZACIÓN: SERVIDOR DE DESARROLLO ---
  server: {
    port: 3000,
    open: true, // Abre el navegador automáticamente
  }
})
