import { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  Filter,
  Plus,
  Clock,
  CheckCircle2,
  FileText,
  ExternalLink,
  ChevronRight,
  Layers,
  Eye,
  Trash2,
  Database,
  Code2,
  Copy,
  Check,
  X,
} from 'lucide-react';
import {
  type Equipo,
  type Externalizacion,
  type EtapaExternalizacion,
} from '@/lib/supabase';
import {
  fetchExternalizaciones,
  deleteExternalizacion,
  getProgresoPorcentaje,
  ETAPAS_ORDEN,
  checkSupabaseExternalizacionesStatus,
  SQL_MIGRATION_EXTERNALIZACIONES,
} from '@/lib/externalizacionStorage';
import ActualizarEtapaCompraModal from './ActualizarEtapaCompraModal';
import ExternalizacionModal from './ExternalizacionModal';

interface ExternalizacionViewProps {
  equipos: Equipo[];
  onNavigateToMantenimiento?: () => void;
}

export default function ExternalizacionView({
  equipos,
  onNavigateToMantenimiento,
}: ExternalizacionViewProps) {
  const [items, setItems] = useState<Externalizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [etapaFiltro, setEtapaFiltro] = useState<string>('todos');
  const [origenFiltro, setOrigenFiltro] = useState<string>('todos');

  // Supabase Table Status & SQL Modal
  const [supabaseStatus, setSupabaseStatus] = useState<{ exists: boolean; message?: string } | null>(null);
  const [sqlModalOpen, setSqlModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Modals
  const [modalEtapaOpen, setModalEtapaOpen] = useState(false);
  const [selectedExt, setSelectedExt] = useState<Externalizacion | null>(null);

  const [modalDirectaOpen, setModalDirectaOpen] = useState(false);

  // Detail Drawer / Modal
  const [detailModalExt, setDetailModalExt] = useState<Externalizacion | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [data, status] = await Promise.all([
      fetchExternalizaciones(),
      checkSupabaseExternalizacionesStatus(),
    ]);
    setItems(data);
    setSupabaseStatus(status);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const cotizacion = items.filter((i) => i.etapa_actual === 'Cotización / Evaluación Técnica').length;
    const tramite = items.filter(
      (i) =>
        i.etapa_actual === 'Informe de Requerimiento Creado' ||
        i.etapa_actual === 'Solicitud de Compra Asignada'
    ).length;
    const esperaOc = items.filter((i) => i.etapa_actual === 'En Espera de Orden de Compra').length;
    const finalizadas = items.filter((i) => i.etapa_actual === 'Finalizada / Recibida').length;

    const montoTotal = items.reduce((acc, curr) => acc + (curr.monto_estimado || 0), 0);

    return { total, cotizacion, tramite, esperaOc, finalizadas, montoTotal };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search
      if ((search || '').trim()) {
        const q = (search || '').trim().toLowerCase();
        const matchCode = item.codigo?.toLowerCase().includes(q);
        const matchMant = item.codigo_mantenimiento?.toLowerCase().includes(q);
        const matchDesc = item.descripcion?.toLowerCase().includes(q);
        const matchSol = item.solicitante?.toLowerCase().includes(q);
        const matchEq = item.equipo_identificacion?.toLowerCase().includes(q);
        const matchOc = item.numero_oc?.toLowerCase().includes(q);
        const matchFolio =
          item.informe_req_folio?.toLowerCase().includes(q) ||
          item.solicitud_compra_folio?.toLowerCase().includes(q);

        if (
          !matchCode &&
          !matchMant &&
          !matchDesc &&
          !matchSol &&
          !matchEq &&
          !matchOc &&
          !matchFolio
        ) {
          return false;
        }
      }

      // Etapa filter
      if (etapaFiltro !== 'todos') {
        if (item.etapa_actual !== etapaFiltro) return false;
      }

      // Origen filter
      if (origenFiltro !== 'todos') {
        if (item.origen !== origenFiltro) return false;
      }

      return true;
    });
  }, [items, search, etapaFiltro, origenFiltro]);

  const handleOpenGestion = (ext: Externalizacion) => {
    setSelectedExt(ext);
    setModalEtapaOpen(true);
  };

  const handleExtUpdated = (updated: Externalizacion) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    if (detailModalExt && detailModalExt.id === updated.id) {
      setDetailModalExt(updated);
    }
  };

  const handleExtCreated = (nueva: Externalizacion) => {
    setItems((prev) => [nueva, ...prev]);
  };

  const handleDelete = async (id: string, codigo: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar el registro de externalización ${codigo}?`)) {
      return;
    }
    const ok = await deleteExternalizacion(id);
    if (ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (detailModalExt?.id === id) setDetailModalExt(null);
    }
  };

  const formatCurrency = (val?: number | null) => {
    if (val == null) return '-';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getEtapaBadge = (etapa: EtapaExternalizacion) => {
    switch (etapa) {
      case 'Cotización / Evaluación Técnica':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          dot: 'bg-amber-500',
          step: '1/5',
        };
      case 'Informe de Requerimiento Creado':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          dot: 'bg-blue-500',
          step: '2/5',
        };
      case 'Solicitud de Compra Asignada':
        return {
          bg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          dot: 'bg-indigo-500',
          step: '3/5',
        };
      case 'En Espera de Orden de Compra':
        return {
          bg: 'bg-purple-50 text-purple-800 border-purple-200',
          dot: 'bg-purple-500',
          step: '4/5',
        };
      case 'Finalizada / Recibida':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-500',
          step: '5/5',
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
          step: '-',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <ShoppingBag className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Externalización y Seguimiento de Adquisiciones
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Control de compras clínicas, insumos y servicios tercerizados (Línea A: OT de Mantenimiento | Línea B: Solicitud Directa)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSqlModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            title="Ver o configurar la tabla de Supabase"
          >
            <Database className="h-4 w-4 text-slate-500" />
            <span>Configuración BD</span>
          </button>

          <button
            type="button"
            onClick={() => setModalDirectaOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>+ Nueva Solicitud Externa Directa</span>
          </button>
        </div>
      </div>

      {/* Banner de Estado de Base de Datos Supabase */}
      {supabaseStatus && !supabaseStatus.exists && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/50 p-4 text-xs text-amber-900 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 flex-shrink-0 mt-0.5">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-950">Almacenamiento Local Activo</span>
                <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                  Respaldo automático sin pérdida de datos
                </span>
              </div>
              <p className="text-amber-800 mt-0.5 leading-relaxed">
                La tabla <code className="rounded bg-amber-100/80 px-1 py-0.5 font-mono text-[11px] font-semibold text-amber-950">externalizaciones</code> aún no ha sido creada en tu base de datos remota de Supabase. Todas tus solicitudes se guardan y gestionan de forma segura en este navegador. Para sincronizarlas en la nube, solo debes ejecutar el script SQL en Supabase.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSqlModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition whitespace-nowrap self-end sm:self-auto"
          >
            <Code2 className="h-4 w-4" />
            <span>Ver Script SQL Supabase</span>
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total Procesos</span>
            <Layers className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</div>
          <div className="mt-1 text-[11px] text-slate-400">
            Monto: {formatCurrency(stats.montoTotal)}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-medium">1. En Cotización</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-950">{stats.cotizacion}</div>
          <div className="mt-1 text-[11px] text-amber-700 font-medium">Evaluación Técnica</div>
        </div>

        <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-medium">2-3. En Trámite</span>
            <FileText className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-950">{stats.tramite}</div>
          <div className="mt-1 text-[11px] text-blue-700 font-medium">Informe Req / Solicitud</div>
        </div>

        <div className="rounded-2xl border border-purple-200/80 bg-purple-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-xs font-medium">4. Espera de OC</span>
            <Clock className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-950">{stats.esperaOc}</div>
          <div className="mt-1 text-[11px] text-purple-700 font-medium">Mercado Público</div>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-medium">Finalizadas / Recibidas</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-950">{stats.finalizadas}</div>
          <div className="mt-1 text-[11px] text-emerald-700 font-medium">Con OC de Mercado Público</div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {/* Filters */}
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código EXT, OT, equipo, solicitante, OC..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-xs text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span>Etapa:</span>
            </div>
            <select
              value={etapaFiltro}
              onChange={(e) => setEtapaFiltro(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="todos">Todas las etapas</option>
              {ETAPAS_ORDEN.map((et) => (
                <option key={et} value={et}>
                  {et}
                </option>
              ))}
            </select>

            <select
              value={origenFiltro}
              onChange={(e) => setOrigenFiltro(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="todos">Todos los orígenes</option>
              <option value="mantenimiento">Línea A: OT Mantenimiento</option>
              <option value="directa">Línea B: Solicitud Directa</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/80 font-semibold text-slate-700">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Origen / OT</th>
                <th className="px-4 py-3">Tipo Adquisición</th>
                <th className="px-4 py-3">Equipo / Destino</th>
                <th className="px-4 py-3">Solicitante</th>
                <th className="px-4 py-3">Etapa Actual & Progreso</th>
                <th className="px-4 py-3">Monto / OC Mercado Público</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Cargando registros de adquisiciones externas...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No se encontraron procesos de externalización con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const badge = getEtapaBadge(item.etapa_actual);
                  const progressPct = getProgresoPorcentaje(item.etapa_actual);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setDetailModalExt(item)}
                          className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                        >
                          <span>{item.codigo}</span>
                        </button>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.origen === 'mantenimiento' ? (
                          <div className="flex flex-col">
                            {onNavigateToMantenimiento ? (
                              <button
                                type="button"
                                onClick={() => onNavigateToMantenimiento()}
                                className="font-mono font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200/80 text-[11px] inline-block w-fit text-left transition-colors"
                                title="Ver en Mantenimiento"
                              >
                                OT: {item.codigo_mantenimiento || 'Vinculada'}
                              </button>
                            ) : (
                              <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 text-[11px] inline-block w-fit">
                                OT: {item.codigo_mantenimiento || 'Vinculada'}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              Línea A (Derivada)
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] inline-block w-fit">
                              Directa
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              Línea B (Clínica)
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="line-clamp-2 text-[11px] font-medium text-slate-700">
                          {item.tipo}
                        </span>
                      </td>

                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="line-clamp-1 font-semibold text-slate-800 text-xs">
                          {item.equipo_identificacion || 'Stock / General'}
                        </div>
                        <div className="line-clamp-1 text-[11px] text-slate-500">
                          {item.descripcion}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-slate-700">
                          {item.solicitante}
                        </span>
                      </td>

                      <td className="px-4 py-3 min-w-[220px]">
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold ${badge.bg}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                            <span className="truncate max-w-[130px]">{item.etapa_actual}</span>
                          </span>
                          <span className="font-mono text-[10px] font-semibold text-slate-400">
                            {badge.step}
                          </span>
                        </div>
                        {/* Mini visual stepper bar */}
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full transition-all duration-300 ${
                              item.etapa_actual === 'Finalizada / Recibida'
                                ? 'bg-emerald-500'
                                : 'bg-blue-600'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {formatCurrency(item.monto_estimado)}
                        </div>
                        {item.numero_oc ? (
                          <div className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <span>OC: {item.numero_oc}</span>
                            {item.oc_url && (
                              <a
                                href={item.oc_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 hover:text-emerald-800"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sin OC emitida</span>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenGestion(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition shadow-2xs"
                            title="Gestionar y actualizar etapa"
                          >
                            <span>Gestionar</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDetailModalExt(item)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                            title="Ver Ficha de Detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {item.etapa_actual !== 'Finalizada / Recibida' && (
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id, item.codigo)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                              title="Eliminar registro"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modales */}
      <ActualizarEtapaCompraModal
        open={modalEtapaOpen}
        onClose={() => {
          setModalEtapaOpen(false);
          setSelectedExt(null);
        }}
        externalizacion={selectedExt}
        onUpdated={handleExtUpdated}
      />

      <ExternalizacionModal
        open={modalDirectaOpen}
        onClose={() => setModalDirectaOpen(false)}
        equipos={equipos}
        onCreated={handleExtCreated}
      />

      {/* Modal Ficha Detalle Completa */}
      {detailModalExt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailModalExt(null);
          }}
        >
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {detailModalExt.codigo}
                  </span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {detailModalExt.tipo}
                  </span>
                </div>
                <h3 className="mt-1 text-base font-bold text-slate-900">
                  Ficha de Adquisición y Trazabilidad
                </h3>
              </div>
              <button
                onClick={() => setDetailModalExt(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div>
                  <span className="text-slate-400 block text-[11px]">Origen</span>
                  <span className="font-semibold text-slate-800">
                    {detailModalExt.origen === 'mantenimiento'
                      ? `Línea A — OT ${detailModalExt.codigo_mantenimiento || 'OT'}`
                      : 'Línea B — Solicitud Directa'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Solicitante</span>
                  <span className="font-semibold text-slate-800">{detailModalExt.solicitante}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Equipo / Destino</span>
                  <span className="font-semibold text-slate-800">
                    {detailModalExt.equipo_identificacion || 'Stock / General'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Etapa Actual</span>
                  <span className="font-bold text-blue-700">{detailModalExt.etapa_actual}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] mb-1">Descripción del Requerimiento</span>
                <p className="rounded-lg border border-slate-200 bg-white p-3 text-slate-700">
                  {detailModalExt.descripcion}
                </p>
              </div>

              {/* Trazabilidad por Etapas */}
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {/* 1. Cotización */}
                <div className="p-3.5 bg-white flex items-start justify-between">
                  <div>
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="h-5 w-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">1</span>
                      Cotización Técnica
                    </span>
                    <div className="mt-1 text-slate-600">
                      Monto Estimado:{' '}
                      <span className="font-semibold">{formatCurrency(detailModalExt.monto_estimado)}</span>
                      {detailModalExt.fecha_cotizacion && ` • Fecha: ${detailModalExt.fecha_cotizacion}`}
                    </div>
                  </div>
                  {detailModalExt.cotizacion_url && (
                    <a
                      href={detailModalExt.cotizacion_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      <span>Ver Cotización</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                {/* 2. Informe Req */}
                <div className="p-3.5 bg-white flex items-start justify-between">
                  <div>
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="h-5 w-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">2</span>
                      Informe de Requerimiento Institucional
                    </span>
                    <div className="mt-1 text-slate-600">
                      Folio: <span className="font-mono font-semibold">{detailModalExt.informe_req_folio || 'Sin registrar'}</span>
                      {detailModalExt.fecha_informe_req && ` • Fecha: ${detailModalExt.fecha_informe_req}`}
                    </div>
                  </div>
                  {detailModalExt.informe_req_url && (
                    <a
                      href={detailModalExt.informe_req_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      <span>Ver PDF Req</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                {/* 3. Solicitud Compra */}
                <div className="p-3.5 bg-white flex items-start justify-between">
                  <div>
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="h-5 w-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">3</span>
                      Solicitud de Compra Tramitada
                    </span>
                    <div className="mt-1 text-slate-600">
                      Folio SC: <span className="font-mono font-semibold">{detailModalExt.solicitud_compra_folio || 'Sin registrar'}</span>
                      {detailModalExt.fecha_solicitud_compra && ` • Fecha: ${detailModalExt.fecha_solicitud_compra}`}
                    </div>
                  </div>
                  {detailModalExt.solicitud_compra_url && (
                    <a
                      href={detailModalExt.solicitud_compra_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      <span>Gestor ERP</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                {/* 4. OC Mercado Público */}
                <div className="p-3.5 bg-white flex items-start justify-between">
                  <div>
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="h-5 w-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[10px]">4</span>
                      Orden de Compra Mercado Público
                    </span>
                    <div className="mt-1 text-slate-600">
                      N° OC: <span className="font-mono font-bold text-emerald-700">{detailModalExt.numero_oc || 'Pendiente de emisión'}</span>
                      {detailModalExt.fecha_oc && ` • Fecha: ${detailModalExt.fecha_oc}`}
                      {detailModalExt.fecha_recepcion && ` • Recibido: ${detailModalExt.fecha_recepcion}`}
                    </div>
                  </div>
                  {detailModalExt.oc_url && (
                    <a
                      href={detailModalExt.oc_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 font-semibold"
                    >
                      <span>Ver OC</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {detailModalExt.notas && (
                <div>
                  <span className="text-slate-400 block text-[11px] mb-1">Notas y Bitácora</span>
                  <p className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-slate-700 italic">
                    {detailModalExt.notas}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
              <button
                type="button"
                onClick={() => setDetailModalExt(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  const ext = detailModalExt;
                  setDetailModalExt(null);
                  handleOpenGestion(ext);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <span>Gestionar Etapa</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Script SQL Supabase */}
      {sqlModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSqlModalOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Script SQL para Supabase (Tabla Externalizaciones)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Habilita la persistencia en la nube en tu proyecto de Supabase
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSqlModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900">
                <div className="font-semibold text-blue-950 mb-1">
                  ¿Cómo habilitar la sincronización en la nube?
                </div>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>Ingresa a tu consola de <strong>Supabase</strong>.</li>
                  <li>Ve a la pestaña <strong>SQL Editor</strong> en la barra lateral izquierda.</li>
                  <li>Haz clic en <strong>New Query</strong>, pega el código a continuación y presiona <strong>Run</strong>.</li>
                </ol>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between rounded-t-xl bg-slate-800 px-4 py-2 text-xs text-slate-300">
                  <span className="font-mono text-[11px]">schema_externalizaciones.sql</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(SQL_MIGRATION_EXTERNALIZACIONES);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2500);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-600 transition"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-300">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar SQL</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-b-xl bg-slate-900 p-4 font-mono text-[11px] text-emerald-300 leading-relaxed max-h-72">
                  {SQL_MIGRATION_EXTERNALIZACIONES}
                </pre>
              </div>

              <p className="text-xs text-slate-500">
                <strong>Nota:</strong> Mientras la tabla no esté creada en Supabase, el sistema opera con <strong>almacenamiento local persistente</strong> en el navegador, permitiendo crear solicitudes, avanzar etapas y registrar órdenes de compra sin interrupciones.
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
              <button
                type="button"
                onClick={() => {
                  loadData();
                  setSqlModalOpen(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                <span>Reverificar Conexión</span>
              </button>

              <button
                type="button"
                onClick={() => setSqlModalOpen(false)}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
