import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { email, clientName, type, jobDetails } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'No se proporcionó correo del cliente.' });
  }

  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;
  
  // EL CAMBIO ESTÁ AQUÍ: Ahora el link lleva un candado con el ID exacto del traslado (&track=...)
  const trackingLink = `${baseUrl}/?client=${encodeURIComponent(clientName)}&track=${jobDetails.id}`;

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Textos dinámicos según el estado
  let title = '';
  let subject = '';
  let message = '';

  if (type === 'asignado') {
    subject = `🚗 Traslado Agendado - Logística TS`;
    title = 'Traslado Agendado';
    message = `Hola <strong>${clientName}</strong>.<br><br>Hemos programado tu servicio. El conductor <strong>${jobDetails.driverName || 'asignado'}</strong> está en camino o próximo a dirigirse al punto de origen para iniciar el traslado.`;
  } else if (type === 'en_ruta') {
    subject = `📍 Vehículo en Ruta - Logística TS`;
    title = 'Vehículo en Ruta';
    message = `Hola <strong>${clientName}</strong>.<br><br>¡El conductor <strong>${jobDetails.driverName}</strong> ya ha retirado el vehículo y se encuentra en ruta hacia su destino!`;
  } else if (type === 'finalizado') {
    subject = `✅ Traslado Finalizado - Logística TS`;
    title = 'Traslado Finalizado';
    message = `Hola <strong>${clientName}</strong>.<br><br>El traslado de tu vehículo ha concluido exitosamente en su destino. Ya puedes revisar los detalles y descargar el Acta de Recepción (PDF).`;
  }

  const htmlTemplate = `
    <div style="font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif; max-w: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);">
      
      <div style="background: #0f172a; padding: 30px 20px; text-align: center;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" valign="middle">
              <img src="${baseUrl}/logo.png" alt="App Logo" style="width: 50px; height: 50px; display: inline-block; vertical-align: middle; margin-right: 15px; border-radius: 12px; background-color: rgba(255,255,255,0.1); padding: 5px;" />
              <h1 style="display: inline-block; vertical-align: middle; margin: 0; color: #ffffff; font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 34px; font-weight: 800; letter-spacing: 0.5px;">LogisticAPP</h1>
            </td>
          </tr>
        </table>
      </div>
      
      <div style="padding: 40px 30px; background-color: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 22px; font-weight: 700; border-left: 4px solid #2563eb; padding-left: 15px;">${title}</h2>
        <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 25px;">${message}</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; margin: 30px 0;">
          <h3 style="margin-top: 0; color: #1e293b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 20px;">Detalles del Servicio</h3>
          
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 15px; color: #334155; line-height: 1.8;">
            <tr>
              <td width="35%" style="font-weight: 600; color: #64748b; padding-bottom: 8px;">Vehículo:</td>
              <td width="65%" style="font-weight: 700; color: #0f172a; padding-bottom: 8px;">${jobDetails.vehicle}</td>
            </tr>
            <tr>
              <td style="font-weight: 600; color: #64748b; padding-bottom: 8px;">Patente/VIN:</td>
              <td style="font-weight: 700; color: #0f172a; padding-bottom: 8px;">${jobDetails.plate}</td>
            </tr>
            <tr>
              <td style="font-weight: 600; color: #64748b; padding-bottom: 8px;">Origen:</td>
              <td style="font-weight: 700; color: #0f172a; padding-bottom: 8px;">${jobDetails.origin}</td>
            </tr>
            ${jobDetails.destination ? `
            <tr>
              <td style="font-weight: 600; color: #64748b; padding-bottom: 8px;">Destino:</td>
              <td style="font-weight: 700; color: #0f172a; padding-bottom: 8px;">${jobDetails.destination}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <div style="text-align: center; margin-top: 40px; margin-bottom: 10px;">
          <a href="${trackingLink}" style="background-color: #2563eb; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; transition: background-color 0.3s; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">
            ${type === 'finalizado' ? 'Ver Detalles y Descargar PDF' : 'Rastrear Estado en Vivo'}
          </a>
        </div>
      </div>
      
      <div style="background-color: #f1f5f9; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
        <img src="${baseUrl}/LogoLogistica.png" alt="Logistica TS" style="width: auto; height: 35px; margin-bottom: 10px; opacity: 0.8;" />
        <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.5;">
          Este es un mensaje automático generado de forma segura.<br>
          <strong>Logística TS SpA</strong>
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Logística TS" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: htmlTemplate,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error enviando correo a cliente:', error);
    res.status(500).json({ error: 'Fallo al enviar correo' });
  }
}