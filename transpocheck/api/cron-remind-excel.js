import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // 1. Verificamos que sea Vercel quien llama a esta ruta y no un hacker
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('No autorizado');
  }

  // 2. Configuramos el correo emisor (Tu Gmail)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // 3. Escribimos el correo
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'fcastro@logisticats.cl, hcastro@logisticats.cl', // Correos de los admins
    subject: '📊 Recordatorio: Descargar Reporte Excel - LogisticAPP',
    text: 'Hola Administrador,\n\nEste es un recordatorio automático.\n\nRecuerda ingresar a LogisticAPP y descargar tu reporte de trabajos en formato Excel.\n\n⚠️ IMPORTANTE: El día 3 de este mes a las 1:00 AM se realizará la limpieza automática de la base de datos y todos los traslados del mes anterior serán eliminados permanentemente.\n\nSaludos,\nSistema LogisticAPP',
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: 'Correo enviado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}