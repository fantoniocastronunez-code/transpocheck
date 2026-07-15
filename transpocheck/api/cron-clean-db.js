export default function handler(req, res) {
  // --- OPTIMIZACIÓN: Función sincrónica (sin async) para respuesta instantánea ---
  // CRON DESACTIVADO: La limpieza de la base de datos ahora es manual desde la app ("Limpiar DB").
  
  // Evitamos que Vercel o el navegador guarden esta respuesta en caché
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  
  return res.status(200).json({ 
    success: true, 
    message: "Cron de limpieza desactivado. El proceso ahora es 100% manual.",
    timestamp: new Date().toISOString()
  });
}
