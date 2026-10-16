// src/utils/storageMetrics.js
import { ref, listAll, getMetadata, deleteObject } from 'firebase/storage';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';

export const formatBytes = (bytes, decimals = 1) => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export const isDocFile = (fileName, fullPath) => {
  if (!fileName) return false;
  const nameLower = fileName.toLowerCase();
  const pathLower = (fullPath || '').toLowerCase();
  return (
    nameLower.includes('doc_soap') ||
    nameLower.includes('doc_permiso') ||
    nameLower.includes('doc_rt') ||
    nameLower.includes('doc_gases') ||
    nameLower.includes('doc_padron') ||
    nameLower.includes('doc_revision') ||
    nameLower.startsWith('doc_') ||
    pathLower.includes('doc_soap') ||
    pathLower.includes('doc_permiso') ||
    pathLower.includes('doc_rt') ||
    pathLower.includes('doc_gases') ||
    pathLower.includes('doc_padron')
  );
};

// Helper para procesar en paralelo con límite de concurrencia
const pMap = async (items, fn, concurrency = 10) => {
  const results = [];
  let index = 0;
  const worker = async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  };
  const workers = Array.from({ length: Math.min(items.length, concurrency) }, () => worker());
  await Promise.all(workers);
  return results;
};

/**
 * Escanea Firebase Storage y calcula las métricas reales de espacio y archivos.
 */
export const scanStorageMetrics = async (db, storage, onProgress = () => {}) => {
  try {
    onProgress('Consultando traslados activos en Firestore...');
    const jobsSnap = await getDocs(collection(db, 'transport_jobs'));
    const activeJobIds = new Set(jobsSnap.docs.map(d => d.id));

    onProgress('Listando carpetas en Firebase Storage...');
    const checklistsRootRef = ref(storage, 'checklists');
    let rootListing;
    try {
      rootListing = await listAll(checklistsRootRef);
    } catch (listErr) {
      console.error('[ERR-SCAN-STORAGE-ROOT]', listErr);
      throw new Error('[ERR-SCAN-STORAGE-ROOT] No se pudo acceder a la raíz de Storage.');
    }

    const folderPrefixes = rootListing.prefixes || [];
    const rootItems = rootListing.items || [];
    const totalFolders = folderPrefixes.length;

    let activeFiles = 0;
    let activeBytes = 0;
    let protectedDocFiles = 0;
    let protectedDocBytes = 0;
    let orphanFiles = 0;
    let orphanBytes = 0;
    let orphanFoldersCount = 0;

    const getFileSize = async (itemRef) => {
      try {
        const meta = await getMetadata(itemRef);
        return meta.size || 0;
      } catch (e) {
        return 180 * 1024; // Estimación ~180KB en caso de excepción
      }
    };

    let processedFolders = 0;
    for (const folderRef of folderPrefixes) {
      processedFolders++;
      const isJobActive = activeJobIds.has(folderRef.name);
      if (!isJobActive) orphanFoldersCount++;

      if (processedFolders % 5 === 0 || processedFolders === totalFolders) {
        onProgress(`Escaneando carpeta ${processedFolders} de ${totalFolders}...`);
      }

      try {
        const folderContent = await listAll(folderRef);
        const sizes = await pMap(folderContent.items, getFileSize, 8);

        folderContent.items.forEach((item, idx) => {
          const size = sizes[idx] || 0;
          const isDoc = isDocFile(item.name, item.fullPath);

          if (isDoc) {
            protectedDocFiles++;
            protectedDocBytes += size;
          } else if (isJobActive) {
            activeFiles++;
            activeBytes += size;
          } else {
            orphanFiles++;
            orphanBytes += size;
          }
        });
      } catch (err) {
        console.warn('[ERR-SCAN-FOLDER]', folderRef.name, err);
      }
    }

    // Archivos sueltos en raíz
    const rootSizes = await pMap(rootItems, getFileSize, 8);
    rootItems.forEach((item, idx) => {
      const size = rootSizes[idx] || 0;
      const isDoc = isDocFile(item.name, item.fullPath);
      if (isDoc) {
        protectedDocFiles++;
        protectedDocBytes += size;
      } else {
        orphanFiles++;
        orphanBytes += size;
      }
    });

    const totalFiles = activeFiles + protectedDocFiles + orphanFiles;
    const totalBytes = activeBytes + protectedDocBytes + orphanBytes;

    const metrics = {
      totalFiles,
      totalBytes,
      activeFiles,
      activeBytes,
      protectedDocFiles,
      protectedDocBytes,
      orphanFiles,
      orphanBytes,
      activeJobsCount: activeJobIds.size,
      orphanFoldersCount,
      totalFolders,
      scannedAt: Date.now()
    };

    // Guardar en Firestore para carga instantánea
    try {
      await setDoc(doc(db, 'system_config', 'storage_metrics'), metrics, { merge: true });
    } catch (saveErr) {
      console.warn('[ERR-SAVE-STORAGE-METRICS]', saveErr);
    }

    return metrics;
  } catch (err) {
    console.error('[ERR-SCAN-STORAGE-METRICS-01]', err);
    throw err;
  }
};

/**
 * Escanea y elimina fotos huérfanas de Storage, protegiendo documentos de vehículos.
 */
export const purgeOrphanStoragePhotos = async (db, storage, vehicles = [], onProgress = () => {}) => {
  try {
    onProgress('Consultando traslados activos en Firestore...');
    const jobsSnap = await getDocs(collection(db, 'transport_jobs'));
    const activeJobIds = new Set(jobsSnap.docs.map(d => d.id));

    onProgress('Listando carpetas en Storage...');
    const checklistsRootRef = ref(storage, 'checklists');
    const rootListing = await listAll(checklistsRootRef);

    const orphanFolders = (rootListing.prefixes || []).filter(prefixRef => !activeJobIds.has(prefixRef.name));

    let deletedCount = 0;
    let bytesFreed = 0;
    let protectedCount = 0;

    const getFileSize = async (itemRef) => {
      try {
        const meta = await getMetadata(itemRef);
        return meta.size || 0;
      } catch (e) {
        return 0;
      }
    };

    let processedFolders = 0;
    for (const folderRef of orphanFolders) {
      processedFolders++;
      onProgress(`Limpiando carpeta huérfana ${processedFolders} de ${orphanFolders.length}...`);

      try {
        const folderContent = await listAll(folderRef);
        const filesToDelete = [];

        for (const itemRef of folderContent.items) {
          if (isDocFile(itemRef.name, itemRef.fullPath)) {
            protectedCount++;
          } else {
            filesToDelete.push(itemRef);
          }
        }

        const BATCH = 6;
        for (let i = 0; i < filesToDelete.length; i += BATCH) {
          const chunk = filesToDelete.slice(i, i + BATCH);
          await Promise.allSettled(chunk.map(async (fileRef) => {
            try {
              const sz = await getFileSize(fileRef);
              await deleteObject(fileRef);
              deletedCount++;
              bytesFreed += sz;
            } catch (delErr) {
              if (delErr?.code !== 'storage/object-not-found') {
                console.warn('[ERR-PURGE-FILE]', fileRef.fullPath, delErr);
              }
            }
          }));
        }
      } catch (folderErr) {
        console.warn('[ERR-PURGE-FOLDER]', folderRef.name, folderErr);
      }
    }

    // Archivos sueltos en raíz
    for (const itemRef of (rootListing.items || [])) {
      if (isDocFile(itemRef.name, itemRef.fullPath)) {
        protectedCount++;
      } else {
        try {
          const sz = await getFileSize(itemRef);
          await deleteObject(itemRef);
          deletedCount++;
          bytesFreed += sz;
        } catch (e) { /* ignorar */ }
      }
    }

    // Actualizar métricas en Firestore restando lo eliminado
    try {
      const snap = await getDoc(doc(db, 'system_config', 'storage_metrics'));
      if (snap.exists()) {
        const current = snap.data();
        const updated = {
          ...current,
          totalFiles: Math.max(0, (current.totalFiles || 0) - deletedCount),
          totalBytes: Math.max(0, (current.totalBytes || 0) - bytesFreed),
          orphanFiles: Math.max(0, (current.orphanFiles || 0) - deletedCount),
          orphanBytes: Math.max(0, (current.orphanBytes || 0) - bytesFreed),
          orphanFoldersCount: Math.max(0, (current.orphanFoldersCount || 0) - orphanFolders.length),
          lastPurgeAt: Date.now(),
          lastPurgeDeletedCount: deletedCount,
          lastPurgeBytesFreed: bytesFreed
        };
        await setDoc(doc(db, 'system_config', 'storage_metrics'), updated, { merge: true });
      }
    } catch (e) {
      console.warn('[ERR-UPDATE-PURGE-METRICS]', e);
    }

    return {
      deletedCount,
      bytesFreed,
      protectedCount,
      orphanFoldersCount: orphanFolders.length
    };
  } catch (err) {
    console.error('[ERR-PURGE-STORAGE-PHOTOS-02]', err);
    throw err;
  }
};
