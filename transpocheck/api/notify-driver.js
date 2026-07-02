import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { emails, isEdit, isService, jobDetails } = req.body;

  if (!emails || emails.length === 0) {
    return res.status(400).json({ error: 'No se enviaron correos de destino.' });
  }

  // Obtenemos el link exacto de tu aplicación en Vercel automáticamente
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

  const subject = isEdit 
    ? `🔄 ACTUALIZACIÓN: Trabajo reasignado - LogisticAPP` 
    : `📍 NUEVO TRABAJO ASIGNADO - LogisticAPP`;

  // Plantilla HTML Corporativa (Reemplazar desde aquí)
  const htmlTemplate = `
    <div style="background-color: #f3f4f6; padding: 20px 0;">
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">

        <!-- CABECERA CORPORATIVA -->
        <div style="background-color: #0f172a; padding: 16px 24px; text-align: center;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td align="left" valign="middle" width="20%">
                <img src="${baseUrl}/logo.png" alt="LogisticAPP" style="height: 36px; display: block;" />
              </td>
              <td align="center" valign="middle" width="60%">
                <span style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; font-family: 'Arial Black', Impact, sans-serif;">LogisticAPP</span>
              </td>
              <td align="right" valign="middle" width="20%">
                <img src="${baseUrl}/LogoLogistica.png" alt="Logistica TS" style="height: 36px; display: block;" />
              </td>
            </tr>
          </table>
        </div>

        <!-- CUERPO DEL CORREO -->
        <div style="padding: 32px 24px;">
          <h2 style="margin: 0 0 12px; font-size: 18px; color: #1e293b;">Nueva Asignación</h2>
          <p style="margin: 0 0 24px; font-size: 15px; color: #475569; line-height: 1.6;">
            Hola. Tienes un nuevo <strong>${isService ? 'servicio' : 'traslado'}</strong> asignado a tu nombre. Por favor, revisa los detalles a continuación y abre la aplicación para aceptarlo.
          </p>

          <!-- TARJETA DE DATOS (Estilo Corporativo) -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">

            <!-- Fila 1 -->
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
              <tr>
                <td width="50%" valign="top">
                  <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Fecha Prog.</div>
                  <div style="font-size: 14px; color: #0f172a; font-weight: bold;">${jobDetails.date}</div>
                </td>
                <td width="50%" valign="top">
                  <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Cliente</div>
                  <div style="font-size: 14px; color: #0f172a; font-weight: bold;">${jobDetails.client}</div>
                </td>
              </tr>
            </table>

            <!-- Fila 2 -->
            ${isService ? `
              <div style="margin-bottom: 20px;">
                <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Tarea Asignada</div>
                <div style="font-size: 14px; color: #0f172a; font-weight: bold;">${jobDetails.description}</div>
              </div>
            ` : `
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td width="50%" valign="top">
                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Vehículo</div>
                    <div style="font-size: 14px; color: #0f172a; font-weight: bold;">${jobDetails.vehicle}</div>
                  </td>
                  <td width="50%" valign="top">
                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Patente / VIN</div>
                    <div style="font-size: 13px; color: #0f172a; font-weight: bold; background-color: #e2e8f0; display: inline-block; padding: 3px 8px; border-radius: 4px; letter-spacing: 1px;">${jobDetails.plate}</div>
                  </td>
                </tr>
              </table>
            `}

            <!-- Fila 3: Ruta -->
            <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px;">
               <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Punto de Inicio</div>
               <div style="font-size: 14px; color: #2563eb; font-weight: bold;">${jobDetails.origin}</div>
               
               ${!isService && jobDetails.destination ? `
                 <div style="margin: 8px 0; border-left: 2px dashed #94a3b8; height: 12px; margin-left: 6px;"></div>
                 <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Destino Final</div>
                 <div style="font-size: 14px; color: #0f172a; font-weight: bold;">${jobDetails.destination}</div>
               ` : ''}
            </div>
          </div>

          <!-- BOTÓN -->
          <div style="text-align: center; margin-top: 32px;">
            <a href="${baseUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block;">
              Abrir App y Aceptar
            </a>
          </div>
        </div>

        <!-- FOOTER -->
        <div style="background-color: #f1f5f9; color: #64748b; padding: 20px; text-align: center; font-size: 12px; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0 0 4px;">Mensaje automático generado por <strong>Logística TS SpA</strong>.</p>
          <p style="margin: 0;">Por favor, no respondas a este correo.</p>
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