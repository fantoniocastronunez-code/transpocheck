// Archivo: api/notify-admin.js (o pages/api/notify-admin.js)
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // Solo aceptamos peticiones POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Atrapamos todos los datos (los de rendición y los de trabajo nuevo)
  const { type, driverName, amount, detail, jobDetails } = req.body;

  try {
    // 1. CONFIGURA TU CORREO
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com', 
      port: process.env.EMAIL_PORT || 465, 
      secure: true,
      auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS, 
      },
    });

    let subject = '';
    let htmlTemplate = '';

    // 2. LÓGICA SEGÚN EL TIPO DE AVISO
    if (type === 'job_accepted') {
      
      // DISEÑO PARA TRABAJO ACEPTADO (Color Verde/Azul)
      subject = `🚚 Traslado Aceptado: ${jobDetails?.plate || 'Servicio'} por ${driverName}`;
      htmlTemplate = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #2563eb; margin: 0;">Traslado Asignado</h2>
            <p style="color: #64748b; margin-top: 5px;">Sistema Operativo LogisticAPP</p>
          </div>
          
          <p style="color: #334155; font-size: 16px;">Hola Equipo Admin,</p>
          <p style="color: #334155; font-size: 16px;">El conductor <strong style="color: #2563eb;">${driverName}</strong> acaba de aceptar un traslado que estaba en la lista de pendientes.</p>
          
          <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0 0 8px 0; color: #334155;"><strong>Cliente:</strong> ${jobDetails?.client || 'N/A'}</p>
            <p style="margin: 0 0 8px 0; color: #334155;"><strong>Vehículo / Tarea:</strong> ${jobDetails?.vehicle || 'N/A'}</p>
            <p style="margin: 0 0 8px 0; color: #334155;"><strong>Patente / VIN:</strong> <span style="font-weight: bold; color: #1e293b; background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${jobDetails?.plate || 'N/A'}</span></p>
            <p style="margin: 0; color: #334155;"><strong>Retiro en:</strong> ${jobDetails?.origin || 'N/A'}</p>
          </div>
          
          <div style="margin-top: 30px; text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://logisticapp.vercel.app'}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Abrir Panel de Control</a>
          </div>
        </div>
      `;

    } else {

      // DISEÑO ORIGINAL PARA RENDICIONES (Color Naranja)
      subject = `🔔 Nueva Rendición: ${driverName}`;
      htmlTemplate = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #2563eb; margin: 0;">Solicitud de Aprobación</h2>
            <p style="color: #64748b; margin-top: 5px;">Sistema de Viáticos LogisticAPP</p>
          </div>
          
          <p style="color: #334155; font-size: 16px;">Hola Equipo Admin,</p>
          <p style="color: #334155; font-size: 16px;">El conductor <strong>${driverName}</strong> ha subido un comprobante y está solicitando la revisión de su rendición de vuelto.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0 0 10px 0; color: #334155;"><strong>Monto a rendir:</strong> <span style="color: #059669; font-size: 18px; font-weight: bold;">$${amount ? amount.toLocaleString('es-CL') : 0}</span></p>
            <p style="margin: 0; color: #334155;"><strong>Detalle:</strong> ${detail || 'No especificado'}</p>
          </div>
          
          <p style="color: #334155; font-size: 16px;">Por favor, ingresen a la aplicación para ver la foto del comprobante y aprobar la transacción para que el saldo vuelva a $0.</p>
          
          <div style="margin-top: 30px; text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://logisticapp.vercel.app'}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Abrir LogisticAPP</a>
          </div>
        </div>
      `;
    }

    // 3. ENVIAMOS EL CORREO DISEÑADO A LOS DOS ADMINS
    const mailOptions = {
      from: `"LogisticAPP" <${process.env.EMAIL_USER}>`,
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