import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

// --- OPTIMIZACIÓN 1: Inicialización Segura Anti-Caídas ---
try {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Limpiamos saltos de línea estrictamente para evitar fallos de lectura de llaves privadas
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
      }),
    });
  }
} catch (error) {
  console.error('CRÍTICO: Error inicializando Firebase Admin', error);
}

const db = getFirestore();

export default async function handler(req, res) {
  // --- OPTIMIZACIÓN 2: Seguridad Vercel Cron ---
  // Evitamos que extraños ataquen tu endpoint saturando tus envíos de correo
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('No autorizado');
  }

  // URL dinámica para imágenes y botones
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  try {
    // 1. Obtenemos la hora actual exacta en Santiago de Chile
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Santiago',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false
    });
    
    const parts = formatter.formatToParts(new Date());
    const dp = {}; parts.forEach(({ type, value }) => { dp[type] = value; });
    const nowInChile = new Date(dp.year, dp.month - 1, dp.day, dp.hour, dp.minute);

    // 2. Buscar TODOS los trabajos que estén "Pendientes" o "Aceptados"
    const snapshot = await db.collection('transport_jobs').where('status', 'in', ['pending', 'accepted']).get();
    
    if (snapshot.empty) return res.status(200).json({ message: 'Sin trabajos en el radar.' });

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    // --- OPTIMIZACIÓN 3: Generador de Plantillas Maestro ---
    // Nos permite crear correos hermosos sin repetir todo el HTML
    const logoUrl = `${baseUrl}/logo512.png`;

    const buildTemplate = (accentColor, title, message, cardHtml, buttonText) => `
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
            </div>

            <div style="text-align: center; margin-top: 40px;">
              <a href="${baseUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">${buttonText}</a>
            </div>
          </div>

          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <img src="${logoUrl}" alt="logisticAPP" style="height: 60px; width: 60px; display: block; margin: 0 auto 10px auto; opacity: 0.8;" onerror="this.style.display='none'" />
            <p style="color: #64748b; font-size: 12px; margin: 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Alerta de Monitoreo Generada Automáticamente</p>
            <p style="color: #94a3b8; font-size: 11px; margin-top: 5px;">logisticAPP</p>
          </div>
        </div>
      </div>
    `;

    let emailsSent = 0;

    for (const doc of snapshot.docs) {
      const job = doc.data();
      
      // Si no tiene fecha o no tiene hora, lo ignoramos
      if (!job.scheduledDate || !job.scheduledTime) continue;

      const [year, month, day] = job.scheduledDate.split('-');
      const [hour, minute] = job.scheduledTime.split(':');
      
      const jobDate = new Date(year, month - 1, day, hour, minute);
      
      // Calcular minutos de diferencia
      const diffMs = jobDate.getTime() - nowInChile.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);

      // ----------------------------------------------------------------------
      // CASO 1: ALERTA AL ADMIN (Faltan aprox 2 horas y nadie lo ha tomado)
      // ----------------------------------------------------------------------
      if (job.status === 'pending' && !job.reminderSent && diffMinutes > 0 && diffMinutes <= 125) {
        
        const adminCard = `
          <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Hora Programada:</strong> <span style="color: #ef4444; font-weight: 900;">${job.scheduledTime} hrs</span></p>
          <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Cliente:</strong> ${job.client}</p>
          <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Vehículo / Tarea:</strong> ${job.brand ? `${job.brand} ${job.model}` : job.description}</p>
          <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Patente / VIN:</strong> <span style="color: #0f172a; font-weight: bold; background-color: #e2e8f0; padding: 4px 8px; border-radius: 6px;">${job.plate || job.vin || 'N/A'}</span></p>
          <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Origen:</strong> ${job.origin}</p>
          <p style="margin: 0; color: #334155; font-size: 15px;"><strong>Conductores Asignados:</strong> ${job.assignedDrivers?.map(d=>d.name).join(', ') || 'Ninguno'}</p>
        `;

        await transporter.sendMail({
          from: `"Monitoreo LogisticAPP" <${process.env.EMAIL_USER}>`,
          to: 'fcastro@logisticats.cl, hcastro@logisticats.cl',
          subject: `🚨 URGENTE: Traslado sin aceptar en 2 Hrs - ${job.plate || job.vin || 'Servicio'}`,
          html: buildTemplate('#ef4444', '⏰ ALERTA DE TRASLADO PRÓXIMO', 'Faltan menos de 2 horas para el inicio de este servicio y <strong>ningún conductor lo ha aceptado aún.</strong>', adminCard, 'Abrir Panel Administrativo ➔'),
        });

        await doc.ref.update({ reminderSent: true });
        emailsSent++;
      }


      // ----------------------------------------------------------------------
      // CASO 2: ALERTA AL CONDUCTOR (Atraso de 15 minutos en el inicio)
      // ----------------------------------------------------------------------
      const hasNotStarted = !job.phase || job.phase === 'claimed';
      
      // Si el conductor aceptó, no ha iniciado, y ya pasaron 15 minutos (diffMinutes negativo)
      if (job.status === 'accepted' && hasNotStarted && !job.lateReminderSent && diffMinutes <= -15 && diffMinutes > -1440) {
        
        if (!job.acceptedByEmail) continue;

        const driverName = job.assignedDrivers?.find(d => d.email === job.acceptedByEmail)?.name || 'Conductor';

        const driverCard = `
          <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Hora Programada:</strong> <span style="color: #f59e0b; font-weight: 900;">${job.scheduledTime} hrs</span></p>
          <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Vehículo / Tarea:</strong> ${job.brand ? `${job.brand} ${job.model}` : job.description}</p>
          <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;"><strong>Patente / VIN:</strong> <span style="color: #0f172a; font-weight: bold; background-color: #e2e8f0; padding: 4px 8px; border-radius: 6px;">${job.plate || job.vin || 'N/A'}</span></p>
          <p style="margin: 0; color: #334155; font-size: 15px;"><strong>Retiro en:</strong> ${job.origin}</p>
        `;

        await transporter.sendMail({
          from: `"Monitoreo LogisticAPP" <${process.env.EMAIL_USER}>`,
          to: job.acceptedByEmail, 
          subject: `⚠️ Alerta de Atraso - Patente: ${job.plate || job.vin || 'Servicio'}`,
          html: buildTemplate('#f59e0b', '⏰ AVISO DE RETRASO EN RUTA', `Hola <strong>${driverName}</strong>.<br><br>Han pasado más de 15 minutos desde la hora programada y el sistema detecta que aún no has marcado tu llegada al punto de origen.`, driverCard, 'Deslizar Llegada en App ➔'),
        });

        await doc.ref.update({ lateReminderSent: true });
        emailsSent++;
      }
    }

    res.status(200).json({ success: true, sent: emailsSent, message: 'Revisión y envío de recordatorios completado con éxito.' });
  } catch (error) {
    console.error("Error en cron de recordatorios:", error);
    res.status(500).json({ error: error.message });
  }
}