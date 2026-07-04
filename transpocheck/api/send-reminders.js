import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
    }),
  });
}

const db = getFirestore();

export default async function handler(req, res) {
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

    // 2. NUEVO: Buscar TODOS los trabajos que estén "Pendientes" o "Aceptados"
    const snapshot = await db.collection('transport_jobs').where('status', 'in', ['pending', 'accepted']).get();
    
    if (snapshot.empty) return res.status(200).json({ message: 'Sin trabajos en el radar.' });

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

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
        
        const htmlAdminTemplate = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #ef4444; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #ef4444; padding: 15px; text-align: center; color: white;">
              <h2 style="margin: 0; font-size: 22px;">⏰ ALERTA DE TRASLADO PRÓXIMO</h2>
            </div>
            <div style="padding: 20px; background-color: #fef2f2;">
              <p style="font-size: 16px; color: #7f1d1d; font-weight: bold; text-align: center;">Faltan menos de 2 horas para este servicio.</p>
              
              <div style="background-color: white; border: 1px solid #fca5a5; border-radius: 8px; padding: 15px; margin-top: 20px;">
                <p style="margin: 8px 0; color: #450a0a;"><strong>Hora Programada:</strong> ${job.scheduledTime} hrs.</p>
                <p style="margin: 8px 0; color: #450a0a;"><strong>Cliente:</strong> ${job.client}</p>
                <p style="margin: 8px 0; color: #450a0a;"><strong>Vehículo / Tarea:</strong> ${job.brand ? `${job.brand} ${job.model}` : job.description}</p>
                <p style="margin: 8px 0; color: #450a0a;"><strong>Patente/VIN:</strong> ${job.plate || job.vin || 'N/A'}</p>
                <p style="margin: 8px 0; color: #450a0a;"><strong>Origen:</strong> ${job.origin}</p>
                <p style="margin: 8px 0; color: #450a0a;"><strong>Conductores Asignados:</strong> ${job.assignedDrivers?.map(d=>d.name).join(', ') || 'Ninguno'}</p>
              </div>
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: `"Alertas LogisticAPP" <${process.env.EMAIL_USER}>`,
          to: 'fcastro@logisticats.cl, hcastro@logisticats.cl', // Tu configuración previa respetada
          subject: `⏰ URGENTE: Traslado en 2 Hrs - ${job.plate || job.vin || 'Servicio'}`,
          html: htmlAdminTemplate,
        });

        await doc.ref.update({ reminderSent: true });
        emailsSent++;
      }


      // ----------------------------------------------------------------------
      // CASO 2: ALERTA AL CONDUCTOR (Atraso de 15 minutos en el inicio)
      // ----------------------------------------------------------------------
      // Verifica si el conductor NO ha deslizado el botón de llegada
      const hasNotStarted = !job.phase || job.phase === 'claimed';
      
      // Si el conductor aceptó, no ha iniciado, y ya pasaron 15 minutos (diffMinutes es negativo cuando la hora ya pasó)
      if (job.status === 'accepted' && hasNotStarted && !job.lateReminderSent && diffMinutes <= -15 && diffMinutes > -1440 /* Máximo 1 día de atraso */) {
        
        // Si por algún motivo no hay correo registrado, saltamos
        if (!job.acceptedByEmail) continue;

        const driverName = job.assignedDrivers?.find(d => d.email === job.acceptedByEmail)?.name || 'Conductor';

        const htmlDriverTemplate = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #f59e0b; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #f59e0b; padding: 15px; text-align: center; color: white;">
              <h2 style="margin: 0; font-size: 22px;">⏰ AVISO DE RETRASO EN RUTA</h2>
            </div>
            <div style="padding: 20px; background-color: #fffbeb;">
              <p style="font-size: 16px; color: #b45309; text-align: center;">Hola <b>${driverName}</b>,</p>
              <p style="font-size: 16px; color: #b45309; text-align: center; font-weight: bold;">Han pasado más de 15 minutos desde la hora programada y aún no has marcado tu llegada al origen.</p>
              
              <div style="background-color: white; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin-top: 20px;">
                <p style="margin: 8px 0; color: #78350f;"><strong>Hora Programada:</strong> ${job.scheduledTime} hrs.</p>
                <p style="margin: 8px 0; color: #78350f;"><strong>Vehículo / Tarea:</strong> ${job.brand ? `${job.brand} ${job.model}` : job.description}</p>
                <p style="margin: 8px 0; color: #78350f;"><strong>Patente/VIN:</strong> ${job.plate || job.vin || 'N/A'}</p>
                <p style="margin: 8px 0; color: #78350f;"><strong>Retiro en:</strong> ${job.origin}</p>
              </div>
              
              <p style="text-align: center; margin-top: 20px; font-size: 14px; color: #92400e;">Por favor, entra a LogisticAPP y desliza el botón <b>"Llegué a retirar"</b> lo antes posible para mantener al cliente informado.</p>
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: `"Alertas LogisticAPP" <${process.env.EMAIL_USER}>`,
          to: job.acceptedByEmail, // Va directo al correo personal del conductor
          subject: `⚠️ Alerta de Atraso - Patente: ${job.plate || job.vin || 'Servicio'}`,
          html: htmlDriverTemplate,
        });

        // Marcamos el registro para que no le lleguen 100 correos seguidos
        await doc.ref.update({ lateReminderSent: true });
        emailsSent++;
      }

    }

    res.status(200).json({ success: true, sent: emailsSent, message: 'Revisión completada.' });
  } catch (error) {
    console.error("Error en cron:", error);
    res.status(500).json({ error: error.message });
  }
}