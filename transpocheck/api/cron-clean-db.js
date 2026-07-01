export default async function handler(req, res) {
  // CRON DESACTIVADO:
  // La limpieza automática de la base de datos ha sido desactivada.
  // Ahora el administrador mantiene un historial de 60 días y limpia la 
  // base de datos manualmente desde la aplicación usando el botón "Limpiar DB".
  
  return res.status(200).json({ 
    success: true, 
    message: "Cron de limpieza desactivado. El proceso ahora es 100% manual." 
  });
}
