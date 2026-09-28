import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  DollarSign,
  Receipt,
  AlertTriangle,
  Clock,
  Boxes,
  Plus,
  Search,
  Filter,
  Download,
  Edit2,
  Trash2,
  X,
  RotateCcw,
  CheckCircle2,
  Building2,
  Unlink,
  Loader2,
} from 'lucide-react';
import {
  supabase,
  type Convenio,
  type ConvenioEquipo,
  type ConvenioCuotaMensual,
  type Equipo,
} from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';
import { exportarACSV, type ExportColumn } from '@/utils/exportUtils';
import CuotaModal from '@/components/CuotaModal';
import ConvenioModal from '@/components/ConvenioModal';
import AsociarEquiposModal from '@/components/AsociarEquiposModal';
import DesvincularEquipoModal from '@/components/DesvincularEquipoModal';

type SubTab = 'matriz' | 'convenios';

export default function ConveniosView() {
  const { puede, esAdmin } = useAuth();
  const puedeGestionar = esAdmin || puede('gestionar_convenios');

  const [subTab, setSubTab] = useState<SubTab>('matriz');

  // Datos
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [cuotas, setCuotas] = useState<ConvenioCuotaMensual[]>([]);
  const [convenioEquipos, setConvenioEquipos] = useState<ConvenioEquipo[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(true);

  // Convenio Seleccionado para vista de detalle
  const [convenioSeleccionadoId, setConvenioSeleccionadoId] = useState<string | null>(null);

  // Filtros de la Matriz UIC
  const [busquedaMatriz, setBusquedaMatriz] = useState('');
  const [filtroEstadoUic, setFiltroEstadoUic] = useState<string>('todos');
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todas');
  const [filtroMes, setFiltroMes] = useState<string>('todos');
  const [filtroAnio, setFiltroAnio] = useState<string>('todos');
  const [filtroEstadoMP, setFiltroEstadoMP] = useState<string>('todos');

  // Filtros de la vista de Convenios
  const [busquedaConvenio, setBusquedaConvenio] = useState('');
  const [filtroTipoConvenio, setFiltroTipoConvenio] = useState<string>('todos');
  const [filtroEstadoConvenio, setFiltroEstadoConvenio] = useState<string>('todos');

  // Modales
  const [cuotaModalOpen, setCuotaModalOpen] = useState(false);
  const [cuotaEditando, setCuotaEditando] = useState<ConvenioCuotaMensual | null>(null);

  const [convenioModalOpen, setConvenioModalOpen] = useState(false);
  const [convenioEditando, setConvenioEditando] = useState<Convenio | null>(null);

  // Modal de confirmación para eliminar convenio
  const [convenioAEliminar, setConvenioAEliminar] = useState<Convenio | null>(null);
  const [eliminandoConvenio, setEliminandoConvenio] = useState(false);
  const [vistaConvenios, setVistaConvenios] = useState<'detalle' | 'tabla'>('detalle');

  const [asociarModalOpen, setAsociarModalOpen] = useState(false);

  const [desvincularModalOpen, setDesvincularModalOpen] = useState(false);
  const [vinculoADesvincular, setVinculoADesvincular] = useState<ConvenioEquipo | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null);

  const mostrarToast = (tipo: 'exito' | 'error', mensaje: string) => {
    setToast({ tipo, mensaje });
    setTimeout(() => {
      setToast((curr) => (curr?.mensaje === mensaje ? null : curr));
    }, 4500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resConv, resCuotas, resVinculos, resEq] = await Promise.all([
        supabase.from('convenios').select('*').order('created_at', { ascending: false }),
        supabase.from('convenio_cuotas_mensuales').select('*').order('anio', { ascending: false }),
        supabase.from('convenio_equipos').select('*').order('fecha_incorporacion', { ascending: false }),
        supabase.from('equipos').select('*').order('codigo', { ascending: true }),
      ]);

      if (resConv.data) setConvenios(resConv.data as Convenio[]);
      if (resCuotas.data) setCuotas(resCuotas.data as ConvenioCuotaMensual[]);
      if (resVinculos.data) setConvenioEquipos(resVinculos.data as ConvenioEquipo[]);
      if (resEq.data) {
        let todosEquipos = resEq.data as Equipo[];
        if (resVinculos.data) {
          const vinculos = resVinculos.data as ConvenioEquipo[];
          const idsEnVinculos = new Set(vinculos.map((v) => v.equipo_id));
          const idsCargados = new Set(todosEquipos.map((e) => e.id));
          const faltantes = Array.from(idsEnVinculos).filter((id) => !idsCargados.has(id));
          if (faltantes.length > 0) {
            try {
              const { data: eqFaltantes } = await supabase.from('equipos').select('*').in('id', faltantes);
              if (eqFaltantes) {
                todosEquipos = [...todosEquipos, ...(eqFaltantes as Equipo[])];
              }
            } catch (errF) {
              console.warn('Error cargando equipos faltantes para convenios:', errF);
            }
          }
        }
        setEquipos(todosEquipos);
      }
    } catch (err) {
      console.error('[ConveniosView] Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Selección por defecto del primer convenio si no hay ninguno seleccionado
  useEffect(() => {
    if (!convenioSeleccionadoId && convenios.length > 0) {
      setConvenioSeleccionadoId(convenios[0].id);
    }
  }, [convenios, convenioSeleccionadoId]);

  // 1. CINTILLO SUPERIOR DE AUDITORÍA (KPIs)
  const kpis = useMemo(() => {
    const totalComprometidoClp = convenios.reduce((acc, c) => acc + (c.monto_total_comprometido || 0), 0);
    const totalComprometidoUf = Math.round(totalComprometidoClp / 38500);

    // Monto Ejecutado / Facturado Conforme ($)
    const montoEjecutadoClp = cuotas
      .filter((q) => q.estado_uic === 'Facturado Conforme' || q.estado_uic === 'Pagado' || q.estado_mercado_publico === 'Recepcionado Conforme')
      .reduce((acc, q) => acc + (q.valor_clp || 0), 0);

    // Saldo Deuda / Pendiente ($)
    const saldoDeudaClp = Math.max(0, totalComprometidoClp - montoEjecutadoClp);

    // Convenios / Comodatos por Vencer (< 60 días)
    const hoy = new Date();
    const conveniosPorVencer = convenios.filter((c) => {
      if (!c.fecha_termino) return false;
      const diffDays = Math.ceil((new Date(c.fecha_termino).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 60;
    });

    // Cuotas con Traba Administrativa (con guía emitida pero en estado 'Pendiente de OC' o 'Sin presupuesto')
    const cuotasTrabaAdmin = cuotas.filter((q) => {
      const tieneGuia = Boolean(q.numero_guia && q.numero_guia.trim() !== '');
      const estado = (q.estado_uic || '').trim().toLowerCase();
      return tieneGuia && (estado === 'pendiente de oc' || estado === 'sin presupuesto');
    });

    return {
      totalComprometidoClp,
      totalComprometidoUf,
      montoEjecutadoClp,
      saldoDeudaClp,
      conveniosPorVencer,
      cuotasTrabaAdmin,
    };
  }, [convenios, cuotas]);

  // Listas para subfiltros de la Matriz UIC
  const listaEmpresas = useMemo(() => {
    const set = new Set<string>();
    cuotas.forEach((q) => {
      if (q.empresa && q.empresa.trim()) set.add(q.empresa.trim());
    });
    return Array.from(set).sort();
  }, [cuotas]);

  const listaMeses = useMemo(() => {
    const set = new Set<string>();
    cuotas.forEach((q) => {
      if (q.mes && q.mes.trim()) set.add(q.mes.trim());
    });
    return Array.from(set).sort();
  }, [cuotas]);

  const listaAnios = useMemo(() => {
    const set = new Set<number>();
    cuotas.forEach((q) => {
      if (q.anio) set.add(q.anio);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [cuotas]);

  const listaEstadosUIC = useMemo(() => {
    const set = new Set<string>();
    cuotas.forEach((q) => {
      if (q.estado_uic && q.estado_uic.trim()) set.add(q.estado_uic.trim());
    });
    return Array.from(set).sort();
  }, [cuotas]);

  const listaEstadosMP = useMemo(() => {
    const set = new Set<string>();
    cuotas.forEach((q) => {
      if (q.estado_mercado_publico && q.estado_mercado_publico.trim()) set.add(q.estado_mercado_publico.trim());
    });
    return Array.from(set).sort();
  }, [cuotas]);

  // Filtrado de la Matriz UIC
  const cuotasFiltradas = useMemo(() => {
    const q = busquedaMatriz.trim().toLowerCase();
    return cuotas.filter((item) => {
      // Buscador global
      if (q) {
        const match =
          item.empresa?.toLowerCase().includes(q) ||
          item.numero_guia?.toLowerCase().includes(q) ||
          item.codigo_mi_ssvq?.toLowerCase().includes(q) ||
          item.equipo_servicio?.toLowerCase().includes(q) ||
          item.orden_compra?.toLowerCase().includes(q) ||
          item.numero_factura?.toLowerCase().includes(q) ||
          item.estado_uic?.toLowerCase().includes(q) ||
          item.estado_mercado_publico?.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Filtros
      if (filtroEstadoUic !== 'todos' && item.estado_uic !== filtroEstadoUic) return false;
      if (filtroEmpresa !== 'todas' && item.empresa !== filtroEmpresa) return false;
      if (filtroMes !== 'todos' && item.mes !== filtroMes) return false;
      if (filtroAnio !== 'todos' && String(item.anio) !== filtroAnio) return false;
      if (filtroEstadoMP !== 'todos' && item.estado_mercado_publico !== filtroEstadoMP) return false;

      return true;
    });
  }, [cuotas, busquedaMatriz, filtroEstadoUic, filtroEmpresa, filtroMes, filtroAnio, filtroEstadoMP]);

  // Filtrado de Convenios
  const conveniosFiltrados = useMemo(() => {
    const q = busquedaConvenio.trim().toLowerCase();
    return convenios.filter((c) => {
      if (q) {
        const match =
          c.codigo.toLowerCase().includes(q) ||
          c.nombre.toLowerCase().includes(q) ||
          c.empresa.toLowerCase().includes(q) ||
          (c.orden_compra_madre && c.orden_compra_madre.toLowerCase().includes(q)) ||
          (c.responsable && c.responsable.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (filtroTipoConvenio !== 'todos' && c.tipo_convenio !== filtroTipoConvenio) return false;
      if (filtroEstadoConvenio !== 'todos' && c.estado !== filtroEstadoConvenio) return false;
      return true;
    });
  }, [convenios, busquedaConvenio, filtroTipoConvenio, filtroEstadoConvenio]);

  // Convenio actualmente seleccionado para detalle y equipos
  const convenioSeleccionado = useMemo(() => {
    return convenios.find((c) => c.id === convenioSeleccionadoId) || convenios[0] || null;
  }, [convenios, convenioSeleccionadoId]);

  // Equipos vinculados al convenio actualmente seleccionado
  const vinculosDelConvenio = useMemo(() => {
    if (!convenioSeleccionado) return [];
    return convenioEquipos.filter((ce) => ce.convenio_id === convenioSeleccionado.id);
  }, [convenioEquipos, convenioSeleccionado]);

  // IDs de equipos actualmente amparados de forma activa
  const equiposActivosIds = useMemo(() => {
    if (!convenioSeleccionado) return [];
    return vinculosDelConvenio
      .filter((v) => v.estado_vinculo === 'Activo')
      .map((v) => v.equipo_id);
  }, [vinculosDelConvenio, convenioSeleccionado]);

  // Manejo de exportación a CSV con formato compatible con Windows/Excel
  const handleExportarMatrizCSV = () => {
    const columnas: ExportColumn<ConvenioCuotaMensual>[] = [
      { header: 'ESTADO UIC', accessor: (q) => q.estado_uic },
      { header: 'N° GUIA', accessor: (q) => q.numero_guia },
      { header: 'FECHA GUIA', accessor: (q) => q.fecha_guia },
      { header: 'CODIGO MI SSVQ', accessor: (q) => q.codigo_mi_ssvq },
      { header: 'FECHA ENTREGA ABASTECIMIENTO', accessor: (q) => q.fecha_entrega_abastecimiento },
      { header: 'EMPRESA', accessor: (q) => q.empresa },
      { header: 'EQUIPO / SERVICIO', accessor: (q) => q.equipo_servicio },
      { header: 'OC', accessor: (q) => q.orden_compra },
      { header: 'FECHA OC', accessor: (q) => q.fecha_oc },
      { header: 'MES', accessor: (q) => q.mes },
      { header: 'AÑO', accessor: (q) => q.anio },
      { header: 'CUOTA', accessor: (q) => q.cuota },
      { header: 'VALOR $', accessor: (q) => q.valor_clp },
      { header: 'ESTADO MERCADO PUBLICO', accessor: (q) => q.estado_mercado_publico },
      { header: 'N° FACTURA', accessor: (q) => q.numero_factura },
      { header: 'FECHA FACTURA', accessor: (q) => q.fecha_factura },
      { header: 'OBSERVACIONES', accessor: (q) => q.observaciones || '' },
    ];

    const ok = exportarACSV(cuotasFiltradas, columnas, 'Matriz_Seguimiento_Pagos_UIC');
    if (ok) {
      mostrarToast('exito', `Se exportaron ${cuotasFiltradas.length} cuotas a Excel / CSV.`);
    } else {
      mostrarToast('error', 'No hay registros visibles para exportar.');
    }
  };

  const handleEliminarCuota = async (cuotaId: string) => {
    if (!confirm('¿Confirmas la eliminación de este registro de cuota mensual?')) return;
    try {
      const { error: err } = await supabase
        .from('convenio_cuotas_mensuales')
        .delete()
        .eq('id', cuotaId);
      if (err) throw err;
      mostrarToast('exito', 'Registro de cuota eliminado.');
      fetchData();
    } catch (e: unknown) {
      mostrarToast('error', e instanceof Error ? e.message : String(e));
    }
  };

  const handleAbrirConfirmacionEliminarConvenio = (conv: Convenio) => {
    setConvenioAEliminar(conv);
  };

  const handleConfirmarEliminarConvenio = async () => {
    if (!convenioAEliminar) return;
    if (!puedeGestionar) {
      mostrarToast('error', 'No tienes permisos para eliminar convenios.');
      return;
    }
    setEliminandoConvenio(true);
    try {
      const convenioId = convenioAEliminar.id;
      const codigoConvenio = convenioAEliminar.codigo;

      // 1. Eliminar vínculos de equipos del convenio
      await supabase.from('convenio_equipos').delete().eq('convenio_id', convenioId);

      // 2. Eliminar cuotas mensuales asociadas al convenio
      await supabase.from('convenio_cuotas_mensuales').delete().eq('convenio_id', convenioId);

      // 3. Eliminar el convenio propiamente tal
      const { error } = await supabase.from('convenios').delete().eq('id', convenioId);
      if (error) throw error;

      // 4. Actualización optimista inmediata en los estados reactivos
      setConvenios((prev) => prev.filter((c) => c.id !== convenioId));
      setConvenioEquipos((prev) => prev.filter((ce) => ce.convenio_id !== convenioId));
      setCuotas((prev) => prev.filter((cq) => cq.convenio_id !== convenioId));

      if (convenioSeleccionadoId === convenioId) {
        const restantes = convenios.filter((c) => c.id !== convenioId);
        setConvenioSeleccionadoId(restantes.length > 0 ? restantes[0].id : null);
      }

      setConvenioAEliminar(null);
      mostrarToast('exito', `Convenio ${codigoConvenio} eliminado exitosamente.`);
      await fetchData();
    } catch (err: unknown) {
      console.error('Error al eliminar convenio:', err);
      mostrarToast('error', err instanceof Error ? err.message : String(err));
    } finally {
      setEliminandoConvenio(false);
    }
  };

  const formatMoneda = (val: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getBadgeEstadoUic = (estado: string) => {
    const st = (estado || '').toLowerCase();
    if (st.includes('facturado conforme') || st.includes('pagado')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    if (st.includes('pendiente de oc')) {
      return 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
    }
    if (st.includes('sin presupuesto')) {
      return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
    }
    if (st.includes('en trámite') || st.includes('recepcionado')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl p-4 shadow-xl border backdrop-blur-md animate-in fade-in duration-200 max-w-md ${
            toast.tipo === 'exito'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200 ring-1 ring-emerald-500/30'
              : 'bg-rose-50 text-rose-900 border-rose-200 ring-1 ring-rose-500/30'
          }`}
        >
          {toast.tipo === 'exito' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          )}
          <span className="text-xs font-semibold flex-1 leading-snug">{toast.mensaje}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header Institucional de la Sección */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs ring-4 ring-blue-100">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Convenios, Control de Pagos y Auditoría de Deuda
                </h2>
                <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800 ring-1 ring-inset ring-blue-500/20">
                  UIC CORE
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Seguimiento mensual de cuotas, trazabilidad de guías de despacho, órdenes de compra y fiscalización presupuestaria
              </p>
            </div>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-wrap items-center gap-2.5">
          {puedeGestionar && (
            <button
              id="btn-nuevo-convenio"
              type="button"
              onClick={() => {
                setConvenioEditando(null);
                setConvenioModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4 text-blue-600" />
              <span>+ Nuevo Convenio</span>
            </button>
          )}

          {puedeGestionar && (
            <button
              id="btn-nueva-cuota"
              type="button"
              onClick={() => {
                setCuotaEditando(null);
                setCuotaModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition active:scale-95 cursor-pointer"
            >
              <Receipt className="h-4 w-4" />
              <span>+ Registrar Cuota</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. CINTILLO SUPERIOR DE AUDITORÍA (KPIs de Control y Alertas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: Total Presupuesto Comprometido */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Presupuesto Comprometido</span>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-slate-900 tracking-tight">
            {formatMoneda(kpis.totalComprometidoClp)}
          </p>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>Equivalente aprox:</span>
            <span className="font-mono font-bold text-slate-700">{kpis.totalComprometidoUf} UF</span>
          </div>
        </div>

        {/* KPI 2: Monto Ejecutado / Facturado Conforme */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">Facturado Conforme</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-emerald-950 tracking-tight">
            {formatMoneda(kpis.montoEjecutadoClp)}
          </p>
          <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-700 font-medium">
            <span>Ejecución presupuestaria:</span>
            <span className="font-bold">
              {kpis.totalComprometidoClp > 0
                ? `${Math.round((kpis.montoEjecutadoClp / kpis.totalComprometidoClp) * 100)}%`
                : '0%'}
            </span>
          </div>
        </div>

        {/* KPI 3: Saldo Deuda / Pendiente */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Saldo Deuda / Pendiente</span>
            <Clock className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-slate-900 tracking-tight">
            {formatMoneda(kpis.saldoDeudaClp)}
          </p>
          <div className="mt-1 text-[11px] text-slate-500">
            <span>Por facturar o en trámite de OC</span>
          </div>
        </div>

        {/* KPI 4: Convenios / Comodatos por Vencer (< 60 días) */}
        <div
          className={`rounded-2xl border p-4 shadow-xs transition ${
            kpis.conveniosPorVencer.length > 0
              ? 'border-amber-300 bg-amber-50/60 ring-2 ring-amber-500/20'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold ${
                kpis.conveniosPorVencer.length > 0 ? 'text-amber-900' : 'text-slate-500'
              }`}
            >
              Vence &lt; 60 días
            </span>
            <AlertTriangle
              className={`h-4 w-4 ${
                kpis.conveniosPorVencer.length > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-400'
              }`}
            />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-amber-950">
              {kpis.conveniosPorVencer.length}
            </span>
            <span className="text-xs font-bold text-amber-800">
              {kpis.conveniosPorVencer.length === 1 ? 'convenio' : 'convenios'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-amber-800 line-clamp-1">
            {kpis.conveniosPorVencer.length > 0
              ? kpis.conveniosPorVencer.map((c) => c.codigo).join(', ')
              : 'Sin vencimientos críticos'}
          </div>
        </div>

        {/* KPI 5: Cuotas con Traba Administrativa */}
        <div
          className={`rounded-2xl border p-4 shadow-xs transition ${
            kpis.cuotasTrabaAdmin.length > 0
              ? 'border-rose-300 bg-rose-50/60 ring-2 ring-rose-500/20'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold ${
                kpis.cuotasTrabaAdmin.length > 0 ? 'text-rose-900' : 'text-slate-500'
              }`}
            >
              Traba Administrativa
            </span>
            <AlertTriangle
              className={`h-4 w-4 ${
                kpis.cuotasTrabaAdmin.length > 0 ? 'text-rose-600 animate-bounce' : 'text-slate-400'
              }`}
            />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-rose-950">
              {kpis.cuotasTrabaAdmin.length}
            </span>
            <span className="text-xs font-bold text-rose-800">cuota(s)</span>
          </div>
          <div className="mt-1 text-[11px] text-rose-700 font-medium">
            <span>Guía emitida, Pendiente OC / Sin saldo</span>
          </div>
        </div>
      </div>

      {/* Sub-navegación entre Matriz UIC y Convenios */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-4">
          <button
            type="button"
            onClick={() => setSubTab('matriz')}
            className={`flex items-center gap-2 border-b-2 py-2.5 text-xs font-bold transition cursor-pointer ${
              subTab === 'matriz'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>Matriz de Seguimiento Mensual de Pagos (UIC)</span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
              {cuotas.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('convenios')}
            className={`flex items-center gap-2 border-b-2 py-2.5 text-xs font-bold transition cursor-pointer ${
              subTab === 'convenios'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Boxes className="h-4 w-4" />
            <span>Convenios y Equipos Amparados</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
              {convenios.length}
            </span>
          </button>
        </nav>
      </div>

      {/* ========================================================
          SUB-TAB 1: MATRIZ DE SEGUIMIENTO MENSUAL DE PAGOS (UIC)
         ======================================================== */}
      {subTab === 'matriz' && (
        <div className="space-y-4">
          {/* Barra de Filtros, Buscador y Exportación */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Buscador Global */}
              <div className="relative flex-1 max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={busquedaMatriz}
                  onChange={(e) => setBusquedaMatriz(e.target.value)}
                  placeholder="Buscar por Empresa, Guía, Factura, OC, Equipo..."
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {busquedaMatriz && (
                  <button
                    type="button"
                    onClick={() => setBusquedaMatriz('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Botón de Exportación a Excel/CSV con BOM UTF-8 y ';' */}
              <button
                id="btn-exportar-matriz-uic"
                type="button"
                onClick={handleExportarMatrizCSV}
                disabled={cuotasFiltradas.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Exportar a CSV/Excel compatible con Windows y Excel en español"
              >
                <Download className="h-3.5 w-3.5 text-blue-600" />
                <span>Exportar Matriz ({cuotasFiltradas.length})</span>
              </button>
            </div>

            {/* Subfiltros por Cabecera */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Filter className="h-3 w-3" /> Subfiltros:
              </span>

              {/* Filtro Estado UIC */}
              <select
                value={filtroEstadoUic}
                onChange={(e) => setFiltroEstadoUic(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="todos">Todos los Estados UIC ({listaEstadosUIC.length})</option>
                {listaEstadosUIC.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>

              {/* Filtro Empresa */}
              <select
                value={filtroEmpresa}
                onChange={(e) => setFiltroEmpresa(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="todas">Todas las Empresas ({listaEmpresas.length})</option>
                {listaEmpresas.map((emp) => (
                  <option key={emp} value={emp}>
                    {emp}
                  </option>
                ))}
              </select>

              {/* Filtro Mes */}
              <select
                value={filtroMes}
                onChange={(e) => setFiltroMes(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="todos">Todos los Meses</option>
                {listaMeses.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              {/* Filtro Año */}
              <select
                value={filtroAnio}
                onChange={(e) => setFiltroAnio(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="todos">Todos los Años</option>
                {listaAnios.map((a) => (
                  <option key={a} value={String(a)}>
                    {a}
                  </option>
                ))}
              </select>

              {/* Filtro Estado Mercado Público */}
              <select
                value={filtroEstadoMP}
                onChange={(e) => setFiltroEstadoMP(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="todos">Estado Mercado Público ({listaEstadosMP.length})</option>
                {listaEstadosMP.map((emp) => (
                  <option key={emp} value={emp}>
                    {emp}
                  </option>
                ))}
              </select>

              {(filtroEstadoUic !== 'todos' ||
                filtroEmpresa !== 'todas' ||
                filtroMes !== 'todos' ||
                filtroAnio !== 'todos' ||
                filtroEstadoMP !== 'todos' ||
                busquedaMatriz !== '') && (
                <button
                  type="button"
                  onClick={() => {
                    setFiltroEstadoUic('todos');
                    setFiltroEmpresa('todas');
                    setFiltroMes('todos');
                    setFiltroAnio('todos');
                    setFiltroEstadoMP('todos');
                    setBusquedaMatriz('');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 ml-auto"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Limpiar filtros</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. TABLA INTERACTIVA UIC CON LAS 16 COLUMNAS EXACTAS */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap min-w-[1700px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="px-4 py-3.5">ESTADO UIC</th>
                    <th className="px-4 py-3.5">N° GUIA</th>
                    <th className="px-4 py-3.5">FECHA GUIA</th>
                    <th className="px-4 py-3.5">CODIGO MI SSVQ</th>
                    <th className="px-4 py-3.5">FECHA ENTREGA ABASTECIMIENTO</th>
                    <th className="px-4 py-3.5">EMPRESA</th>
                    <th className="px-4 py-3.5">EQUIPO / SERVICIO</th>
                    <th className="px-4 py-3.5">OC</th>
                    <th className="px-4 py-3.5">FECHA OC</th>
                    <th className="px-4 py-3.5">MES</th>
                    <th className="px-4 py-3.5">AÑO</th>
                    <th className="px-4 py-3.5">CUOTA</th>
                    <th className="px-4 py-3.5 text-right">VALOR $</th>
                    <th className="px-4 py-3.5">ESTADO MERCADO PUBLICO</th>
                    <th className="px-4 py-3.5">N° FACTURA</th>
                    <th className="px-4 py-3.5">FECHA FACTURA</th>
                    <th className="px-4 py-3.5 text-center sticky right-0 bg-slate-50 shadow-l">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={17} className="px-5 py-12 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                          <span className="text-sm">Cargando matriz de cuotas UIC...</span>
                        </div>
                      </td>
                    </tr>
                  ) : cuotasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="px-5 py-12 text-center text-slate-400">
                        No se encontraron registros de cuotas coincidentes.
                      </td>
                    </tr>
                  ) : (
                    cuotasFiltradas.map((q) => {
                      const esTraba =
                        Boolean(q.numero_guia && q.numero_guia.trim()) &&
                        (q.estado_uic === 'Pendiente de OC' || q.estado_uic === 'Sin presupuesto');

                      return (
                        <tr
                          key={q.id}
                          className={`hover:bg-slate-50 transition-colors ${
                            esTraba ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          {/* 1. ESTADO UIC */}
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] border ${getBadgeEstadoUic(
                                q.estado_uic
                              )}`}
                            >
                              {esTraba && <AlertTriangle className="h-3 w-3 text-amber-600" />}
                              <span>{q.estado_uic}</span>
                            </span>
                          </td>

                          {/* 2. N° GUIA */}
                          <td className="px-4 py-3 font-mono text-slate-800 font-semibold">
                            {q.numero_guia || '—'}
                          </td>

                          {/* 3. FECHA GUIA */}
                          <td className="px-4 py-3 text-slate-600">
                            {q.fecha_guia || '—'}
                          </td>

                          {/* 4. CODIGO MI SSVQ */}
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {q.codigo_mi_ssvq || '—'}
                          </td>

                          {/* 5. FECHA ENTREGA ABASTECIMIENTO */}
                          <td className="px-4 py-3 text-slate-600">
                            {q.fecha_entrega_abastecimiento || '—'}
                          </td>

                          {/* 6. EMPRESA */}
                          <td className="px-4 py-3 font-bold text-slate-900">
                            {q.empresa}
                          </td>

                          {/* 7. EQUIPO / SERVICIO */}
                          <td className="px-4 py-3 text-slate-700">
                            {q.equipo_servicio || '—'}
                          </td>

                          {/* 8. OC */}
                          <td className="px-4 py-3 font-mono text-blue-700 font-bold">
                            {q.orden_compra || (
                              <span className="text-amber-600 font-normal italic">Pendiente</span>
                            )}
                          </td>

                          {/* 9. FECHA OC */}
                          <td className="px-4 py-3 text-slate-600">
                            {q.fecha_oc || '—'}
                          </td>

                          {/* 10. MES */}
                          <td className="px-4 py-3 text-slate-800 font-semibold">{q.mes}</td>

                          {/* 11. AÑO */}
                          <td className="px-4 py-3 text-slate-600">{q.anio}</td>

                          {/* 12. CUOTA */}
                          <td className="px-4 py-3 font-mono text-slate-700">{q.cuota}</td>

                          {/* 13. VALOR $ */}
                          <td className="px-4 py-3 font-mono font-bold text-right text-slate-900">
                            {formatMoneda(q.valor_clp)}
                          </td>

                          {/* 14. ESTADO MERCADO PUBLICO */}
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 border border-slate-200">
                              {q.estado_mercado_publico || '—'}
                            </span>
                          </td>

                          {/* 15. N° FACTURA */}
                          <td className="px-4 py-3 font-mono text-slate-800 font-semibold">
                            {q.numero_factura || '—'}
                          </td>

                          {/* 16. FECHA FACTURA */}
                          <td className="px-4 py-3 text-slate-600">
                            {q.fecha_factura || '—'}
                          </td>

                          {/* ACCIONES (Sticky right) */}
                          <td className="px-4 py-3 text-center sticky right-0 bg-white group-hover:bg-slate-50 shadow-l">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setCuotaEditando(q);
                                  setCuotaModalOpen(true);
                                }}
                                className="rounded-lg p-1 text-slate-500 hover:bg-blue-50 hover:text-blue-700 transition"
                                title="Editar cuota mensual"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEliminarCuota(q.id)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                title="Eliminar cuota"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 p-3 text-xs text-slate-500 bg-slate-50/50">
              <span>
                Visualizando <strong className="text-slate-800">{cuotasFiltradas.length}</strong> de{' '}
                <strong>{cuotas.length}</strong> cuotas registradas
              </span>
              <span>Matriz Oficial UIC — Hospital Dr. Gustavo Fricke</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-TAB 2: GESTIÓN DE CONVENIOS Y EQUIPOS AMPARADOS
         ======================================================== */}
      {subTab === 'convenios' && (
        <div className="space-y-4">
          {/* Barra superior con selector de visualización (Ficha vs Tabla) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700">Visualización:</span>
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  id="btn-vista-detalle-convenios"
                  onClick={() => setVistaConvenios('detalle')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    vistaConvenios === 'detalle'
                      ? 'bg-white text-blue-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ficha y Equipos Amparados
                </button>
                <button
                  type="button"
                  id="btn-vista-tabla-convenios"
                  onClick={() => setVistaConvenios('tabla')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    vistaConvenios === 'tabla'
                      ? 'bg-white text-blue-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tabla de Convenios
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Total convenios: <strong className="text-slate-800">{conveniosFiltrados.length}</strong> de <strong>{convenios.length}</strong>
            </div>
          </div>

          {/* VISTA 1: TABLA DE CONVENIOS (CON COLUMNA DE ACCIONES Y PAPELERA) */}
          {vistaConvenios === 'tabla' && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden space-y-3">
              {/* Filtros de la tabla de convenios */}
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div className="relative flex-1 max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={busquedaConvenio}
                    onChange={(e) => setBusquedaConvenio(e.target.value)}
                    placeholder="Buscar convenio por código, nombre o proveedor..."
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={filtroTipoConvenio}
                    onChange={(e) => setFiltroTipoConvenio(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-700 cursor-pointer shadow-2xs"
                  >
                    <option value="todos">Todos los Tipos</option>
                    <option value="Arriendo">Arriendo</option>
                    <option value="Comodato">Comodato</option>
                    <option value="Garantía">Garantía</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Suministro">Suministro</option>
                  </select>

                  <select
                    value={filtroEstadoConvenio}
                    onChange={(e) => setFiltroEstadoConvenio(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-700 cursor-pointer shadow-2xs"
                  >
                    <option value="todos">Todos los Estados</option>
                    <option value="Vigente">Vigente</option>
                    <option value="Por Vencer">Por Vencer</option>
                    <option value="Vencido">Vencido</option>
                    <option value="Finalizado">Finalizado</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap min-w-[1000px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      <th className="px-4 py-3.5">CÓDIGO</th>
                      <th className="px-4 py-3.5">TIPO</th>
                      <th className="px-4 py-3.5">NOMBRE / OBJETO</th>
                      <th className="px-4 py-3.5">PROVEEDOR</th>
                      <th className="px-4 py-3.5">VIGENCIA</th>
                      <th className="px-4 py-3.5">PRESUPUESTO COMPROMETIDO</th>
                      <th className="px-4 py-3.5">ESTADO</th>
                      <th className="px-4 py-3.5">EQUIPOS</th>
                      <th className="px-4 py-3.5 text-center sticky right-0 bg-slate-50 shadow-l">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {conveniosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                          No se encontraron convenios registrados coincidentes con los filtros.
                        </td>
                      </tr>
                    ) : (
                      conveniosFiltrados.map((conv) => {
                        const cantEq = convenioEquipos.filter(
                          (v) => v.convenio_id === conv.id && v.estado_vinculo === 'Activo'
                        ).length;

                        return (
                          <tr key={conv.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3.5 font-mono font-bold text-blue-700">
                              {conv.codigo}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                {conv.tipo_convenio}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 font-bold text-slate-900 max-w-[260px] truncate" title={conv.nombre}>
                              {conv.nombre}
                            </td>
                            <td className="px-4 py-3.5 text-slate-700">
                              {conv.empresa}
                            </td>
                            <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">
                              {conv.fecha_inicio} al {conv.fecha_termino}
                            </td>
                            <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                              {formatMoneda(conv.monto_total_comprometido)}
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[11px] font-bold border ${
                                  conv.estado === 'Vigente'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : conv.estado === 'Por Vencer'
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-rose-50 text-rose-800 border-rose-200'
                                }`}
                              >
                                {conv.estado}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                                {cantEq} equipo(s)
                              </span>
                            </td>
                            {/* COLUMNA DE ACCIONES */}
                            <td className="px-4 py-3.5 text-center sticky right-0 bg-white shadow-l">
                              {puedeGestionar ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConvenioEditando(conv);
                                      setConvenioModalOpen(true);
                                    }}
                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700 transition cursor-pointer"
                                    title={`Editar convenio ${conv.codigo}`}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    id={`btn-eliminar-convenio-tabla-${conv.codigo}`}
                                    onClick={() => handleAbrirConfirmacionEliminarConvenio(conv)}
                                    className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                                    title={`Eliminar convenio ${conv.codigo}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Solo lectura</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VISTA 2: FICHA Y EQUIPOS AMPARADOS (SPLIT VIEW) */}
          {vistaConvenios === 'detalle' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Columna Izquierda: Listado y Selección de Convenios (4 cols) */}
              <div className="lg:col-span-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={busquedaConvenio}
                      onChange={(e) => setBusquedaConvenio(e.target.value)}
                      placeholder="Buscar convenio por código o proveedor..."
                      className="w-full rounded-xl border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={filtroTipoConvenio}
                      onChange={(e) => setFiltroTipoConvenio(e.target.value)}
                      className="w-1/2 rounded-lg border border-slate-200 bg-slate-50 py-1 px-2 text-[11px] text-slate-700 cursor-pointer"
                    >
                      <option value="todos">Tipos: Todos</option>
                      <option value="Arriendo">Arriendo</option>
                      <option value="Comodato">Comodato</option>
                      <option value="Garantía">Garantía</option>
                      <option value="Mantenimiento">Mantenimiento</option>
                      <option value="Suministro">Suministro</option>
                    </select>

                    <select
                      value={filtroEstadoConvenio}
                      onChange={(e) => setFiltroEstadoConvenio(e.target.value)}
                      className="w-1/2 rounded-lg border border-slate-200 bg-slate-50 py-1 px-2 text-[11px] text-slate-700 cursor-pointer"
                    >
                      <option value="todos">Estados: Todos</option>
                      <option value="Vigente">Vigente</option>
                      <option value="Por Vencer">Por Vencer</option>
                      <option value="Vencido">Vencido</option>
                      <option value="Finalizado">Finalizado</option>
                    </select>
                  </div>
                </div>

                {/* Lista de Tarjetas de Convenio */}
                <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-0.5">
                  {loading ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span>Cargando convenios...</span>
                    </div>
                  ) : conveniosFiltrados.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
                      No se encontraron convenios.
                    </div>
                  ) : (
                    conveniosFiltrados.map((conv) => {
                      const seleccionado = conv.id === convenioSeleccionado?.id;
                      const cantEquipos = convenioEquipos.filter(
                        (v) => v.convenio_id === conv.id && v.estado_vinculo === 'Activo'
                      ).length;

                      // Días restantes
                      const hoy = new Date();
                      const diasRestantes = conv.fecha_termino
                        ? Math.ceil((new Date(conv.fecha_termino).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
                        : 999;
                      const porVencer = diasRestantes >= 0 && diasRestantes <= 60;

                      return (
                        <div
                          key={conv.id}
                          onClick={() => setConvenioSeleccionadoId(conv.id)}
                          className={`rounded-2xl border p-4 cursor-pointer transition shadow-2xs ${
                            seleccionado
                              ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-blue-700">
                                  {conv.codigo}
                                </span>
                                <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600">
                                  {conv.tipo_convenio}
                                </span>
                              </div>
                              <h4 className="font-bold text-xs text-slate-900 mt-1 line-clamp-1">
                                {conv.nombre}
                              </h4>
                              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                                <Building2 className="h-3 w-3 text-slate-400" />
                                <span>{conv.empresa}</span>
                              </p>
                            </div>

                            {/* Alerta y Botón de Papelera */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {porVencer && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300 flex items-center gap-1 animate-pulse">
                                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                                  <span>{diasRestantes}d</span>
                                </span>
                              )}
                              {puedeGestionar && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAbrirConfirmacionEliminarConvenio(conv);
                                  }}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                                  title={`Eliminar convenio ${conv.codigo}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600 pt-2 border-t border-slate-100">
                            <span className="font-mono font-bold text-slate-900">
                              {formatMoneda(conv.monto_total_comprometido)}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                              {cantEquipos} equipo(s)
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Columna Derecha: Detalle de Convenio y Equipos Amparados (8 cols) */}
              <div className="lg:col-span-8 space-y-4">
                {convenioSeleccionado ? (
                  <>
                    {/* Ficha Superior del Convenio Seleccionado */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {convenioSeleccionado.codigo}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                              {convenioSeleccionado.tipo_convenio}
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-bold border ${
                                convenioSeleccionado.estado === 'Vigente'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : convenioSeleccionado.estado === 'Por Vencer'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {convenioSeleccionado.estado}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-slate-900 mt-1">
                            {convenioSeleccionado.nombre}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Proveedor: <strong className="text-slate-700">{convenioSeleccionado.empresa}</strong>
                            {convenioSeleccionado.rut_empresa ? ` (RUT: ${convenioSeleccionado.rut_empresa})` : ''}
                          </p>
                        </div>

                        {/* Botones de acción del convenio */}
                        {puedeGestionar && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setConvenioEditando(convenioSeleccionado);
                                setConvenioModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                              <span>Editar Convenio</span>
                            </button>

                            <button
                              type="button"
                              id="btn-eliminar-convenio-detalle"
                              onClick={() => handleAbrirConfirmacionEliminarConvenio(convenioSeleccionado)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                              title={`Eliminar convenio ${convenioSeleccionado.codigo}`}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                              <span>Eliminar Convenio</span>
                            </button>
                          </div>
                        )}
                      </div>

                  {/* Datos Clave */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Vigencia:</span>
                      <span className="font-semibold text-slate-800 block mt-0.5">
                        {convenioSeleccionado.fecha_inicio} al {convenioSeleccionado.fecha_termino}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Presupuesto Comprometido:</span>
                      <span className="font-mono font-bold text-slate-900 block mt-0.5">
                        {formatMoneda(convenioSeleccionado.monto_total_comprometido)}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">OC Madre:</span>
                      <span className="font-mono font-semibold text-blue-700 block mt-0.5">
                        {convenioSeleccionado.orden_compra_madre || '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Responsable UIC:</span>
                      <span className="font-semibold text-slate-800 block mt-0.5">
                        {convenioSeleccionado.responsable || 'Sin asignar'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. SECCIÓN EQUIPOS AMPARADOS (convenio_equipos) */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Boxes className="h-4 w-4 text-blue-600" />
                        <span>Equipos Amparados por este Convenio</span>
                      </h4>
                      <p className="text-xs text-slate-500">
                        Catastro de equipos bajo la cobertura de arriendo, comodato o garantía
                      </p>
                    </div>

                    {/* Botón "+ Asociar Equipos en Bloque" */}
                    <button
                      id="btn-asociar-equipos-bloque"
                      type="button"
                      onClick={() => setAsociarModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition active:scale-95 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>+ Asociar Equipos en Bloque</span>
                    </button>
                  </div>

                  {/* Tabla de Equipos Amparados */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs min-w-[650px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
                          <th className="px-4 py-3">Código</th>
                          <th className="px-4 py-3">Equipo / Denominación</th>
                          <th className="px-4 py-3">N° Serie</th>
                          <th className="px-4 py-3">Servicio Clínico</th>
                          <th className="px-4 py-3">Fecha Ingreso</th>
                          <th className="px-4 py-3">Estado Vínculo</th>
                          <th className="px-4 py-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {vinculosDelConvenio.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                              No hay equipos asociados a este convenio. Utiliza el botón &quot;+ Asociar Equipos en Bloque&quot;.
                            </td>
                          </tr>
                        ) : (
                          vinculosDelConvenio.map((v) => {
                            const eq = equipos.find((e) => e.id === v.equipo_id);
                            const esActivo = v.estado_vinculo === 'Activo';

                            return (
                              <tr
                                key={v.id}
                                className={`hover:bg-slate-50 transition-colors ${
                                  !esActivo ? 'bg-slate-50/50 text-slate-400' : ''
                                }`}
                              >
                                <td className="px-4 py-3 font-mono font-bold text-blue-700">
                                  {eq?.codigo || '—'}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="font-semibold text-slate-900 block">
                                    {eq?.nombre || 'Equipo no encontrado'}
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    {eq?.marca} {eq?.modelo ? `• ${eq.modelo}` : ''}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-mono text-slate-600">
                                  {eq?.serie || '—'}
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px]">
                                    <Building2 className="h-3 w-3 text-slate-500" />
                                    <span>{eq?.ubicacion || '—'}</span>
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  {v.fecha_incorporacion}
                                </td>
                                <td className="px-4 py-3">
                                  {esActivo ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                      Activo
                                    </span>
                                  ) : (
                                    <span
                                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200 cursor-help"
                                      title={`Salida: ${v.fecha_salida || '—'}. Motivo: ${v.motivo_salida || '—'}`}
                                    >
                                      Desvinculado ({v.motivo_salida || 'Salida'})
                                    </span>
                                  )}
                                </td>

                                {/* Botón "Desvincular Equipo" */}
                                <td className="px-4 py-3 text-right">
                                  {esActivo ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setVinculoADesvincular(v);
                                        setDesvincularModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition active:scale-95 cursor-pointer"
                                      title="Desvincular equipo de este convenio"
                                    >
                                      <Unlink className="h-3 w-3 text-amber-700" />
                                      <span>Desvincular</span>
                                    </button>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 italic">
                                      Historial preservado
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
                Selecciona un convenio para visualizar sus detalles y equipos amparados.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )}

      {/* Modal para Crear / Editar Cuota */}
      <CuotaModal
        open={cuotaModalOpen}
        onClose={() => setCuotaModalOpen(false)}
        cuota={cuotaEditando}
        convenios={convenios}
        convenioPreseleccionadoId={convenioSeleccionadoId || undefined}
        onSuccess={(msg) => {
          mostrarToast('exito', msg);
          fetchData();
        }}
      />

      {/* Modal para Crear / Editar Convenio */}
      <ConvenioModal
        open={convenioModalOpen}
        onClose={() => setConvenioModalOpen(false)}
        convenio={convenioEditando}
        onSuccess={(msg) => {
          mostrarToast('exito', msg);
          fetchData();
        }}
      />

      {/* Modal para Asociar Equipos en Bloque */}
      {convenioSeleccionado && (
        <AsociarEquiposModal
          open={asociarModalOpen}
          onClose={() => setAsociarModalOpen(false)}
          convenio={convenioSeleccionado}
          equiposDisponibles={equipos}
          equiposYaAmparadosIds={equiposActivosIds}
          onSuccess={(msg) => {
            mostrarToast('exito', msg);
            fetchData();
          }}
        />
      )}

      {/* Modal para Desvincular Equipo con Motivo y Fecha */}
      {vinculoADesvincular && (
        <DesvincularEquipoModal
          open={desvincularModalOpen}
          onClose={() => {
            setDesvincularModalOpen(false);
            setVinculoADesvincular(null);
          }}
          vinculo={vinculoADesvincular}
          equipo={equipos.find((e) => e.id === vinculoADesvincular.equipo_id)}
          convenio={convenioSeleccionado || undefined}
          onSuccess={(msg) => {
            mostrarToast('exito', msg);
            fetchData();
          }}
        />
      )}

      {/* Modal de Confirmación para Eliminar Convenio */}
      {convenioAEliminar && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-eliminar-convenio-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10 animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => {
                if (!eliminandoConvenio) setConvenioAEliminar(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-lg p-1 transition cursor-pointer"
              disabled={eliminandoConvenio}
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 ring-8 ring-rose-50">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="modal-eliminar-convenio-titulo"
                  className="text-base font-bold text-slate-900"
                >
                  ¿Eliminar este Convenio?
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Esta acción eliminará el registro del convenio del sistema y recalculará inmediatamente los indicadores de deuda y auditoría.
                </p>

                <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50/60 p-3.5 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Código Convenio:</span>
                    <span className="font-mono font-bold text-rose-950 bg-rose-100 px-2 py-0.5 rounded">
                      {convenioAEliminar.codigo}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Tipo:</span>
                    <span className="font-semibold text-slate-800">
                      {convenioAEliminar.tipo_convenio}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-500">Nombre / Objeto:</span>
                    <span className="font-semibold text-slate-800 text-right line-clamp-1 max-w-[220px]">
                      {convenioAEliminar.nombre}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Proveedor:</span>
                    <span className="font-semibold text-slate-800">
                      {convenioAEliminar.empresa}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-rose-200/60">
                    <span className="text-slate-600 font-medium">Presupuesto Comprometido:</span>
                    <span className="font-mono font-extrabold text-slate-900">
                      {formatMoneda(convenioAEliminar.monto_total_comprometido)}
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setConvenioAEliminar(null)}
                    disabled={eliminandoConvenio}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    id="btn-confirmar-eliminar-convenio-modal"
                    onClick={handleConfirmarEliminarConvenio}
                    disabled={eliminandoConvenio}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {eliminandoConvenio ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Eliminando...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        <span>Sí, Eliminar Convenio</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
