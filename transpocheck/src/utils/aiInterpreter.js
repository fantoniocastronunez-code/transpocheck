const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export async function processVoiceCommand(transcript) {
  if (!GEMINI_API_KEY) {
    throw new Error("No VITE_GEMINI_API_KEY found in .env");
  }

  const prompt = `
Eres un asistente experto para una aplicación de logística de vehículos (LogisticAPP). 
Tu trabajo es interpretar el dictado de voz de un conductor y extraer la información en formato JSON estricto.

El usuario dictó el siguiente texto:
"${transcript}"

Debes extraer la información y mapearla EXACTAMENTE a esta estructura JSON (omite los campos que no se mencionen, o usa null/falso según corresponda, pero respeta los nombres de las claves):

{
  "docsExpiry": {
    // Si menciona vencimientos de documentos. El formato DEBE ser "YYYY-MM".
    // Usa las claves "soap", "permisocirculacion", "revisiontecnica", "seguro"
  },
  "hasEquipment": true/false, // true si menciona que tiene algún equipamiento
  "equipment": {
    // booleanos para el equipamiento mencionado. Claves posibles: 
    // "botiquin", "extintor", "gata", "triangulos", "chaleco", "repuesto", "llaveruedas"
  },
  "equipmentDetails": "string", // si menciona algún equipamiento extra o detalles
  "fuelLevel": number, // nivel de bencina/combustible aproximado de 0 a 100 (ej: si dice la mitad, 50. Si dice reserva, 15. Si dice lleno, 100)
  "hasFuelCharge": true/false, // true si menciona que se le cargó combustible
  "fuelChargeAmount": number // si menciona un monto de dinero cargado en combustible
}

REGLAS CRÍTICAS:
- Las fechas deben ser "YYYY-MM". Si dice "octubre de este año", asume el año actual. Si dice "marzo 2026", usa "2026-03".
- Devuelve ÚNICAMENTE el código JSON. Nada de bloques de markdown (no pongas \`\`\`json). Solo el objeto JSON crudo.
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errData = await response.text();
      throw new Error(`Error Gemini API (${response.status}): ${errData}`);
    }

    const data = await response.json();
    let resultText = data.candidates[0].content.parts[0].text;
    
    // Limpiar markdown (```json ... ```) si la IA lo incluyó por error
    resultText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // Parsear el JSON
    return JSON.parse(resultText);
  } catch (error) {
    console.error("Error interpretando voz:", error);
    throw error;
  }
}
