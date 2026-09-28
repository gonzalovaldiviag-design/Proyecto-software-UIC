import React, { useState, useMemo } from 'react';
import {
  X,
  Boxes,
  Search,
  Building2,
  CheckSquare,
  Square,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  type Equipo,
  type Convenio,
  supabase,
} from '@/lib/supabase';

interface AsociarEquiposModalProps {
  open: boolean;
  onClose: () => void;
  convenio: Convenio;
  equiposDisponibles: Equipo[];
  equiposYaAmparadosIds: string[];
  onSuccess: (mensaje: string) => void;
}

export default function AsociarEquiposModal({
  open,
  onClose,
  convenio,
  equiposDisponibles,
  equiposYaAmparadosIds,
  onSuccess,
}: AsociarEquiposModalProps) {
  const [filtroServicio, setFiltroServicio] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lista de servicios clínicos únicos
  const listaServicios = useMemo(() => {
    const s = new Set<string>();
    equiposDisponibles.forEach((eq) => {
      if (eq.ubicacion && eq.ubicacion.trim()) s.add(eq.ubicacion.trim());
    });
    return Array.from(s).sort();
  }, [equiposDisponibles]);

  // Filtrado de equipos
  const equiposFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return equiposDisponibles.filter((eq) => {
      // Excluir si ya está activamente amparado en este convenio
      if (equiposYaAmparadosIds.includes(eq.id)) return false;

      // Filtro por servicio clínico
      if (filtroServicio !== 'todos' && eq.ubicacion !== filtroServicio) {
        return false;
      }

      // Buscador
      if (q) {
        const match =
          eq.codigo.toLowerCase().includes(q) ||
          eq.nombre.toLowerCase().includes(q) ||
          (eq.marca && eq.marca.toLowerCase().includes(q)) ||
          (eq.modelo && eq.modelo.toLowerCase().includes(q)) ||
          (eq.serie && eq.serie.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [equiposDisponibles, equiposYaAmparadosIds, filtroServicio, busqueda]);

  if (!open) return null;

  const toggleSelect = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (seleccionados.size === equiposFiltrados.length) {
      setSeleccionados(new Set());
    } else {
      const allIds = new Set(equiposFiltrados.map((e) => e.id));
      setSeleccionados(allIds);
    }
  };

  const handleAsociar = async () => {
    if (seleccionados.size === 0) {
      setError('Por favor selecciona al menos un equipo para asociar.');
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      const fechaHoy = new Date().toISOString().split('T')[0];
      const itemsToInsert = Array.from(seleccionados).map((equipoId) => ({
        convenio_id: convenio.id,
        equipo_id: equipoId,
        fecha_incorporacion: fechaHoy,
        estado_vinculo: 'Activo' as const,
        observaciones: `Asociado en bloque al convenio ${convenio.codigo}`,
      }));

      const { error: err } = await supabase
        .from('convenio_equipos')
        .insert(itemsToInsert);

      if (err) throw err;

      onSuccess(
        `Se han asociado ${seleccionados.size} equipo(s) con éxito al convenio "${convenio.codigo}".`
      );
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-asociar-equipos-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm ring-4 ring-blue-100">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <h3 id="modal-asociar-equipos-title" className="text-base font-bold text-slate-900">
                Asociar Equipos en Bloque
              </h3>
              <p className="text-xs text-slate-500">
                Convenio: <strong className="text-blue-700">{convenio.codigo}</strong> — {convenio.nombre} ({convenio.empresa})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
              <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Filtros: Servicio Clínico + Buscador */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Filtrar por Servicio Clínico
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select
                  value={filtroServicio}
                  onChange={(e) => setFiltroServicio(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="todos">Todos los servicios ({listaServicios.length})</option>
                  {listaServicios.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Buscar por Código, Nombre o Serie
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="ej. Monitor, Dräger, SN-..."
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Barra de selección masiva */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 pt-1 text-xs">
            <button
              type="button"
              onClick={selectAll}
              disabled={equiposFiltrados.length === 0}
              className="inline-flex items-center gap-1.5 font-bold text-blue-700 hover:text-blue-900 disabled:opacity-50"
            >
              {seleccionados.size === equiposFiltrados.length && equiposFiltrados.length > 0 ? (
                <>
                  <CheckSquare className="h-4 w-4" />
                  <span>Deseleccionar todos</span>
                </>
              ) : (
                <>
                  <Square className="h-4 w-4" />
                  <span>Seleccionar todos ({equiposFiltrados.length})</span>
                </>
              )}
            </button>
            <span className="text-slate-500">
              <strong className="text-slate-900">{seleccionados.size}</strong> seleccionado(s)
            </span>
          </div>

          {/* Listado con Checkboxes */}
          <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {equiposFiltrados.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No hay equipos disponibles que coincidan con los filtros aplicados.
              </div>
            ) : (
              equiposFiltrados.map((eq) => {
                const checked = seleccionados.has(eq.id);
                return (
                  <div
                    key={eq.id}
                    onClick={() => toggleSelect(eq.id)}
                    className={`flex items-center justify-between p-3 cursor-pointer transition select-none ${
                      checked ? 'bg-blue-50/70 text-blue-900' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-700">{eq.codigo}</span>
                          <span className="font-semibold text-xs text-slate-900">{eq.nombre}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          {eq.marca && <span>{eq.marca}</span>}
                          {eq.modelo && <span>• {eq.modelo}</span>}
                          {eq.serie && <span className="font-mono">SN: {eq.serie}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                        <Building2 className="h-3 w-3 text-slate-500" />
                        {eq.ubicacion || 'Sin servicio'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              Se creará la vinculación activa para los equipos seleccionados.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={guardando}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAsociar}
                disabled={guardando || seleccionados.size === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {guardando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Asociando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Asociar en Bloque ({seleccionados.size})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
