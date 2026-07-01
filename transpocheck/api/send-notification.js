import { getApps, initializeApp, credential } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Inicialización moderna y a prueba de fallos para Vercel (ESM)
if (getApps().length === 0) {
  initializeApp({
    credential: credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Reemplazamos los saltos de línea para que las llaves privadas no se rompan
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
    }),
  });
}

export default async function handler(req, res) {
  // Solo permitimos peticiones POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { tokens, title, body } = req.body;

  if (!tokens || tokens.length === 0) {
    return res.status(400).json({ error: 'No se enviaron tokens de destino' });
  }

  try {
    const message = {
      notification: { title, body },
      tokens: tokens, // Enviamos el mensaje a todos los dispositivos en la lista (Multicast)
    };

    // Usamos la nueva sintaxis modular para enviar
    const response = await getMessaging().sendMulticast(message);
    
    res.status(200).json({ success: true, response });
  } catch (error) {
    console.error('Error enviando notificaciones Push:', error);
    res.status(500).json({ error: error.message });
  }
}