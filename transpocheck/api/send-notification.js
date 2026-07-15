import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// --- OPTIMIZACIÓN: Inicialización Segura (Evita caídas del servidor por credenciales mal parseadas) ---
try {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Limpiamos los saltos de línea estrictamente (necesario en Vercel y variables de entorno crudas)
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
      }),
    });
  }
} catch (error) {
  console.error('CRÍTICO: Error inicializando Firebase Admin para Push Notifications', error);
}

export default async function handler(req, res) {
  // Solo permitimos peticiones POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // --- NUEVO: Atrapamos también 'data' por si queremos enviar información extra oculta en la push ---
  const { tokens, title, body, data = {} } = req.body;

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    return res.status(400).json({ error: 'No se enviaron tokens válidos de destino' });
  }

  try {
    // Construcción del Payload moderno para Firebase Cloud Messaging (FCM)
    const message = {
      notification: { 
        title, 
        body 
      },
      // Agregamos data (útil para que el celular sepa qué pantalla abrir al tocar la notificación)
      data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        ...data
      },
      tokens: tokens, // Array de IDs de dispositivo a notificar
    };

    // sendEachForMulticast es la función recomendada (y no deprecada) para enviar a múltiples dispositivos
    const response = await getMessaging().sendEachForMulticast(message);
    
    // Log para depuración interna en Vercel
    console.log(`Push enviadas: ${response.successCount} exitosas, ${response.failureCount} fallidas.`);

    return res.status(200).json({ 
      success: true, 
      sent: response.successCount,
      failed: response.failureCount
    });
    
  } catch (error) {
    console.error('Error enviando notificaciones Push:', error);
    return res.status(500).json({ error: 'Fallo interno al enviar las notificaciones Push' });
  }
}