import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { email, driverName, type, amount, detail, newBalance, oldAmount, newAmount } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'No se envió correo de destino.' });
  }

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

  let subject = '📌 Alerta Financiera - LogisticAPP';
  let title = 'Movimiento Financiero';
  let message = 'Se ha registrado una actualización en tus fondos.';
  let cardHtml = '';

  const formatMoneyLocal = (val) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val || 0);
  };

  if (type === 'asignacion') {
    subject = `💰 Fondo Asignado Exitosamente - LogisticAPP`;
    title = 'Asignación de Fondos';
    message = `Hola ${driverName}. Se te ha asignado un nuevo monto de viático para tus rutas.`;
    cardHtml = `
      <div style="margin-bottom: 15px;">
        <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Monto Entregado</div>
        <div style="font-size: 20px; color: #16a34a; font-weight: 800;">${formatMoneyLocal(amount)}</div>
      </div>
      <div style="margin-bottom: 5px;">
        <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Detalle</div>
        <div style="font-size: 14px; color: #0f172a; font-weight: bold;">${detail || 'Asignación de fondos'}</div>
      </div>
    `;
  } else if (type === 'nuevo_monto') {
    subject = `💵 Registro de Movimiento / Gasto - LogisticAPP`;
    title = 'Gasto Registrado';
    message = `Hola ${driverName}. Se ha registrado un nuevo movimiento o descuento en tu cuenta.`;
    cardHtml = `
      <div style="margin-bottom: 15px;">
        <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Monto del Gasto</div>
        <div style="font-size: 20px; color: #dc2626; font-weight: 800;">-${formatMoneyLocal(amount)}</div>
      </div>
      <div style="margin-bottom: 5px;">
        <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Detalle del Gasto</div>
        <div style="font-size: 14px; color: #0f172a; font-weight: bold;">${detail}</div>
      </div>
    `;
  } else if (type === 'rendicion_pendiente') {
    subject = `⏳ Comprobante de Rendición Recibido - LogisticAPP`;
    title = 'Rendición en Revisión';
    message = `Hola ${driverName}. Hemos recibido tu comprobante de rendición de vuelto. Está siendo evaluado por el administrador.`;
    cardHtml = `
      <div style="margin-bottom: 15px;">
        <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Monto Rendido</div>
        <div style="font-size: 20px; color: #d97706; font-weight: 800;">${formatMoneyLocal(amount)}</div>
      </div>
      <div style="margin-bottom: 5px;">
        <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Estado</div>
        <div style="font-size: 14px; color: #d97706; font-weight: bold;">Pendiente de Validación Administrativa</div>
      </div>
    `;
  } else if (type === 'rendicion_aprobada') {
    subject = `✅ Rendición Aprobada - Balance Limpio - LogisticAPP`;
    title = 'Rendición Aprobada';
    message = `Hola ${driverName}. El administrador ha aprobado exitosamente tu rendición de vuelto.`;
    cardHtml = `
      <div style="margin-bottom: 15px;">
        <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Monto Validado</div>
        <div style="font-size: 20px; color: #16a34a; font-weight: 800;">${formatMoneyLocal(amount)}</div>
      </div>
      <div style="margin-bottom: 5px;">
        <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Detalle</div>
        <div style="font-size: 14px; color: #0f172a; font-weight: bold;">Tu saldo ha vuelto a cero de manera conforme.</div>
      </div>
    `;
  } else if (type === 'modificacion') {
    subject = `🔄 Corrección de Registro Financiero - LogisticAPP`;
    title = 'Registro Financiero Modificado';
    message = `Hola ${driverName}. El administrador ha corregido un monto o detalle en tu historial de viáticos.`;
    cardHtml = `
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 15px;">
        <tr>
          <td width="50%" valign="top">
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Monto Anterior</div>
            <div style="font-size: 14px; color: #64748b; text-decoration: line-through;">${formatMoneyLocal(oldAmount)}</div>
          </td>
          <td width="50%" valign="top">
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Monto Nuevo</div>
            <div style="font-size: 16px; color: #2563eb; font-weight: 800;">${formatMoneyLocal(newAmount)}</div>
          </td>
        </tr>
      </table>
      <div style="margin-bottom: 5px;">
        <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">Concepto/Detalle Actualizado</div>
        <div style="font-size: 14px; color: #0f172a; font-weight: bold;">${detail}</div>
      </div>
    `;
  }

  const htmlTemplate = `
    <div style="background-color: #f3f4f6; padding: 20px 0;">
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        
        <div style="background-color: #0f172a; padding: 16px 24px; text-align: center;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td align="left" valign="middle" width="20%">
                <img src="${baseUrl}/logo.png" alt="LogisticAPP" style="height: 36px; display: block;" onError="this.style.display='none'" />
              </td>
              <td align="center" valign="middle" width="60%">
                <span style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; font-family: 'Arial Black', Impact, sans-serif;">LogisticAPP</span>
              </td>
              <td align="right" valign="middle" width="20%">
                <img src="${baseUrl}/LogoLogistica.png" alt="Logistica TS" style="height: 36px; display: block;" onError="this.style.display='none'" />
              </td>
            </tr>
          </table>
        </div>

        <div style="padding: 32px 24px;">
          <h2 style="margin: 0 0 12px; font-size: 18px; color: #1e293b;">${title}</h2>
          <p style="margin: 0 0 24px; font-size: 15px; color: #475569; line-height: 1.6;">${message}</p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
            ${cardHtml}
            
            ${newBalance !== undefined ? `
              <div style="margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 15px; background-color: #f1f5f9; padding: 10px; border-radius: 6px; text-align: right;">
                 <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 2px; letter-spacing: 0.5px;">Tu Saldo Actual en App</span>
                 <span style="font-size: 16px; color: #0f172a; font-weight: 900;">${formatMoneyLocal(newBalance)}</span>
              </div>
            ` : ''}
          </div>

          <div style="text-align: center; margin-top: 32px;">
            <a href="${baseUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block;">
              Ver mi Billetera en la App
            </a>
          </div>
        </div>

        <div style="background-color: #f1f5f9; color: #64748b; padding: 20px; text-align: center; font-size: 12px; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0 0 4px;">Mensaje automático generado por <strong>Logística TS SpA</strong>.</p>
          <p style="margin: 0;">Por favor, no respondas a este correo.</p>
        </div>

      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Finanzas LogisticAPP" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: htmlTemplate,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error enviando correo financiero:', error);
    res.status(500).json({ error: 'Fallo al enviar correo financiero' });
  }
}
