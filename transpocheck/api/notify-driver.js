import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { emails, isEdit, isService, jobDetails } = req.body;

  if (!emails || emails.length === 0) {
    return res.status(400).json({ error: 'No se enviaron correos de destino.' });
  }

  // Configuramos el cartero con tus credenciales de Vercel
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // Asumiendo que usas Google Workspace
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const subject = isEdit 
    ? `🔄 ACTUALIZACIÓN: Trabajo reasignado - LogisticAPP` 
    : `📍 NUEVO TRABAJO ASIGNADO - LogisticAPP`;

  // Plantilla HTML del correo
  const htmlTemplate = `
    <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #2563eb; padding: 20px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 24px;">LogisticAPP</h2>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">Notificación de Asignación</p>
      </div>
      
      <div style="padding: 30px; background-color: #f8fafc;">
        <p style="font-size: 16px; color: #334155; margin-top: 0;">Hola,</p>
        <p style="font-size: 16px; color: #334155;">El administrador te ha asignado un nuevo ${isService ? 'servicio en terreno' : 'traslado de vehículo'}. Por favor, <strong>abre la aplicación para aceptar el trabajo</strong> y confirmar tu disponibilidad.</p>
        
        <div style="background-color: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <h3 style="margin-top: 0; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Detalles de la Orden</h3>
          
          <p style="margin: 10px 0; color: #475569;"><strong>🗓️ Fecha:</strong> ${jobDetails.date}</p>
          <p style="margin: 10px 0; color: #475569;"><strong>🏢 Cliente:</strong> ${jobDetails.client}</p>
          
          ${isService ? `
            <p style="margin: 10px 0; color: #475569;"><strong>📌 Tarea:</strong> ${jobDetails.description}</p>
          ` : `
            <p style="margin: 10px 0; color: #475569;"><strong>🚗 Vehículo:</strong> ${jobDetails.vehicle}</p>
            <p style="margin: 10px 0; color: #475569;"><strong>📋 Patente/VIN:</strong> ${jobDetails.plate}</p>
          `}
          
          <p style="margin: 10px 0; color: #475569;"><strong>📍 Lugar de inicio:</strong> ${jobDetails.origin}</p>
          ${!isService && jobDetails.destination ? `<p style="margin: 10px 0; color: #475569;"><strong>🏁 Destino:</strong> ${jobDetails.destination}</p>` : ''}
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="https://transpocheck-sp86.vercel.app/" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Abrir LogisticAPP</a>
        </div>
      </div>
      
      <div style="background-color: #1e293b; color: #94a3b8; padding: 15px; text-align: center; font-size: 12px;">
        Este es un mensaje automático generado por Logística TS SpA.
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