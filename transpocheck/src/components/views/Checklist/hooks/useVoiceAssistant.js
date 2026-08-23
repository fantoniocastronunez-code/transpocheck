import { useState, useRef } from 'react';
import { processVoiceCommand } from '../../../../utils/aiInterpreter'; // Ajustar ruta si es necesario

export const useVoiceAssistant = (formData, setF, showAlert) => {
  const [isListening, setIsListening] = useState(false);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognitionRef = useRef(null);

  const toggleVoiceAssistant = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showAlert("Tu navegador no soporta el reconocimiento de voz nativo. Usa Chrome o Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CL';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setLiveTranscript('');
    };

    recognition.onresult = async (event) => {
      let transcript = '';
      let isFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      setLiveTranscript(transcript);

      if (!isFinal) return;
      
      recognition.stop();
      setIsListening(false);
      setIsInterpreting(true);
      
      try {
        const result = await processVoiceCommand(transcript);
        
        if (result.docsExpiry) {
          setF('docsExpiry', { ...formData.docsExpiry, ...result.docsExpiry });
        }
        if (typeof result.hasEquipment === 'boolean') {
          setF('hasEquipment', result.hasEquipment);
        }
        if (result.equipment) {
          setF('equipment', { ...formData.equipment, ...result.equipment });
        }
        if (result.equipmentDetails) {
          setF('equipmentDetails', result.equipmentDetails);
        }
        if (typeof result.fuelLevel === 'number') {
          setF('fuelLevel', result.fuelLevel);
        }
        if (typeof result.hasFuelCharge === 'boolean') {
          setF('hasFuelCharge', result.hasFuelCharge);
        }
        if (typeof result.fuelChargeAmount === 'number') {
          setF('fuelChargeAmount', result.fuelChargeAmount);
        }
        
        showAlert("✅ Checklist actualizado por IA según tu dictado.");
      } catch (error) {
        console.error(error);
        showAlert("❌ No se pudo interpretar el comando de voz: " + error.message);
      } finally {
        setIsInterpreting(false);
        setTimeout(() => setLiveTranscript(''), 4000);
      }
    };

    recognition.onerror = (event) => {
      console.error("Error de reconocimiento de voz:", event.error);
      setIsListening(false);
      if (event.error !== 'aborted') {
         showAlert("❌ Error al escuchar el micrófono. Revisa los permisos.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return {
    isListening,
    isInterpreting,
    liveTranscript,
    toggleVoiceAssistant
  };
};
