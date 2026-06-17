import admin from 'firebase-admin';

// Inicializamos Firebase Admin (Reutiliza tus variables de entorno)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  // 1. Bloqueo de seguridad
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('No autorizado');
  }

  try {
    // 2. Calcular la fecha exacta del día 1 del mes actual a las 00:00:00
    const now = new Date();
    const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const jobsRef = db.collection('transport_jobs');
    
    // 3. Buscar TODOS los trabajos que sean MÁS VIEJOS que el día 1 de este mes
    const snapshot = await jobsRef.where('createdAt', '<', firstDayOfCurrentMonth).get();

    if (snapshot.empty) {
      return res.status(200).json({ message: 'No hay trabajos antiguos para borrar.' });
    }

    // 4. Borrar en bloque (Batch Delete) para no saturar Firebase
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    res.status(200).json({ success: true, deletedCount: snapshot.size, message: 'Limpieza mensual completada con éxito.' });
  } catch (error) {
    console.error('Error limpiando base de datos:', error);
    res.status(500).json({ error: error.message });
  }
}