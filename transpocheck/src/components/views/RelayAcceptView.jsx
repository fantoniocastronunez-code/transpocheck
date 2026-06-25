import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Clock, XCircle, CheckCircle, Car, Users, X } from 'lucide-react';
import LicensePlateBadge from '../ui/LicensePlateBadge';

export default function RelayAcceptView({ jobId, db, currentUserEmail, drivers }) {
  const navigate = useNavigate(); 
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'transport_jobs', jobId), (docSnap) => {
      if (docSnap.exists()) setJob({ id: docSnap.id, ...docSnap.data() });
      setLoading(false);
    });
    return () => unsub();
  }, [jobId, db]);

  const handleAcceptRelay = async () => {
    setStatusMsg('Transfiriendo...');
    try {
      const myDriver = drivers.find(d => d.email === currentUserEmail);
      const updatedEmails = job.assignedEmails || [];
      if (!updatedEmails.includes(currentUserEmail)) updatedEmails.push(currentUserEmail);

      const updatedDrivers = job.assignedDrivers || [];
      if (!updatedDrivers.some(d => d.email === currentUserEmail) && myDriver) {
         updatedDrivers.push({ id: myDriver.id, name: myDriver.name, email: myDriver.email });
      }

      await updateDoc(doc(db, 'transport_jobs', jobId), {
        acceptedByEmail: currentUserEmail,
        assignedEmails: updatedEmails,
        assignedDrivers: updatedDrivers,
        relayHistory: [
          ...(job.relayHistory || []),
          { from: job.acceptedByEmail, to: currentUserEmail, date: Date.now() }
        ]
      });
      
      navigate('/');
    } catch (error) {
      console.error(error);
      setStatusMsg('Error al transferir: ' + error.message);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400"><Clock className="w-5 h-5 mr-2 animate-spin"/> Buscando traslado...</div>;
  if (!job) return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-bold text-red-500"><XCircle className="w-12 h-12 mb-4 text-red-400"/>Traslado no encontrado.</div>;
  if (job.status === 'completed' || job.status === 'failed') return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-bold text-slate-600"><CheckCircle className="w-12 h-12 mb-4 text-green-500"/>Este trabajo ya finalizó.</div>;

  if (job.acceptedByEmail === currentUserEmail) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <Car className="w-12 h-12 mb-4 text-blue-500"/>
          <h2 className="text-xl font-black text-slate-800">Ya tienes este vehículo</h2>
          <button onClick={() => navigate('/')} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">Ir a mis trabajos</button>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border-t-8 border-purple-500 animate-in zoom-in-95">
        <Users className="w-16 h-16 text-purple-500 mx-auto mb-4"/>
        <h2 className="text-2xl font-black text-slate-800 mb-1">Relevo de Vehículo</h2>
        <p className="text-sm font-bold text-slate-500 mb-6">Estás a punto de tomar el control de este traslado.</p>
        
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left mb-6">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Vehículo a recibir</p>
          <div className="flex justify-between items-center mb-4">
            <p className="font-extrabold text-slate-800 text-lg">{job.brand} {job.model}</p>
            <LicensePlateBadge text={job.plate || job.vin} />
          </div>
          
          <p className="text-[10px] font-black text-slate-400 uppercase">Te lo entrega</p>
          <p className="font-extrabold text-red-600 mb-2">{job.acceptedByEmail}</p>

          <p className="text-[10px] font-black text-slate-400 uppercase">Ruta restante</p>
          <p className="font-bold text-slate-700 text-xs">{job.origin} ➔ {job.destination}</p>
        </div>

        <button onClick={handleAcceptRelay} disabled={!!statusMsg} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-4 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
          {statusMsg || 'Aceptar y Tomar Control'}
        </button>
        <button onClick={() => navigate('/')} className="w-full mt-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  );
}