// Archivo: pages/api/notify-admin.js
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // Solo aceptamos peticiones POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { type, driverName, amount, detail } = req.body;

  try {
    // 1. CONFIGURA TU CORREO (Asegúrate de que coincida con tus otras APIs si usas algo distinto a nodemailer)
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST, 
      port: process.env.EMAIL_PORT, 
      secure: true,
      auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS, 
      },
    });

    // 2. DISEÑO DEL CORREO QUE LES LLEGARÁ A AMBOS
    const mailOptions = {
      from: `"LogisticAPP" <${process.env.EMAIL_USER}>`,
      to: 'fcastro@logisticats.cl, hcastro@logisticats.cl', // <-- AQUÍ ESTÁN LOS DOS CORREOS CONFIGURADOS
      subject: `🔔 Nueva Rendición: ${driverName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #2563eb; margin: 0;">Solicitud de Aprobación</h2>
            <p style="color: #64748b; margin-top: 5px;">Sistema de Viáticos LogisticAPP</p>
          </div>
          
          <p style="color: #334155; font-size: 16px;">Hola Equipo Admin,</p>
          <p style="color: #334155; font-size: 16px;">El conductor <strong>${driverName}</strong> ha subido un comprobante y está solicitando la revisión de su rendición de vuelto.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0 0 10px 0; color: #334155;"><strong>Monto a rendir:</strong> <span style="color: #059669; font-size: 18px; font-weight: bold;">$${amount.toLocaleString('es-CL')}</span></p>
            <p style="margin: 0; color: #334155;"><strong>Detalle:</strong> ${detail}</p>
          </div>
          
          <p style="color: #334155; font-size: 16px;">Por favor, ingresen a la aplicación para ver la foto del comprobante y aprobar la transacción para que el saldo vuelva a $0.</p>
          
          <div style="margin-top: 30px; text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://tu-dominio-en-vercel.app'}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Abrir LogisticAPP</a>
          </div>
        </div>
      `,
    };

    // 3. ENVIAR CORREO A AMBOS DESTINATARIOS
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ success: true, message: 'Correo enviado a los admins' });

  } catch (error) {
    console.error("Error al enviar correo a los admins:", error);
    return res.status(500).json({ error: 'Error enviando el correo' });
  }
}
