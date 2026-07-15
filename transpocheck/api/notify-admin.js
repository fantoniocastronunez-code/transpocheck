import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { type, driverName, amount, detail, jobDetails } = req.body;

  // --- OPTIMIZACIÓN: Obtener URL Base Dinámica ---
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', 
      port: 465, 
      secure: true,
      auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS, 
      },
    });

    let subject = '';
    let title = '';
    let mainContent = '';
    let accentColor = '#3b82f6'; // Azul por defecto

    // --- LÓGICA DE CONTENIDO DINÁMICA ---
    if (type === 'job_accepted') {
      accentColor = '#10b981'; // Verde para aceptados
      subject = `🚚 Traslado Aceptado: ${jobDetails?.plate || 'Servicio'} por ${driverName}`;
      title = `Traslado Asignado`;
      mainContent = `
        <p style="font-size: 16px; line-height: 1.6; color: #475569; text-align: center;">
          El conductor <strong style="color: #0f172a;">${driverName}</strong> acaba de aceptar un traslado que estaba en la lista de pendientes.
        </p>
        <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Cliente:</strong> ${jobDetails?.client || 'N/A'}</p>
          <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Vehículo / Tarea:</strong> ${jobDetails?.vehicle || 'N/A'}</p>
          <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Patente / VIN:</strong> <span style="color: #0f172a; font-weight: bold; background-color: #e2e8f0; padding: 4px 8px; border-radius: 6px;">${jobDetails?.plate || 'N/A'}</span></p>
          <p style="margin: 0; color: #334155; font-size: 15px;"><strong>Retiro en:</strong> ${jobDetails?.origin || 'N/A'}</p>
        </div>
      `;
    } else {
      accentColor = '#f59e0b'; // Naranja para rendiciones
      subject = `🔔 Nueva Rendición: ${driverName}`;
      title = `Solicitud de Aprobación`;
      mainContent = `
        <p style="font-size: 16px; line-height: 1.6; color: #475569; text-align: center;">
          El conductor <strong style="color: #0f172a;">${driverName}</strong> ha subido un comprobante y está solicitando la revisión de su rendición de vuelto.
        </p>
        <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0 0 12px 0; color: #334155; font-size: 16px;">
            <strong>Monto a rendir:</strong> 
            <span style="color: #059669; font-size: 20px; font-weight: 900; background-color: #d1fae5; padding: 4px 10px; border-radius: 8px;">
              $${amount ? amount.toLocaleString('es-CL') : 0}
            </span>
          </p>
          <p style="margin: 0; color: #334155; font-size: 15px; line-height: 1.5;"><strong>Detalle:</strong> ${detail || 'No especificado'}</p>
        </div>
        <p style="font-size: 14px; line-height: 1.6; color: #64748b; text-align: center;">
          Por favor, ingresen a la aplicación para revisar la foto del comprobante adjunto y aprobar la transacción.
        </p>
      `;
    }

    // --- PLANTILLA CORPORATIVA MAESTRA ---
    const htmlTemplate = `
      <div style="background-color: #0f172a; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          
          <div style="background-color: #1e293b; padding: 30px; text-align: center; border-bottom: 4px solid ${accentColor};">
            <img src="${baseUrl}/logos/LogoLogistica.png" alt="Logística TS" style="height: 50px; margin-bottom: 10px;" onerror="this.style.display='none'">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px;">SISTEMA LOGISTICAPP</h1>
          </div>

          <div style="padding: 40px 30px;">
            <h2 style="color: #0f172a; font-size: 22px; font-weight: 900; margin-top: 0; text-align: center; text-transform: uppercase;">${title}</h2>
            
            ${mainContent}

            <div style="text-align: center; margin-top: 40px;">
              <a href="${baseUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">Ingresar al Panel ➔</a>
            </div>
          </div>

          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 12px; margin: 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Alerta Generada Automáticamente</p>
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Bot LogisticAPP" <${process.env.EMAIL_USER}>`,
      to: 'fcastro@logisticats.cl, hcastro@logisticats.cl',
      subject: subject,
      html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
    return res.status(200).json({ success: true, message: 'Correo enviado a los admins exitosamente' });

  } catch (error) {
    console.error("Error al enviar correo a los admins:", error);
    return res.status(500).json({ error: 'Error enviando el correo' });
  }
}