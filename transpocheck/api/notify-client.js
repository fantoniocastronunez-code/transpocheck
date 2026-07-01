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
    <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #171717; border-radius: 12px; overflow: hidden; background-color: #f8fafc;">
      
      <div style="background-color: #000000; padding: 15px 20px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="left" width="25%" valign="middle">
              <div style="background-color: rgba(255,255,255,0.2); padding: 4px; border-radius: 12px; display: inline-block;">
                <img src="${baseUrl}/logo.png" alt="App Logo" style="width: 45px; height: 45px; display: block;" />
              </div>
            </td>
            <td align="center" width="50%" valign="middle">
              <h1 style="margin: 0; color: #ffffff; font-family: 'Impact', 'Arial Black', sans-serif; font-size: 26px; letter-spacing: 1px;">LogisticAPP</h1>
            </td>
            <td align="right" width="25%" valign="middle">
              <div style="background-color: rgba(255,255,255,0.2); padding: 4px; border-radius: 12px; display: inline-block;">
                <img src="${baseUrl}/LogoLogistica.png" alt="Logistica TS" style="width: 45px; height: 45px; display: block;" />
              </div>
            </td>
          </tr>
        </table>
      </div>
      
      <div style="padding: 30px;">
        <h2 style="color: #2563eb; margin-top: 0; text-align: center;">${title}</h2>
        <p style="font-size: 16px; color: #334155; line-height: 1.5;">${message}</p>
        
        <div style="background-color: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <h3 style="margin-top: 0; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Detalles del Vehículo</h3>
          <p style="margin: 10px 0; color: #475569;"><strong>Vehículo:</strong> ${jobDetails.vehicle}</p>
          <p style="margin: 10px 0; color: #475569;"><strong>Patente/VIN:</strong> ${jobDetails.plate}</p>
          <p style="margin: 10px 0; color: #475569;"><strong>Origen:</strong> ${jobDetails.origin}</p>
          ${jobDetails.destination ? `<p style="margin: 10px 0; color: #475569;"><strong>Destino:</strong> ${jobDetails.destination}</p>` : ''}
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${trackingLink}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
            ${type === 'finalizado' ? 'Ver Detalles y Descargar PDF' : 'Rastrear Estado en Vivo'}
          </a>
        </div>
      </div>
      
      <div style="background-color: #1e293b; color: #94a3b8; padding: 15px; text-align: center; font-size: 12px;">
        Este es un mensaje automático generado por Logística TS SpA.
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