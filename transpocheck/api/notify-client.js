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

  // Textos dinámicos según el estado y requerimientos del cliente
  let title = '';
  let subject = '';
  let message = '';
  
  // Extraemos variables clave para no repetir código
  const conductorName = jobDetails.driverName || 'asignado';
  const vehiculoDesc = jobDetails.vehicle || 'Vehículo';
  const vehiculoPatente = jobDetails.plate || 'S/N';

  if (type === 'creado') {
    subject = `Nuevo Requerimiento de Traslado: ${vehiculoDesc} ${vehiculoPatente}`;
    title = 'Traslado Creado';
    message = `Hola <strong>${clientName}</strong>.<br><br>Se ha registrado exitosamente un nuevo requerimiento de traslado para su vehículo. A continuación, puede revisar los detalles iniciales de la solicitud:`;
  } else if (type === 'asignado') {
    subject = `Conductor Asignado: ${conductorName} para ${vehiculoDesc} ${vehiculoPatente}`;
    title = 'Conductor Asignado';
    message = `Hola <strong>${clientName}</strong>.<br><br>El conductor <strong>${conductorName}</strong> ha aceptado la solicitud y ha sido asignado oficialmente a su servicio. Pronto se dirigirá al punto de retiro.`;
  } else if (type === 'llegada_origen') {
    subject = `El conductor ${conductorName} ha llegado al origen - ${vehiculoPatente}`;
    title = 'Vehículo en Origen';
    message = `Hola <strong>${clientName}</strong>.<br><br>Te informamos que el conductor <strong>${conductorName}</strong> ha llegado a las instalaciones acordadas y se encuentra gestionando el retiro del vehículo.`;
  } else if (type === 'en_ruta') {
    subject = `El conductor ${conductorName} está en ruta con el vehículo ${vehiculoPatente}`;
    title = 'Vehículo en Ruta';
    message = `Hola <strong>${clientName}</strong>.<br><br>El conductor <strong>${conductorName}</strong> ha retirado el vehículo de manera exitosa y actualmente se encuentra en ruta hacia el destino.`;
  } else if (type === 'llegada_destino') {
    subject = `El conductor ${conductorName} ha llegado al destino - ${vehiculoPatente}`;
    title = 'Llegada a Destino';
    message = `Hola <strong>${clientName}</strong>.<br><br>Te informamos que el conductor <strong>${conductorName}</strong> ha llegado al destino y se encuentra a la espera para realizar la entrega oficial del vehículo.`;
  } else if (type === 'finalizado') {
    subject = `Traslado Finalizado con Éxito - Acta de Recepción ${vehiculoPatente}`;
    title = 'Traslado Finalizado';
    message = `Hola <strong>${clientName}</strong>.<br><br>El conductor <strong>${conductorName}</strong> ha concluido el traslado con éxito. En la parte inferior de este correo, puede hacer seguimiento, revisar detalles o descargar el Acta de Recepción (PDF) oficial.`;
  } else {
    // Escudo de seguridad (Fallback): Si Firebase envía un estado desconocido, el asunto jamás volverá a estar vacío.
    subject = `Actualización de traslado: ${vehiculoDesc} ${vehiculoPatente}`;
    title = 'Actualización de Servicio';
    message = `Hola <strong>${clientName}</strong>.<br><br>Se ha registrado una actualización en el servicio realizado por el conductor <strong>${conductorName}</strong>. A continuación, los detalles del vehículo:`;
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
        <h2 style="color: #0f172a; margin-top: 0; font-size: 22px; font-weight: 700; border-left: 4px solid #2563eb; padding-left: 15px; margin-bottom: 20px;">${title}</h2>
        
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
        <img src="${baseUrl}/LogoLogistica.png" alt="Logistica TS" width="140" style="display: block; margin: 0 auto 10px auto; opacity: 0.8; max-width: 100%; height: auto;" />
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