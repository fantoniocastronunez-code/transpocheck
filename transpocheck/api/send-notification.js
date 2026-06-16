import admin from 'firebase-admin';

// Inicializamos Firebase Admin asegurándonos de no duplicar la instancia en Vercel
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Esta línea extraña arregla un problema común donde Vercel rompe los saltos de línea de la llave
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    }),
  });
}

export default async function handler(req, res) {
  // Solo aceptamos peticiones POST desde la app
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');

  try {
    const { tokens, title, body } = req.body;

    if (!tokens || tokens.length === 0) {
      return res.status(200).json({ message: 'No hay tokens válidos para enviar' });
    }

    const payload = {
      notification: { title, body },
      tokens: tokens, // Manda masivamente a todos los conductores asignados a la vez
    };

    // Usamos sendEachForMulticast que es la forma moderna recomendada por Firebase
    const response = await admin.messaging().sendEachForMulticast(payload);
    
    res.status(200).json({ success: true, response });
  } catch (error) {
    console.error("Error crítico enviando FCM en Vercel:", error);
    res.status(500).json({ error: error.message });
  }
}