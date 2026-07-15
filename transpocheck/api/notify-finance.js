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
  
  // --- optimización: variable de color dinámico ---
  let accentcolor = '#3b82f6'; // azul por defecto

  const formatmoneylocal = (val) => {
    return new intl.numberformat('es-cl', { style: 'currency', currency: 'clp' }).format(val || 0);
  };

  // --- LÓGICA Y COLORES ---
  if (type === 'asignacion') {
    accentcolor = '#10b981'; // verde
    subject = `💰 fondo asignado exitosamente - logisticapp`;
    title = 'asignación de fondos';
    message = `hola <strong>${drivername}</strong>.<br><br>se te ha asignado un nuevo monto de viático para tus rutas.`;
    cardhtml = `
      <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>monto entregado:</strong> <span style="color: #10b981; font-weight: 900; font-size: 18px;">${formatmoneylocal(amount)}</span></p>
      <p style="margin: 0; color: #334155; font-size: 15px;"><strong>Detalle:</strong> ${detail || 'Asignación de fondos'}</p>
    `;
  } else if (type === 'nuevo_monto') {
    accentColor = '#ef4444'; // Rojo
    subject = `💵 Registro de Movimiento / Gasto - logisticAPP`;
    title = 'Gasto Registrado';
    message = `Hola <strong>${driverName}</strong>.<br><br>Se ha registrado un nuevo movimiento o descuento en tu cuenta.`;
    cardHtml = `
      <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Monto del Gasto:</strong> <span style="color: #ef4444; font-weight: 900; font-size: 18px;">-${formatMoneyLocal(amount)}</span></p>
      <p style="margin: 0; color: #334155; font-size: 15px;"><strong>Detalle del Gasto:</strong> ${detail}</p>
    `;
  } else if (type === 'rendicion_pendiente') {
    accentColor = '#f59e0b'; // Naranja
    subject = `⏳ Comprobante de Rendición Recibido - logisticAPP`;
    title = 'Rendición en Revisión';
    message = `Hola <strong>${driverName}</strong>.<br><br>Hemos recibido tu comprobante de rendición de vuelto. Está siendo evaluado por el administrador.`;
    cardHtml = `
      <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Monto Rendido:</strong> <span style="color: #f59e0b; font-weight: 900; font-size: 18px;">${formatMoneyLocal(amount)}</span></p>
      <p style="margin: 0; color: #334155; font-size: 15px;"><strong>Estado:</strong> <span style="font-weight: bold;">Pendiente de Validación</span></p>
    `;
  } else if (type === 'rendicion_aprobada') {
    accentColor = '#10b981'; // Verde
    subject = `✅ Rendición Aprobada - Balance Limpio - logisticAPP`;
    title = 'Rendición Aprobada';
    message = `Hola <strong>${driverName}</strong>.<br><br>El administrador ha aprobado exitosamente tu rendición de vuelto.`;
    cardHtml = `
      <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Monto Validado:</strong> <span style="color: #10b981; font-weight: 900; font-size: 18px;">${formatMoneyLocal(amount)}</span></p>
      <p style="margin: 0; color: #334155; font-size: 15px;"><strong>Detalle:</strong> Tu saldo ha vuelto a cero de manera conforme.</p>
    `;
  } else if (type === 'modificacion') {
    accentColor = '#3b82f6'; // Azul
    subject = `🔄 Corrección de Registro Financiero - logisticAPP`;
    title = 'Registro Modificado';
    message = `Hola <strong>${driverName}</strong>.<br><br>El administrador ha corregido un monto o detalle en tu historial de viáticos.`;
    cardHtml = `
      <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Monto Anterior:</strong> <span style="text-decoration: line-through; color: #94a3b8;">${formatMoneyLocal(oldAmount)}</span></p>
      <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Monto Nuevo:</strong> <span style="color: #3b82f6; font-weight: 900; font-size: 18px;">${formatMoneyLocal(newAmount)}</span></p>
      <p style="margin: 0; color: #334155; font-size: 15px;"><strong>Concepto Actualizado:</strong> ${detail}</p>
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
            ${message}
          </div>

          <div style="background-color: #f8fafc; border-left: 4px solid ${accentColor}; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
            ${cardHtml}
            
            ${newBalance !== undefined ? `
              <div style="margin-top: 20px; border-top: 2px dashed #cbd5e1; padding-top: 15px; text-align: right;">
                <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 4px;">Tu Saldo Actual en App</span>
                <span style="font-size: 22px; color: #0f172a; font-weight: 900; background-color: #e2e8f0; padding: 4px 12px; border-radius: 8px;">${formatMoneyLocal(newBalance)}</span>
              </div>
            ` : ''}
          </div>

          <div style="text-align: center; margin-top: 40px;">
            <a href="${baseUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">Ver mi Billetera en la App ➔</a>
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
