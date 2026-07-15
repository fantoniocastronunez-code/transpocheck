import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // 1. Verificamos que sea Vercel quien llama a esta ruta
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('No autorizado');
  }

  // Obtenemos dinámicamente la URL para el logo y el botón (útil por si el dominio cambia)
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  // 2. Configuramos el correo emisor
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // --- OPTIMIZACIÓN: Plantilla HTML Corporativa ---
  const htmlTemplate = `
    <div style="background-color: #0f172a; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        
        <div style="background-color: #1e293b; padding: 30px; text-align: center; border-bottom: 4px solid #3b82f6;">
          <img src="${baseUrl}/logos/LogoLogistica.png" alt="Logística TS" style="height: 50px; margin-bottom: 10px;" onerror="this.style.display='none'">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px;">SISTEMA LOGISTICAPP</h1>
        </div>

        <div style="padding: 40px 30px;">
          <h2 style="color: #0f172a; font-size: 20px; margin-top: 0;">Hola Administrador,</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #475569;">
            Este es un recordatorio automático del sistema para realizar tu <strong>Cierre de Mes</strong>.
          </p>
          <p style="font-size: 16px; line-height: 1.6; color: #475569;">
            Por favor, ingresa a la plataforma y descarga tu <strong>Reporte de Trabajos (Excel)</strong> para asegurar el respaldo de todas las operaciones realizadas.
          </p>

          <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 30px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #b45309; font-size: 14px;">
              <strong style="color: #92400e;">⚠️ AVISO IMPORTANTE:</strong><br>
              El día de mañana, a las 1:00 AM, se recomienda realizar la <strong>limpieza de la base de datos</strong>. Recuerda usar el botón "Limpiar DB" para comprimir los respaldos antiguos y liberar espacio en la nube.
            </p>
          </div>

          <div style="text-align: center; margin-top: 40px;">
            <a href="${baseUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">Ingresar al Panel ➔</a>
          </div>
        </div>

        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 12px; margin: 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Este es un mensaje generado automáticamente.</p>
        </div>
      </div>
    </div>
  `;

  // 3. Escribimos el correo
  const mailOptions = {
    from: `"Bot LogisticAPP" <${process.env.EMAIL_USER}>`,
    to: 'fcastro@logisticats.cl, hcastro@logisticats.cl', // Correos de los admins
    subject: '📊 Recordatorio: Descargar Reporte Excel - LogisticAPP',
    html: htmlTemplate,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: 'Correo enviado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}