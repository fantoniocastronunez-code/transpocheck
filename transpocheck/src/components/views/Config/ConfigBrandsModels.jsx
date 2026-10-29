import React, { useState, useMemo } from 'react';
import { 
  collection, addDoc, updateDoc, doc, deleteDoc, deleteField 
} from 'firebase/firestore';
import { 
  Car, Plus, Search, Edit2, Trash2, ChevronDown, ChevronUp, 
  Tag, Filter, Check, X, Layers, AlertCircle, Sparkles 
} from 'lucide-react';

export const VEHICLE_TYPES = [
  { value: 'auto', label: 'Auto / SUV', emoji: '🚙' },
  { value: 'camioneta', label: 'Camioneta', emoji: '🛻' },
  { value: 'furgon_pequeno', label: 'Furgón Pequeño', emoji: '🚐' },
  { value: 'furgon_grande', label: 'Furgón Grande', emoji: '🚐' },
  { value: 'camion', label: 'Camión Simple', emoji: '🚚' },
  { value: 'camion_doble', label: 'Camión Doble Cabina', emoji: '🚚' },
  { value: 'camion_2ejes', label: 'Camión (2 Ejes traseros)', emoji: '🚛' },
  { value: 'camion_3ejes', label: 'Camión (3 Ejes traseros)', emoji: '🚛' },
  { value: 'camion_8x4', label: 'Camión Rigid (8x4)', emoji: '🚚' },
  { value: 'carro_arrastre', label: 'Carro Arrastre', emoji: '🛒' },
  { value: 'maquinaria', label: 'Maquinaria', emoji: '🚜' },
];

export const getVehicleTypeInfo = (typeKey) => {
  const found = VEHICLE_TYPES.find(t => t.value === typeKey);
  return found || { value: typeKey || 'auto', label: typeKey || 'Auto / SUV', emoji: '🚙' };
};

export default function ConfigBrandsModels({ vehicles = [], vehicleModels = [], db, showAlert, showConfirm }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [expandedBrands, setExpandedBrands] = useState({});

  // Form states
  const [brandInput, setBrandInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [typeInput, setTypeInput] = useState('auto');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Unificamos marcas y modelos desde 'vehicles' y la colección dedicada 'vehicle_models'
  const consolidatedModels = useMemo(() => {
    const map = new Map();

    // Modelos que provienen del historial / flota existente
    vehicles.forEach(v => {
      const b = v.brand?.toUpperCase().trim();
      const m = v.model?.toUpperCase().trim();
      if (b && m) {
        const key = `${b}___${m}`;
        if (!map.has(key)) {
          map.set(key, {
            key,
            brand: b,
            model: m,
            vehicleType: v.vehicleType || 'auto',
            source: 'vehicles',
            fleetCount: 1,
            catalogDocId: null,
            vehicleDocIds: [v.id]
          });
        } else {
          const item = map.get(key);
          item.fleetCount += 1;
          if (v.id && !item.vehicleDocIds.includes(v.id)) {
            item.vehicleDocIds.push(v.id);
          }
          if ((!item.vehicleType || item.vehicleType === 'auto') && v.vehicleType) {
            item.vehicleType = v.vehicleType;
          }
        }
      }
    });

    // Modelos registrados explícitamente en el catálogo oficial 'vehicle_models'
    vehicleModels.forEach(vm => {
      const b = vm.brand?.toUpperCase().trim();
      const m = vm.model?.toUpperCase().trim();
      if (b && m) {
        const key = `${b}___${m}`;
        if (map.has(key)) {
          const item = map.get(key);
          item.catalogDocId = vm.id;
          item.vehicleType = vm.vehicleType || item.vehicleType || 'auto';
          item.source = 'catalog_and_fleet';
        } else {
          map.set(key, {
            key,
            brand: b,
            model: m,
            vehicleType: vm.vehicleType || 'auto',
            source: 'catalog_only',
            fleetCount: 0,
            catalogDocId: vm.id,
            vehicleDocIds: []
          });
        }
      }
    });

    return Array.from(map.values());
  }, [vehicles, vehicleModels]);

  // Lista única de marcas existentes para autocompletado en el formulario
  const existingBrands = useMemo(() => {
    return [...new Set(consolidatedModels.map(m => m.brand))].sort();
  }, [consolidatedModels]);

  // Agrupación de modelos por Marca
  const groupedByBrand = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();
    const groups = {};

    consolidatedModels.forEach(item => {
      const matchesSearch = !cleanSearch || 
        item.brand.toLowerCase().includes(cleanSearch) || 
        item.model.toLowerCase().includes(cleanSearch);

      const matchesType = selectedTypeFilter === 'all' || item.vehicleType === selectedTypeFilter;

      if (matchesSearch && matchesType) {
        if (!groups[item.brand]) {
          groups[item.brand] = [];
        }
        groups[item.brand].push(item);
      }
    });

    // Ordenar los modelos dentro de cada marca
    Object.keys(groups).forEach(b => {
      groups[b].sort((a, b) => a.model.localeCompare(b.model));
    });

    return groups;
  }, [consolidatedModels, searchTerm, selectedTypeFilter]);

  const sortedBrandNames = useMemo(() => {
    return Object.keys(groupedByBrand).sort();
  }, [groupedByBrand]);

  const totalBrandsCount = existingBrands.length;
  const totalModelsCount = consolidatedModels.length;

  const toggleBrand = (brandName) => {
    setExpandedBrands(prev => ({
      ...prev,
      [brandName]: !prev[brandName]
    }));
  };

  const handleExpandAll = () => {
    const next = {};
    sortedBrandNames.forEach(b => { next[b] = true; });
    setExpandedBrands(next);
  };

  const handleCollapseAll = () => {
    setExpandedBrands({});
  };

  const openAddModal = (initialBrand = '') => {
    setEditingItem(null);
    setBrandInput(initialBrand);
    setModelInput('');
    setTypeInput('auto');
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setBrandInput(item.brand);
    setModelInput(item.model);
    setTypeInput(item.vehicleType || 'auto');
    setIsModalOpen(true);
  };

  const handleSaveModel = async (e) => {
    e?.preventDefault();
    if (isSubmitting) return;

    const cleanBrand = brandInput.trim().toUpperCase();
    const cleanModel = modelInput.trim().toUpperCase();

    if (!cleanBrand || !cleanModel) {
      return showAlert("❌ [ERR-MODEL-VAL-01] Debes ingresar tanto la Marca como el Modelo.");
    }

    setIsSubmitting(true);

    try {
      if (editingItem) {
        // Actualizar modelo existente
        if (editingItem.catalogDocId) {
          await updateDoc(doc(db, 'vehicle_models', editingItem.catalogDocId), {
            brand: cleanBrand,
            model: cleanModel,
            vehicleType: typeInput,
            updatedAt: Date.now()
          });
        } else {
          // Si provenía sólo de 'vehicles', creamos el registro oficial en 'vehicle_models'
          await addDoc(collection(db, 'vehicle_models'), {
            brand: cleanBrand,
            model: cleanModel,
            vehicleType: typeInput,
            createdAt: Date.now()
          });
        }

        // Si cambió la categoría y tiene vehículos en flota, sincronizamos de manera resiliente
        let fleetSyncFailed = 0;
        if (editingItem.vehicleDocIds && editingItem.vehicleDocIds.length > 0) {
          const syncResults = await Promise.allSettled(
            editingItem.vehicleDocIds.map(vId => 
              updateDoc(doc(db, 'vehicles', vId), { vehicleType: typeInput })
            )
          );
          fleetSyncFailed = syncResults.filter(r => r.status === 'rejected').length;
          if (fleetSyncFailed > 0) {
            console.warn(`[WARN-MODEL-SYNC-01] ${fleetSyncFailed} vehículos en flota no pudieron sincronizarse automáticamente.`);
          }
        }

        if (fleetSyncFailed > 0) {
          showAlert(`✅ [OK-MODEL-UPDATE] Modelo "${cleanBrand} ${cleanModel}" actualizado. (Nota: ${fleetSyncFailed} vehículo(s) en flota no pudieron sincronizarse).`);
        } else {
          showAlert(`✅ [OK-MODEL-UPDATE] Modelo "${cleanBrand} ${cleanModel}" actualizado exitosamente.`);
        }
      } else {
        // Crear nuevo modelo
        const existing = vehicleModels.find(vm => 
          vm.brand?.toUpperCase().trim() === cleanBrand && 
          vm.model?.toUpperCase().trim() === cleanModel
        );

        if (existing) {
          await updateDoc(doc(db, 'vehicle_models', existing.id), {
            vehicleType: typeInput,
            updatedAt: Date.now()
          });
          showAlert(`✅ [OK-MODEL-SAVE] Categoría de "${cleanBrand} ${cleanModel}" actualizada a "${getVehicleTypeInfo(typeInput).label}".`);
        } else {
          await addDoc(collection(db, 'vehicle_models'), {
            brand: cleanBrand,
            model: cleanModel,
            vehicleType: typeInput,
            createdAt: Date.now()
          });
          showAlert(`✅ [OK-MODEL-SAVE] Modelo "${cleanBrand} ${cleanModel}" (${getVehicleTypeInfo(typeInput).label}) añadido al catálogo.`);
        }
      }

      setIsModalOpen(false);
      setEditingItem(null);
    } catch (err) {
      console.error("[ERR-MODEL-SAVE-01] Error al guardar modelo:", err);
      const isPermError = err?.code === 'permission-denied' || err?.message?.includes('permissions');
      const detailMsg = isPermError 
        ? 'Permisos insuficientes en Firestore. Asegúrate de publicar las reglas de "vehicle_models" en la consola de Firebase.' 
        : (err.message || 'Error de conexión');
      showAlert(`❌ [ERR-MODEL-SAVE-01] Ocurrió un error al guardar: ${detailMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteModel = (item) => {
    showConfirm(`¿Estás seguro de eliminar el modelo "${item.brand} ${item.model}" del catálogo?`, async () => {
      try {
        if (item.catalogDocId) {
          await deleteDoc(doc(db, 'vehicle_models', item.catalogDocId));
        }
        
        // Si tiene vehículos asociados en la flota, limpiamos el campo modelo para que no quede huérfano en sugerencias
        if (item.vehicleDocIds && item.vehicleDocIds.length > 0) {
          await Promise.allSettled(
            item.vehicleDocIds.map(vId =>
              updateDoc(doc(db, 'vehicles', vId), { model: deleteField() })
            )
          );
        }

        showAlert(`✅ [OK-MODEL-DEL] Modelo "${item.brand} ${item.model}" eliminado.`);
      } catch (err) {
        console.error("[ERR-MODEL-DEL-01] Error al eliminar modelo:", err);
        const isPermError = err?.code === 'permission-denied' || err?.message?.includes('permissions');
        const detailMsg = isPermError 
          ? 'Permisos insuficientes en Firestore. Asegúrate de publicar las reglas de "vehicle_models" en la consola de Firebase.' 
          : err.message;
        showAlert(`❌ [ERR-MODEL-DEL-01] No se pudo eliminar el modelo: ${detailMsg}`);
      }
    });
  };

  return (
    <div className="space-y-6 w-full min-w-0">
      
      {/* 1. HEADER Y TARJETAS DE MÉTRICAS */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 p-6 rounded-3xl text-white shadow-md relative overflow-hidden">
        <Car className="absolute -right-4 -bottom-4 w-36 h-36 opacity-10" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-white/20 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                Base Central
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide">
              Catálogo de Marcas y Modelos
            </h2>
            <p className="text-xs text-blue-100 font-semibold mt-0.5 max-w-xl">
              Gestiona todas las marcas y sus modelos con sus categorías predeterminadas para autocompletado inteligente y asignación inmediata de tipo de vehículo.
            </p>
          </div>

          <button
            type="button"
            onClick={() => openAddModal()}
            className="px-5 py-3 rounded-2xl bg-white hover:bg-blue-50 text-blue-700 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Agregar Marca y Modelo</span>
          </button>
        </div>

        {/* Mini contadores */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-4 border-t border-white/15">
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl">
            <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest block">Marcas Registradas</span>
            <span className="text-xl font-black">{totalBrandsCount}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl">
            <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest block">Modelos Totales</span>
            <span className="text-xl font-black">{totalModelsCount}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest block">Categorías de Vehículo</span>
            <span className="text-xl font-black">{VEHICLE_TYPES.length}</span>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE BÚSQUEDA Y FILTROS */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por marca o modelo..."
            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Todas las Categorías</option>
            {VEHICLE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExpandAll}
            className="px-3 py-2 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            Expandir Todo
          </button>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="px-3 py-2 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            Colapsar
          </button>
        </div>
      </div>

      {/* 3. LISTADO AGRUPADO DE MARCAS Y SUS RESPECTIVOS MODELOS */}
      {sortedBrandNames.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-3xl border border-slate-100 dark:border-slate-800 space-y-3">
          <Car className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h4 className="text-base font-extrabold text-slate-700 dark:text-slate-300">
            No se encontraron marcas ni modelos
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm || selectedTypeFilter !== 'all' 
              ? 'Prueba modificando los filtros de búsqueda o categoría.' 
              : 'Aún no hay marcas registradas. Presiona el botón "Agregar Marca y Modelo" para comenzar.'}
          </p>
          <button
            type="button"
            onClick={() => openAddModal()}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Registrar Primer Modelo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedBrandNames.map(brandName => {
            const modelsList = groupedByBrand[brandName] || [];
            const isExpanded = expandedBrands[brandName] ?? (Boolean(searchTerm) || sortedBrandNames.length <= 5);

            return (
              <div
                key={brandName}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-all"
              >
                {/* Cabecera de la Marca */}
                <div 
                  onClick={() => toggleBrand(brandName)}
                  className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 select-none transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center font-black text-sm text-blue-600 dark:text-blue-400">
                      {brandName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                        {brandName}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {modelsList.length} modelo{modelsList.length > 1 ? 's' : ''} registrado{modelsList.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddModal(brandName);
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 border border-slate-200 dark:border-slate-700 transition-colors"
                      title={`Agregar modelo a ${brandName}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Nuevo Modelo</span>
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Lista de Modelos de la Marca */}
                {isExpanded && (
                  <div className="p-4 pt-1 bg-slate-50/60 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {modelsList.map(item => {
                        const typeInfo = getVehicleTypeInfo(item.vehicleType);

                        return (
                          <div
                            key={item.key}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2 shadow-xs hover:border-blue-400 dark:hover:border-blue-600 transition-colors group"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate">
                                {item.model}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  <span>{typeInfo.emoji}</span>
                                  <span className="truncate">{typeInfo.label}</span>
                                </span>
                                {item.fleetCount > 0 && (
                                  <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                                    {item.fleetCount} en flota
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                                title="Editar Modelo y Categoría"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteModel(item)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                title="Eliminar Modelo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. MODAL PARA AGREGAR O EDITAR MARCA Y MODELO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form 
            onSubmit={handleSaveModel} 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Header del modal */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider">
                    {editingItem ? 'Editar Modelo' : 'Nuevo Modelo al Catálogo'}
                  </h3>
                  <p className="text-[11px] text-blue-100 font-semibold">
                    Marca, modelo y tipo de vehículo asociado
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 bg-black/20 hover:bg-black/30 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Campos del formulario */}
            <div className="p-5 sm:p-6 space-y-4">
              
              {/* Marca */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest ml-1">
                  Marca del Vehículo *
                </label>
                <input
                  type="text"
                  required
                  list="brands-datalist"
                  value={brandInput}
                  onChange={(e) => setBrandInput(e.target.value.toUpperCase())}
                  placeholder="Ej: TOYOTA, CHEVROLET, SCANIA, CATERPILLAR..."
                  autoComplete="off"
                  autoCapitalize="characters"
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl outline-none focus:border-blue-500 font-black text-sm uppercase text-slate-800 dark:text-slate-100 transition-colors shadow-inner"
                />
                <datalist id="brands-datalist">
                  {existingBrands.map(b => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>

              {/* Modelo */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest ml-1">
                  Nombre del Modelo *
                </label>
                <input
                  type="text"
                  required
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value.toUpperCase())}
                  placeholder="Ej: HILUX, D-MAX, 320D, FH16, SPRINTER..."
                  autoComplete="off"
                  autoCapitalize="characters"
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl outline-none focus:border-blue-500 font-black text-sm uppercase text-slate-800 dark:text-slate-100 transition-colors shadow-inner"
                />
              </div>

              {/* Tipo de Vehículo */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest ml-1">
                  Tipo de Vehículo (Categoría Predeterminada) *
                </label>
                <select
                  value={typeInput}
                  onChange={(e) => setTypeInput(e.target.value)}
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-sm text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
                >
                  {VEHICLE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.emoji} {t.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 font-semibold ml-1 pt-0.5">
                  Esta categoría se asignará automáticamente al ingresar este modelo en un traslado.
                </p>
              </div>

            </div>

            {/* Footer con botones */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-800 font-bold text-xs uppercase text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{editingItem ? 'Guardar Cambios' : 'Guardar Modelo'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

