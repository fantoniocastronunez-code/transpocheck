// src/utils/helpers.js

export const DEFAULT_CLIENTES = ["Grandleasing Las Torres", "Grandleasing Umaña", "Kovacs", "Salfa", "Enex", "CIPP", "Simumak", "Mutual Capacitación"];

export const LICENCIAS = ["A1", "A2", "A3", "A4", "A5", "A1 antigua", "A2 antigua", "B", "C"];

export const formatMoney = (amount) => `$${Number(amount).toLocaleString('es-CL')}`;

export const formatDateDisplay = (dateString) => {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-');
  return `${d}/${m}/${y}`;
};

export const resizeImage = (file, maxWidth = 1280, quality = 0.75) => {
  return new Promise((resolve, reject) => {
    // 1. Método de Respaldo Clásico (Por si es un iPhone/Safari muy antiguo)
    const runFallback = () => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    };

    // 2. Método Ultra-Rápido con Web Workers y Aceleración de Hardware
    if (window.Worker && window.OffscreenCanvas) {
      try {
        const workerCode = `
          self.onmessage = async function(e) {
            try {
              const { file, maxWidth, quality } = e.data;
              const bitmap = await createImageBitmap(file);
              let width = bitmap.width;
              let height = bitmap.height;
              if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              }
              const canvas = new OffscreenCanvas(width, height);
              const ctx = canvas.getContext('2d');
              ctx.drawImage(bitmap, 0, 0, width, height);
              
              const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
              const reader = new FileReader();
              reader.readAsDataURL(blob);
              reader.onloadend = () => self.postMessage({ result: reader.result });
            } catch (err) {
              self.postMessage({ error: err.message });
            }
          };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        
        worker.onmessage = (e) => {
          if (e.data.error) runFallback();
          else resolve(e.data.result);
          worker.terminate(); // Mata el proceso secundario para liberar RAM
        };
        
        worker.onerror = () => { runFallback(); worker.terminate(); };
        worker.postMessage({ file, maxWidth, quality });
      } catch(e) {
        runFallback();
      }
    } else {
      runFallback();
    }
  });
};