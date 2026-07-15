import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { emails, isEdit, isService, jobDetails } = req.body;

  if (!emails || emails.length === 0) {
    return res.status(400).json({ error: 'No se enviaron correos de destino.' });
  }

  // --- OPTIMIZACIÓN: Obtener URL Base Dinámica ---
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Textos y colores dinámicos
  const subject = isEdit 
    ? `🔄 ACTUALIZACIÓN: Trabajo reasignado - LogisticAPP` 
    : `📍 NUEVO TRABAJO ASIGNADO - LogisticAPP`;
  
  const title = isEdit ? 'Asignación Actualizada' : 'Nueva Asignación';
  const accentColor = isEdit ? '#f59e0b' : '#3b82f6'; // Naranja si es edición, Azul si es nuevo

  // Construcción del contenido dinámico según el tipo de servicio
  let detailsHtml = '';
  
  if (isService) {
    detailsHtml = `
      <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Tarea Asignada:</strong> ${jobDetails.description}</p>
      <p style="margin: 0; color: #334155; font-size: 15px;"><strong>Punto de Inicio:</strong> <span style="color: #2563eb; font-weight: bold;">${jobDetails.origin}</span></p>
    `;
  } else {
    detailsHtml = `
      <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Vehículo / Tarea:</strong> ${jobDetails.vehicle}</p>
      <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Patente / VIN:</strong> <span style="color: #0f172a; font-weight: bold; background-color: #e2e8f0; padding: 4px 8px; border-radius: 6px;">${jobDetails.plate}</span></p>
      <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Punto de Inicio:</strong> <span style="color: #2563eb; font-weight: bold;">${jobDetails.origin}</span></p>
      ${jobDetails.destination ? `
        <div style="margin: 10px 0; border-left: 2px dashed #cbd5e1; height: 15px; margin-left: 8px;"></div>
        <p style="margin: 0; color: #334155; font-size: 15px;"><strong>Destino Final:</strong> <span style="color: #0f172a; font-weight: bold;">${jobDetails.destination}</span></p>
      ` : ''}
    `;
  }

  // --- PLANTILLA CORPORATIVA MAESTRA ---
  const logoUrl = `${baseUrl}/logo512.png`;

  const htmlTemplate = `
    <div style="background-color: #0f172a; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        
        <div style="background-color: #1e293b; padding: 30px; text-align: center; border-bottom: 4px solid ${accentColor};">
          <img src="${logoUrl}" alt="logisticAPP" style="height: 50px; width: 50px; margin-bottom: 10px;" onerror="this.style.display='none'">
          <div style="margin: 0; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span style="color: #ffffff; font-size: 24px; font-weight: 900; letter-spacing: 1px; font-family: 'Nunito', 'Segoe UI', sans-serif;">logisticAPP</span>
          </div>
        </div>

        <div style="padding: 40px 30px;">
          <h2 style="color: ${accentColor}; font-size: 22px; font-weight: 900; margin-top: 0; text-align: center; text-transform: uppercase;">${title}</h2>
          
          <div style="font-size: 16px; line-height: 1.6; color: #475569; text-align: center; margin-bottom: 30px;">
            Hola. Tienes un nuevo <strong>${isService ? 'servicio' : 'traslado'}</strong> asignado a tu nombre. Por favor, revisa los detalles a continuación.
          </div>

          <div style="background-color: #f8fafc; border-left: 4px solid ${accentColor}; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Fecha Prog.:</strong> ${jobDetails.date}</p>
            <p style="margin: 0 0 15px 0; color: #334155; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px;"><strong>Cliente:</strong> ${jobDetails.client}</p>
            ${detailsHtml}
          </div>

          <div style="text-align: center; margin-top: 40px;">
            <a href="${baseUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">Abrir App y Aceptar ➔</a>
          </div>
        </div>

        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
          <img src="${logoUrl}" alt="logisticAPP" style="height: 60px; width: 60px; display: block; margin: 0 auto 10px auto; opacity: 0.8;" onerror="this.style.display='none'" />
          <p style="color: #64748b; font-size: 12px; margin: 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Alerta Generada Automáticamente</p>
          <p style="color: #94a3b8; font-size: 11px; margin-top: 5px;">logisticAPP</p>
        </div>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Logística TS Central" <${process.env.EMAIL_USER}>`,
      to: emails.join(', '),
      subject: subject,
      html: htmlTemplate,
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error enviando correo:', error);
    res.status(500).json({ error: 'Fallo al enviar correo' });
  }
}