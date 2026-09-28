import { useState, useMemo, useEffect, useCallback } from 'react';
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
  RotateCcw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Tag,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import {
  type Equipo,
  type Convenio,
  type ConvenioEquipo,
  supabase,
} from '@/lib/supabase';

export interface AsociarEquiposModalProps {
  open: boolean;
  onClose: () => void;
  convenio: Convenio;
  equiposDisponibles?: Equipo[];
  equiposYaAmparadosIds?: string[];
  onSuccess: (mensaje: string) => void;
}

export default function AsociarEquiposModal({
  open,
  onClose,
  convenio,
  equiposYaAmparadosIds = [],
  onSuccess,
}: AsociarEquiposModalProps) {
  // Pestaña activa: Catálogo o Preseleccionados
  const [tabActiva, setTabActiva] = useState<'catalogo' | 'preseleccionados'>('catalogo');

  // Filtros de búsqueda
  const [busqueda, setBusqueda] = useState('');
  const [debouncedBusqueda, setDebouncedBusqueda] = useState('');
  const [filtroServicio, setFiltroServicio] = useState<string>('todos');
  const [filtroMarca, setFiltroMarca] = useState<string>('todas');
  const [excluirOtrosConvenios, setExcluirOtrosConvenios] = useState<boolean>(true);

  // Opciones dinámicas para dropdowns
  const [serviciosDisponibles, setServiciosDisponibles] = useState<string[]>([]);
  const [marcasDisponibles, setMarcasDisponibles] = useState<string[]>([]);
  const [equiposEnOtrosConveniosIds, setEquiposEnOtrosConveniosIds] = useState<Set<string>>(new Set());

  // Estados de datos paginados
  const [equiposPaginados, setEquiposPaginados] = useState<Equipo[]>([]);
  const [totalCoincidentes, setTotalCoincidentes] = useState<number>(0);
  const [totalCatastro, setTotalCatastro] = useState<number>(3900);
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [cargando, setCargando] = useState<boolean>(false);
  const [cargandoFiltros, setCargandoFiltros] = useState<boolean>(false);

  // Persistencia de selección múltiple (Set de IDs + Mapa de detalles)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [equiposSeleccionadosDetalle, setEquiposSeleccionadosDetalle] = useState<Map<string, Equipo>>(new Map());

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce del input de búsqueda a 300 ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedBusqueda(busqueda);
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  // Resetear a la página 1 cuando cambian los criterios de búsqueda
  useEffect(() => {
    setPaginaActual(1);
  }, [debouncedBusqueda, filtroServicio, filtroMarca, excluirOtrosConvenios, pageSize]);

  // Cargar catálogo base de opciones, marcas y convenios activos al abrir el modal
  useEffect(() => {
    if (!open) {
      setSeleccionados(new Set());
      setEquiposSeleccionadosDetalle(new Map());
      setBusqueda('');
      setDebouncedBusqueda('');
      setFiltroServicio('todos');
      setFiltroMarca('todas');
      setExcluirOtrosConvenios(true);
      setError(null);
      setTabActiva('catalogo');
      setPaginaActual(1);
      return;
    }

    let activo = true;
    async function inicializarModal() {
      setCargandoFiltros(true);
      try {
        // 1. Total del catastro exacto
        const qCount = supabase.from('equipos').select('*', { count: 'exact', head: true });

        // 2. Vínculos activos en convenio_equipos
        const qVinculos = supabase
          .from('convenio_equipos')
          .select('equipo_id, convenio_id')
          .eq('estado_vinculo', 'Activo');

        // 3. Muestra amplia para poblar Servicios y Marcas disponibles
        const qOpciones = supabase
          .from('equipos')
          .select('ubicacion, marca')
          .limit(1500);

        const [resCount, resVinculos, resOpciones] = await Promise.all([qCount, qVinculos, qOpciones]);

        if (!activo) return;

        if (resCount.count) {
          setTotalCatastro(resCount.count);
        }

        // Determinar qué equipos están en OTROS convenios activos
        if (resVinculos.data) {
          const otrosIds = new Set<string>();
          (resVinculos.data as ConvenioEquipo[]).forEach((v) => {
            if (v.convenio_id !== convenio.id) {
              otrosIds.add(v.equipo_id);
            }
          });
          setEquiposEnOtrosConveniosIds(otrosIds);
        }

        // Extraer opciones únicas ordenadas
        if (resOpciones.data) {
          const sSet = new Set<string>();
          const mSet = new Set<string>();
          (resOpciones.data as { ubicacion?: string; marca?: string }[]).forEach((row) => {
            if (row.ubicacion?.trim()) sSet.add(row.ubicacion.trim());
            if (row.marca?.trim()) mSet.add(row.marca.trim());
          });
          setServiciosDisponibles(Array.from(sSet).sort((a, b) => a.localeCompare(b)));
          setMarcasDisponibles(Array.from(mSet).sort((a, b) => a.localeCompare(b)));
        }
      } catch (err) {
        console.warn('Error inicializando opciones en AsociarEquiposModal:', err);
      } finally {
        if (activo) setCargandoFiltros(false);
      }
    }

    inicializarModal();
    return () => {
      activo = false;
    };
  }, [open, convenio.id]);

  // Consulta paginada y filtrada directa en Supabase
  const consultarEquipos = useCallback(async () => {
    if (!open) return;

    setCargando(true);
    setError(null);

    try {
      let query = supabase.from('equipos').select('*', { count: 'exact' });

      // IDs a excluir: los que ya están en este convenio
      const idsAExcluir = new Set<string>(equiposYaAmparadosIds);

      // Si el usuario marcó excluir otros convenios activos, añadir sus IDs
      if (excluirOtrosConvenios) {
        equiposEnOtrosConveniosIds.forEach((id) => idsAExcluir.add(id));
      }

      // Aplicar exclusión a nivel de PostgREST si la lista es moderada (< 150 IDs para no saturar URL HTTP)
      const idsArr = Array.from(idsAExcluir);
      if (idsArr.length > 0 && idsArr.length <= 150) {
        query = query.not('id', 'in', `(${idsArr.join(',')})`);
      }

      // 1. Búsqueda por texto multicriterio (.or con .ilike)
      const termino = debouncedBusqueda.trim().replace(/[,()]/g, ' ');
      if (termino) {
        query = query.or(
          `codigo.ilike.%${termino}%,nombre.ilike.%${termino}%,marca.ilike.%${termino}%,modelo.ilike.%${termino}%,serie.ilike.%${termino}%,inventario.ilike.%${termino}%`
        );
      }

      // 2. Filtro por Servicio Clínico (columna 'ubicacion')
      if (filtroServicio !== 'todos') {
        query = query.eq('ubicacion', filtroServicio);
      }

      // 3. Filtro por Marca
      if (filtroMarca !== 'todas') {
        query = query.eq('marca', filtroMarca);
      }

      // 4. Paginación Servidor con .range(desde, hasta)
      const desde = (paginaActual - 1) * pageSize;
      const hasta = desde + pageSize - 1;
      query = query.order('codigo', { ascending: true }).range(desde, hasta);

      const { data, count, error: err } = await query;

      if (err) {
        console.error('Error devuelto por Supabase:', err);
        setError(`Error en Supabase: ${err.message}${err.details ? ` (${err.details})` : ''}`);
        setEquiposPaginados([]);
        setTotalCoincidentes(0);
      } else {
        let items = (data as Equipo[]) || [];

        // Filtro de seguridad en memoria si la lista de excluidos superaba el límite URL de PostgREST
        if (idsArr.length > 150) {
          items = items.filter((eq) => !idsAExcluir.has(eq.id));
        }

        setEquiposPaginados(items);
        setTotalCoincidentes(count ?? items.length);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Error al consultar equipos en Supabase:', err);
      setError(`Error de conexión al consultar catálogo: ${msg}`);
      setEquiposPaginados([]);
      setTotalCoincidentes(0);
    } finally {
      setCargando(false);
    }
  }, [
    open,
    debouncedBusqueda,
    filtroServicio,
    filtroMarca,
    excluirOtrosConvenios,
    equiposYaAmparadosIds,
    equiposEnOtrosConveniosIds,
    paginaActual,
    pageSize,
  ]);

  // Ejecutar consulta al cambiar dependencias
  useEffect(() => {
    consultarEquipos();
  }, [consultarEquipos]);

  // Cálculos de paginación
  const totalPages = Math.max(1, Math.ceil(totalCoincidentes / pageSize));
  const registroInicio = totalCoincidentes === 0 ? 0 : (paginaActual - 1) * pageSize + 1;
  const registroFin = Math.min((paginaActual - 1) * pageSize + pageSize, totalCoincidentes);

  // Manejar selección / deselección individual con persistencia
  const toggleSelect = (eq: Equipo) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(eq.id)) {
        next.delete(eq.id);
      } else {
        next.add(eq.id);
      }
      return next;
    });

    setEquiposSeleccionadosDetalle((prev) => {
      const next = new Map(prev);
      if (next.has(eq.id)) {
        next.delete(eq.id);
      } else {
        next.set(eq.id, eq);
      }
      return next;
    });
  };

  // Seleccionar o deseleccionar todos los equipos de la página actual visible
  const toggleSelectPaginaActual = () => {
    if (equiposPaginados.length === 0) return;

    const todosPaginaSeleccionados = equiposPaginados.every((e) => seleccionados.has(e.id));

    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (todosPaginaSeleccionados) {
        equiposPaginados.forEach((e) => next.delete(e.id));
      } else {
        equiposPaginados.forEach((e) => next.add(e.id));
      }
      return next;
    });

    setEquiposSeleccionadosDetalle((prev) => {
      const next = new Map(prev);
      if (todosPaginaSeleccionados) {
        equiposPaginados.forEach((e) => next.delete(e.id));
      } else {
        equiposPaginados.forEach((e) => next.set(e.id, e));
      }
      return next;
    });
  };

  // Quitar un equipo de la lista de preseleccionados
  const quitarSeleccionado = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setEquiposSeleccionadosDetalle((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  // Vaciar toda la selección acumulada
  const vaciarSeleccion = () => {
    setSeleccionados(new Set());
    setEquiposSeleccionadosDetalle(new Map());
  };

  // Limpiar todos los filtros de búsqueda
  const handleLimpiarFiltros = () => {
    setBusqueda('');
    setFiltroServicio('todos');
    setFiltroMarca('todas');
    setExcluirOtrosConvenios(true);
    setPaginaActual(1);
  };

  // Confirmar y guardar la asociación en bloque en la base de datos
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

      const { error: err } = await supabase.from('convenio_equipos').insert(itemsToInsert);

      if (err) throw err;

      onSuccess(
        `Se han asociado con éxito ${seleccionados.size} equipo(s) al convenio "${convenio.codigo}".`
      );
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  };

  // Lista de preseleccionados en array para la pestaña de revisión
  const listaPreseleccionados = useMemo(() => {
    return Array.from(equiposSeleccionadosDetalle.values());
  }, [equiposSeleccionadosDetalle]);

  const filtrosActivos = useMemo(() => {
    let count = 0;
    if (busqueda.trim() !== '') count++;
    if (filtroServicio !== 'todos') count++;
    if (filtroMarca !== 'todas') count++;
    if (!excluirOtrosConvenios) count++;
    return count;
  }, [busqueda, filtroServicio, filtroMarca, excluirOtrosConvenios]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-asociar-equipos-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-4 flex-shrink-0">
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
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Pestañas de navegación interna: Catálogo vs Preseleccionados */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 pt-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTabActiva('catalogo')}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                tabActiva === 'catalogo'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Buscador y Catálogo Hospitalario</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 font-semibold">
                {totalCoincidentes.toLocaleString()}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTabActiva('preseleccionados')}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                tabActiva === 'preseleccionados'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Equipos Preseleccionados</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  seleccionados.size > 0
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {seleccionados.size}
              </span>
            </button>
          </div>

          {seleccionados.size > 0 && (
            <button
              type="button"
              onClick={vaciarSeleccion}
              className="text-xs text-rose-600 hover:text-rose-800 font-medium pb-2 inline-flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
              <span>Vaciar selección ({seleccionados.size})</span>
            </button>
          )}
        </div>

        {/* Mensaje de Error si ocurre */}
        {error && (
          <div className="mx-6 mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex-shrink-0 animate-in fade-in">
            <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 font-mono text-[11px]">{error}</div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-700 p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* CUERPO DE LA MODAL */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {tabActiva === 'catalogo' ? (
            <>
              {/* Bloque de Búsqueda y Filtros Multicriterio */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Buscador de texto reactivo con debounce */}
                  <div className="sm:col-span-6">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Buscador General Multicriterio
                    </label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar por código, nombre, serie, modelo..."
                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                      />
                      {busqueda && (
                        <button
                          type="button"
                          onClick={() => setBusqueda('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Selector de Servicio Clínico */}
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Servicio Clínico
                    </label>
                    <div className="relative">
                      <Building2 className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <select
                        value={filtroServicio}
                        onChange={(e) => setFiltroServicio(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none cursor-pointer truncate"
                      >
                        <option value="todos">
                          {cargandoFiltros ? 'Cargando servicios...' : `Todos los servicios (${serviciosDisponibles.length})`}
                        </option>
                        {serviciosDisponibles.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Selector de Marca */}
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Marca Fabricante
                    </label>
                    <div className="relative">
                      <Tag className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <select
                        value={filtroMarca}
                        onChange={(e) => setFiltroMarca(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none cursor-pointer truncate"
                      >
                        <option value="todas">
                          {cargandoFiltros ? 'Cargando marcas...' : `Todas las marcas (${marcasDisponibles.length})`}
                        </option>
                        {marcasDisponibles.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Fila de Filtros Complementarios: Excluir otros convenios + Reset */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-2.5 text-xs">
                  <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer select-none font-medium">
                    <input
                      type="checkbox"
                      checked={excluirOtrosConvenios}
                      onChange={(e) => setExcluirOtrosConvenios(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      Excluir equipos ya asignados a otro convenio activo
                      {equiposEnOtrosConveniosIds.size > 0 && (
                        <span className="text-[10px] text-slate-500 font-normal">
                          ({equiposEnOtrosConveniosIds.size} amparados)
                        </span>
                      )}
                    </span>
                  </label>

                  {filtrosActivos > 0 && (
                    <button
                      type="button"
                      onClick={handleLimpiarFiltros}
                      className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Limpiar filtros ({filtrosActivos})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Barra de Estadísticas de Resultados y Selección Rápida */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2.5 pt-1 text-xs">
                {/* Contador de coincidencias real */}
                <div className="text-slate-600 flex items-center gap-1.5">
                  {cargando ? (
                    <span className="inline-flex items-center gap-1.5 text-blue-600 font-semibold">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Consultando base de datos...
                    </span>
                  ) : (
                    <span>
                      Mostrando{' '}
                      <strong className="text-slate-900">{registroInicio} - {registroFin}</strong> de{' '}
                      <strong className="text-blue-700">{totalCoincidentes.toLocaleString()}</strong> equipos encontrados{' '}
                      <span className="text-slate-400 font-normal">
                        (Total catastro: {totalCatastro.toLocaleString()}+)
                      </span>
                    </span>
                  )}
                </div>

                {/* Acciones de selección de página */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleSelectPaginaActual}
                    disabled={equiposPaginados.length === 0}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-40 cursor-pointer"
                  >
                    {equiposPaginados.length > 0 && equiposPaginados.every((e) => seleccionados.has(e.id)) ? (
                      <>
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                        <span>Deseleccionar pág. visible ({equiposPaginados.length})</span>
                      </>
                    ) : (
                      <>
                        <Square className="h-4 w-4 text-slate-400" />
                        <span>Marcar pág. visible ({equiposPaginados.length})</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                    <span className="text-[11px] text-slate-500">Filas:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="rounded border border-slate-300 bg-white py-0.5 px-1.5 text-xs text-slate-700 focus:outline-none cursor-pointer"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Listado con Checkboxes */}
              <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-2xs">
                {cargando && equiposPaginados.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <span className="text-xs font-medium text-slate-600">
                      Buscando en los +3.900 equipos de Supabase...
                    </span>
                  </div>
                ) : equiposPaginados.length === 0 ? (
                  <div className="py-14 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                    <Boxes className="h-8 w-8 text-slate-300" />
                    <p className="font-semibold text-slate-600">
                      No se encontraron equipos con los criterios de búsqueda.
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      Prueba modificando el texto o ampliando los filtros de servicio clínico o marca.
                    </p>
                    {filtrosActivos > 0 && (
                      <button
                        type="button"
                        onClick={handleLimpiarFiltros}
                        className="mt-2 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                      >
                        Limpiar todos los filtros
                      </button>
                    )}
                  </div>
                ) : (
                  equiposPaginados.map((eq) => {
                    const checked = seleccionados.has(eq.id);
                    return (
                      <div
                        key={eq.id}
                        onClick={() => toggleSelect(eq)}
                        className={`flex items-center justify-between p-3 cursor-pointer transition select-none ${
                          checked
                            ? 'bg-blue-50/90 text-blue-900 border-l-4 border-l-blue-600'
                            : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {}}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-blue-700 flex-shrink-0">
                                {eq.codigo}
                              </span>
                              <span className="font-semibold text-xs text-slate-900 truncate">
                                {eq.nombre}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-slate-500">
                              {eq.marca && <span>{eq.marca}</span>}
                              {eq.modelo && <span>• {eq.modelo}</span>}
                              {eq.serie && <span className="font-mono">SN: {eq.serie}</span>}
                              {eq.inventario && <span>Inv: {eq.inventario}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0 ml-3">
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                            <Building2 className="h-3 w-3 text-slate-500" />
                            <span className="max-w-[130px] truncate">{eq.ubicacion || 'Sin servicio'}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Barra de Paginación */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                <span className="text-slate-500 text-[11px]">
                  Página <strong className="text-slate-900">{paginaActual}</strong> de{' '}
                  <strong className="text-slate-900">{totalPages}</strong>
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPaginaActual((prev) => Math.max(1, prev - 1))}
                    disabled={paginaActual <= 1 || cargando}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Anterior</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaginaActual((prev) => Math.min(totalPages, prev + 1))}
                    disabled={paginaActual >= totalPages || cargando}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* VISTA DE EQUIPOS PRESELECCIONADOS ACUMULADOS */
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold">
                      {seleccionados.size} equipo(s) preparados para asociar
                    </p>
                    <p className="text-[11px] text-blue-700">
                      Esta lista se mantiene intacta aunque cambies de servicio clínico o busques otros equipos en el catálogo.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTabActiva('catalogo')}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer"
                >
                  + Seguir buscando
                </button>
              </div>

              {listaPreseleccionados.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2 border border-dashed border-slate-200 rounded-xl">
                  <Boxes className="h-8 w-8 text-slate-300" />
                  <p className="font-semibold text-slate-600">No has seleccionado ningún equipo aún</p>
                  <p className="text-slate-400 text-[11px]">
                    Vuelve a la pestaña de Catálogo Hospitalario para marcar los equipos que deseas vincular.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTabActiva('catalogo')}
                    className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Ir al Catálogo de Equipos
                  </button>
                </div>
              ) : (
                <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-2xs">
                  {listaPreseleccionados.map((eq, index) => (
                    <div
                      key={eq.id}
                      className="flex items-center justify-between p-3 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-800 flex-shrink-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-blue-700">{eq.codigo}</span>
                            <span className="font-semibold text-xs text-slate-900 truncate">
                              {eq.nombre}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            {eq.marca && <span>{eq.marca}</span>}
                            {eq.modelo && <span>• {eq.modelo}</span>}
                            {eq.serie && <span className="font-mono">SN: {eq.serie}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                          <Building2 className="h-3 w-3 text-slate-500" />
                          <span className="max-w-[120px] truncate">{eq.ubicacion || 'Sin servicio'}</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => quitarSeleccionado(eq.id)}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                          title="Quitar de la preselección"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4 flex-shrink-0">
          <div className="text-xs text-slate-500">
            {seleccionados.size > 0 ? (
              <span>
                Total acumulado:{' '}
                <strong className="text-blue-700 font-bold">{seleccionados.size} equipo(s)</strong> listos
                para asociar al convenio.
              </span>
            ) : (
              <span>Selecciona equipos de la lista para activar la asociación en bloque.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAsociar}
              disabled={guardando || seleccionados.size === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition active:scale-95 cursor-pointer"
            >
              {guardando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Asociando {seleccionados.size} equipos...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Asociar en Bloque ({seleccionados.size} seleccionados)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
