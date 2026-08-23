import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../firebase'; // Ajustar ruta si es necesario

export const useDejaVu = (plateOrVin, currentJobId) => {
  const [dejaVuData, setDejaVuData] = useState(null);
  const [showDejaVuModal, setShowDejaVuModal] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      const plate = plateOrVin?.trim().toUpperCase();
      if (!plate || plate.length < 5) {
        setDejaVuData(null);
        return;
      }
      try {
        const q = query(collection(db, 'transport_jobs'), where('plate', '==', plate));
        const snap = await getDocs(q);
        if (!snap.empty) {
          let pastJobs = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(j => j.status === 'completed' && j.id !== currentJobId);

          pastJobs.sort((a, b) => b.completedAt - a.completedAt);

          // Busca el trabajo más reciente que tenga fotos de daños u observaciones largas
          const jobWithDamage = pastJobs.find(j =>
            j.checklist &&
            ((j.checklist.detailPins && j.checklist.detailPins.length > 0) ||
              (j.checklist.observations && j.checklist.observations.trim().length > 5))
          );
          setDejaVuData(jobWithDamage || null);
        } else {
          setDejaVuData(null);
        }
      } catch (e) {
        console.error("Error Déjà Vu:", e);
      }
    };

    const timeoutId = setTimeout(fetchHistory, 800);
    return () => clearTimeout(timeoutId);
  }, [plateOrVin, currentJobId]);

  return {
    dejaVuData,
    showDejaVuModal,
    setShowDejaVuModal
  };
};
