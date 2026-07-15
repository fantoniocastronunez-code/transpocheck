import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { email, clientName, type, jobDetails } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'No se proporcionó correo del cliente.' });
  }

  // --- OPTIMIZACIÓN: Obtener URL Base Dinámica ---
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;
  
  // El link lleva un candado con el ID exacto del traslado (&track=...)
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

  // --- VARIABLES DINÁMICAS Y COLORES DE ESTADO ---
  let title = '';
  let subject = '';
  let message = '';
  let accentColor = '#3b82f6'; // Azul por defecto
  let buttonText = 'Rastrear Estado en Vivo';
  
  const conductorName = jobDetails.driverName || 'asignado';
  const vehiculoDesc = jobDetails.vehicle || 'Vehículo';
  const vehiculoPatente = jobDetails.plate || 'S/N';

  // Lógica inteligente de Textos y Colores
  if (type === 'creado') {
    accentColor = '#3b82f6'; // Azul
    subject = `Nuevo Requerimiento de Traslado: ${vehiculoDesc} ${vehiculoPatente}`;
    title = 'Traslado Creado';
    message = `Hola <strong>${clientName}</strong>.<br><br>Se ha registrado exitosamente un nuevo requerimiento de traslado para su vehículo. A continuación, puede revisar los detalles iniciales de la solicitud.`;
  } else if (type === 'asignado') {
    accentColor = '#8b5cf6'; // Violeta
    subject = `Conductor Asignado: ${conductorName} para ${vehiculoDesc} ${vehiculoPatente}`;
    title = 'Conductor Asignado';
    message = `Hola <strong>${clientName}</strong>.<br><br>El conductor <strong>${conductorName}</strong> ha aceptado la solicitud y ha sido asignado oficialmente a su servicio. Pronto se dirigirá al punto de retiro.`;
  } else if (type === 'llegada_origen') {
    accentColor = '#f59e0b'; // Naranja
    subject = `El conductor ${conductorName} ha llegado al origen - ${vehiculoPatente}`;
    title = 'Vehículo en Origen';
    message = `Hola <strong>${clientName}</strong>.<br><br>Te informamos que el conductor <strong>${conductorName}</strong> ha llegado a las instalaciones acordadas y se encuentra gestionando el retiro del vehículo.`;
  } else if (type === 'en_ruta') {
    accentColor = '#0ea5e9'; // Celeste
    subject = `El conductor ${conductorName} está en ruta con el vehículo ${vehiculoPatente}`;
    title = 'Vehículo en Ruta';
    message = `Hola <strong>${clientName}</strong>.<br><br>El conductor <strong>${conductorName}</strong> ha retirado el vehículo de manera exitosa y actualmente se encuentra en ruta hacia el destino.`;
  } else if (type === 'llegada_destino') {
    accentColor = '#14b8a6'; // Turquesa
    subject = `El conductor ${conductorName} ha llegado al destino - ${vehiculoPatente}`;
    title = 'Llegada a Destino';
    message = `Hola <strong>${clientName}</strong>.<br><br>Te informamos que el conductor <strong>${conductorName}</strong> ha llegado al destino y se encuentra a la espera para realizar la entrega oficial del vehículo.`;
  } else if (type === 'finalizado') {
    accentColor = '#10b981'; // Verde Éxito
    subject = `Traslado Finalizado con Éxito - Acta de Recepción ${vehiculoPatente}`;
    title = 'Traslado Finalizado';
    message = `Hola <strong>${clientName}</strong>.<br><br>El conductor <strong>${conductorName}</strong> ha concluido el traslado con éxito. En la parte inferior de este correo, puede hacer seguimiento, revisar los detalles o descargar el <strong>Acta de Recepción (PDF)</strong> oficial.`;
    buttonText = 'Ver Detalles y Descargar PDF';
  } else if (type === 'revision_tecnica') {
    accentColor = '#6366f1'; // Indigo
    subject = `Documento de Revisión Técnica Listo - ${vehiculoPatente}`;
    title = 'Documento PRT Disponible';
    message = `Hola <strong>${clientName}</strong>.<br><br>El conductor <strong>${conductorName}</strong> ha finalizado la gestión de su revisión técnica. Tu documento oficial está listo para ser visualizado en la parte inferior de este correo.`;
    buttonText = 'Ver Detalles del Traslado';
  } else {
    // Escudo de seguridad (Fallback)
    accentColor = '#64748b'; // Gris
    subject = `Actualización de traslado: ${vehiculoDesc} ${vehiculoPatente}`;
    title = 'Actualización de Servicio';
    message = `Hola <strong>${clientName}</strong>.<br><br>Se ha registrado una actualización en el servicio realizado por el conductor <strong>${conductorName}</strong>. A continuación, los detalles del vehículo:`;
  }

  // --- BOTÓN ADICIONAL DE DOCUMENTOS FÍSICOS (PRT) ---
  let docButtonHtml = '';
  if ((type === 'finalizado' || type === 'revision_tecnica') && jobDetails?.checklist) {
     const chk = jobDetails.checklist;
     const targetUrl = chk.scandocPdf || chk.scandocPdfInbox || chk.scannerLink;
     if (targetUrl) {
        docButtonHtml = `
          <div style="margin-top: 15px;">
            <a href="${targetUrl}" target="_blank" style="background-color: #1e293b; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);">📄 Ver Documentación Escaneada</a>
          </div>
        `;
     }
  }

  // --- PLANTILLA CORPORATIVA MAESTRA ---
  const htmlTemplate = `
    <div style="background-color: #0f172a; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        
        <div style="background-color: #1e293b; padding: 30px; text-align: center; border-bottom: 4px solid ${accentColor};">
          <img src="${baseUrl}/logos/LogoLogistica.png" alt="Logística TS" style="height: 50px; margin-bottom: 10px;" onerror="this.style.display='none'">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 1px;">SISTEMA LOGISTICAPP</h1>
        </div>

        <div style="padding: 40px 30px;">
          <h2 style="color: ${accentColor}; font-size: 22px; font-weight: 900; margin-top: 0; text-align: center; text-transform: uppercase;">${title}</h2>
          
          <div style="font-size: 16px; line-height: 1.6; color: #475569; text-align: center; margin-bottom: 30px;">
            ${message}
          </div>

          <div style="background-color: #f8fafc; border-left: 4px solid ${accentColor}; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Vehículo / Tarea:</strong> ${vehiculoDesc}</p>
            <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Patente / VIN:</strong> <span style="color: #0f172a; font-weight: bold; background-color: #e2e8f0; padding: 4px 8px; border-radius: 6px;">${vehiculoPatente}</span></p>
            <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Origen:</strong> ${jobDetails.origin || 'N/A'}</p>
            ${jobDetails.destination ? `<p style="margin: 0; color: #334155; font-size: 15px;"><strong>Destino:</strong> ${jobDetails.destination}</p>` : ''}
          </div>

          <div style="text-align: center; margin-top: 40px;">
            <a href="${trackingLink}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">➔ ${buttonText}</a>
            ${docButtonHtml}
          </div>
        </div>

        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 12px; margin: 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Alerta Generada Automáticamente</p>
          <p style="color: #94a3b8; font-size: 11px; margin-top: 5px;">Logística TS SpA</p>
        </div>
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"Logística TS" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: subject,
    html: htmlTemplate,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error enviando correo a cliente:', error);
    res.status(500).json({ error: 'Fallo al enviar correo' });
  }
}