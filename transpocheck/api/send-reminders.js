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

    // 2. Buscar TODOS los trabajos pendientes
    const snapshot = await db.collection('transport_jobs').where('status', '==', 'pending').get();
    
    if (snapshot.empty) return res.status(200).json({ message: 'Sin trabajos pendientes.' });

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    let emailsSent = 0;

    for (const doc of snapshot.docs) {
      const job = doc.data();
      
      // Si no tiene fecha, no tiene hora, o ya se avisó, lo ignoramos
      if (!job.scheduledDate || !job.scheduledTime || job.reminderSent) continue;

      const [year, month, day] = job.scheduledDate.split('-');
      const [hour, minute] = job.scheduledTime.split(':');
      
      const jobDate = new Date(year, month - 1, day, hour, minute);
      
      // Calcular minutos de diferencia
      const diffMs = jobDate.getTime() - nowInChile.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);

      // Si faltan entre 1 y 125 minutos (Aprox 2 horas)
      if (diffMinutes > 0 && diffMinutes <= 125) {
        
        const htmlTemplate = `
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

        // Mandar el correo al administrador principal
        await transporter.sendMail({
          from: `"Alertas LogisticAPP" <${process.env.EMAIL_USER}>`,
          to: process.env.EMAIL_USER,
          subject: `⏰ URGENTE: Traslado en 2 Hrs - ${job.plate || job.vin || 'Servicio'}`,
          html: htmlTemplate,
        });

        // Marcar en la base de datos que la alarma ya sonó para no repetirla
        await doc.ref.update({ reminderSent: true });
        emailsSent++;
      }
    }

    res.status(200).json({ success: true, sent: emailsSent, message: 'Revisión completada.' });
  } catch (error) {
    console.error("Error en cron:", error);
    res.status(500).json({ error: error.message });
  }
}