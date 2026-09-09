import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Wrench,
  Trash2,
  Filter,
  Loader2,
  AlertCircle,
  Calendar,
  User,
  UserCheck,
  ClipboardList,
  Flag,
  Pencil,
  Download,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { supabase, type Mantenimiento, type EstadoMantenimiento, type TipoMantenimiento, type Equipo } from '@/lib/supabase';
import { enrichMantenimiento, saveMantenimientoRecord } from '@/lib/mantenimientoStorage';
import MantenimientoModal, { type MantenimientoFormData } from '@/components/MantenimientoModal';
import InformeMantenimientoModal from '@/components/InformeMantenimientoModal';

const estadosM: EstadoMantenimiento[] = [
  'Pendiente de Asignación',
  'En proceso',
  'Completado',
];

const estadoStyles: Record<EstadoMantenimiento, { dot: string; badge: string }> = {
  'Pendiente de Asignación': {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  },
  'En proceso': {
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  },
  Completado: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  },
};

const tipoStyles: Record<TipoMantenimiento, { badge: string }> = {
  Correctivo: { badge: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  Preventivo: { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
};

function TipoMBadge({ tipo }: { tipo: TipoMantenimiento | string | null | undefined }) {
  const s = (tipo && tipoStyles[tipo as TipoMantenimiento]) ?? {
    badge: 'bg-slate-50 text-slate-600 ring-slate-600/20',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${s.badge}`}
    >
      {tipo || '—'}
    </span>
  );
}

function esVencido(fecha: string): boolean {
  const diff = Date.now() - new Date(fecha).getTime();
  return diff > 3 * 24 * 60 * 60 * 1000;
}

function EstadoMBadge({ estado }: { estado: EstadoMantenimiento | string | null | undefined }) {
  const s = (estado && estadoStyles[estado as EstadoMantenimiento]) ?? {
    dot: 'bg-slate-400',
    badge: 'bg-slate-50 text-slate-600 ring-slate-600/20',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${s.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {estado || 'Sin estado'}
    </span>
  );
}

interface MantenimientosViewProps {
  equipos: Equipo[];
  onEquiposChanged: () => void;
}

export default function MantenimientosView({
  equipos,
  onEquiposChanged,
}: MantenimientosViewProps) {
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filtrosEstado, setFiltrosEstado] = useState<EstadoMantenimiento[]>([]);
  const [filtroVencidos, setFiltroVencidos] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editandoMant, setEditandoMant] = useState<Mantenimiento | null>(null);
  const [informeModalOpen, setInformeModalOpen] = useState(false);
  const [informeMantenimiento, setInformeMantenimiento] = useState<Mantenimiento | null>(null);

  async function fetchMantenimientos() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('mantenimientos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      const enriched = ((data as Mantenimiento[]) ?? []).map(enrichMantenimiento);
      setMantenimientos(enriched);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchMantenimientos();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mantenimientos.filter((m) => {
      const matchSearch =
        q === '' ||
        (m.codigo ?? '').toLowerCase().includes(q) ||
        (m.numero_informe ?? '').toLowerCase().includes(q) ||
        (m.equipo_identificacion ?? '').toLowerCase().includes(q) ||
        (m.problema_reportado ?? '').toLowerCase().includes(q) ||
        (m.solicitado_por ?? '').toLowerCase().includes(q) ||
        (m.asignado_a ?? '').toLowerCase().includes(q);
      const matchEstado =
        filtrosEstado.length === 0 || filtrosEstado.includes(m.estado_mantenimiento);
      const matchVencido =
        !filtroVencidos || (m.estado_mantenimiento !== 'Completado' && esVencido(m.fecha_requerimiento));
      return matchSearch && matchEstado && matchVencido;
    });
  }, [mantenimientos, search, filtrosEstado, filtroVencidos]);

  const pendientes = mantenimientos.filter((m) => m.estado_mantenimiento === 'Pendiente de Asignación').length;
  const enProceso = mantenimientos.filter((m) => m.estado_mantenimiento === 'En proceso').length;
  const completados = mantenimientos.filter((m) => m.estado_mantenimiento === 'Completado').length;
  const vencidos = mantenimientos.filter(
    (m) => m.estado_mantenimiento !== 'Completado' && esVencido(m.fecha_requerimiento)
  ).length;

  function handleVerInforme(m: Mantenimiento) {
    setInformeMantenimiento(m);
    setInformeModalOpen(true);
  }

  async function handleReabrirMantenimiento(m: Mantenimiento) {
    if (
      !confirm(
        `¿Confirmas la reapertura de la orden de trabajo ${m.codigo}?\n\nSu estado cambiará a "En proceso" para que puedas corregir cualquier dato sin borrar el historial previo ni el correlativo técnico (${m.numero_informe || 'asignado'}).`
      )
    ) {
      return;
    }
    const { error } = await supabase
      .from('mantenimientos')
      .update({
        estado_mantenimiento: 'En proceso',
      })
      .eq('id', m.id);

    if (error) {
      setError(error.message);
      return;
    }

    if (m.equipo_id) {
      await supabase.from('equipos').update({ estado: 'Mantenimiento' }).eq('id', m.equipo_id);
      onEquiposChanged();
    }

    if (informeModalOpen) {
      setInformeModalOpen(false);
      setInformeMantenimiento(null);
    }

    await fetchMantenimientos();

    // Abrir directamente la orden en el modal para editar de inmediato
    setEditandoMant({
      ...m,
      estado_mantenimiento: 'En proceso',
    });
    setModalOpen(true);
  }

  async function handleSave(data: MantenimientoFormData) {
    if (data.estado_mantenimiento === 'En proceso' && (!data.asignado_a || !data.asignado_a.trim())) {
      setError('Para el estado "En proceso" es obligatorio completar el campo "Asignado a (Técnico / Responsable)"');
      return;
    }

    const estadoFinal =
      data.estado_mantenimiento || (data.asignado_a ? 'En proceso' : 'Pendiente de Asignación');

    const payload = {
      equipo_id: data.equipo_id,
      equipo_identificacion: data.equipo_identificacion,
      problema_reportado: data.problema_reportado,
      solicitado_por: data.solicitado_por,
      asignado_a: data.asignado_a,
      fecha_requerimiento: data.fecha_requerimiento,
      tipo_mantenimiento: data.tipo_mantenimiento,
      estado_mantenimiento: editandoMant ? data.estado_mantenimiento : (estadoFinal as EstadoMantenimiento),
      descripcion_trabajo_realizado: data.descripcion_trabajo_realizado,
      fecha_cierre: data.fecha_cierre,
      horas_hombre: data.horas_hombre,
      fotos_url: data.fotos_url,
      documentos_url: data.documentos_url,
      accesorios_adicionales: data.accesorios_adicionales,
      completado_por: data.completado_por,
      recibido_por: data.recibido_por,
      numero_informe: data.numero_informe ?? null,
      fecha_emision_informe: data.fecha_emision_informe ?? null,
      diagnostico_final: data.diagnostico_final ?? null,
      repuestos_utilizados: data.repuestos_utilizados ?? null,
      costo: data.costo ?? null,
    };

    const { error: saveError } = await saveMantenimientoRecord({
      id: editandoMant?.id,
      codigo: editandoMant?.codigo,
      isEdit: Boolean(editandoMant),
      payload,
    });

    if (saveError) {
      setError(saveError.message);
      return;
    }

    if (data.equipo_id) {
      const nuevoEstadoEq =
        (editandoMant ? data.estado_mantenimiento : estadoFinal) === 'Completado'
          ? 'Operativo'
          : 'Mantenimiento';
      await supabase.from('equipos').update({ estado: nuevoEstadoEq }).eq('id', data.equipo_id);
      onEquiposChanged();
    }

    setModalOpen(false);
    setEditandoMant(null);
    await fetchMantenimientos();
  }

  async function handleDelete(m: Mantenimiento) {
    if (!confirm('¿Eliminar este registro de mantenimiento?')) return;
    const { error } = await supabase.from('mantenimientos').delete().eq('id', m.id);
    if (error) {
      setError(error.message);
      return;
    }
    await fetchMantenimientos();
  }

  const stats = [
    {
      key: 'total' as const,
      label: 'Total',
      value: mantenimientos.length,
      icon: ClipboardList,
      accent: 'text-slate-900',
      active: filtrosEstado.length === 0 && !filtroVencidos,
    },
    {
      key: 'Pendiente de Asignación' as const,
      label: 'Pend. Asign.',
      value: pendientes,
      icon: Wrench,
      accent: 'text-amber-600',
      active: filtrosEstado.includes('Pendiente de Asignación'),
    },
    {
      key: 'En proceso' as const,
      label: 'En proceso',
      value: enProceso,
      icon: Loader2,
      accent: 'text-blue-600',
      active: filtrosEstado.includes('En proceso'),
    },
    {
      key: 'Completado' as const,
      label: 'Completados',
      value: completados,
      icon: UserCheck,
      accent: 'text-emerald-600',
      active: filtrosEstado.includes('Completado'),
    },
    {
      key: 'vencidos' as const,
      label: 'Vencidos',
      value: vencidos,
      icon: Flag,
      accent: 'text-rose-600',
      active: filtroVencidos,
    },
  ];

  function toggleEstadoFiltro(estado: EstadoMantenimiento) {
    setFiltrosEstado((prev) =>
      prev.includes(estado) ? prev.filter((item) => item !== estado) : [...prev, estado]
    );
  }

  function toggleStatFilter(key: (typeof stats)[number]['key']) {
    if (key === 'total') {
      setFiltrosEstado([]);
      setFiltroVencidos(false);
      return;
    }
    if (key === 'vencidos') {
      setFiltroVencidos((prev) => !prev);
      return;
    }
    toggleEstadoFiltro(key);
  }

  function handleExportCSV() {
    const tieneFiltros = search.trim() !== '' || filtrosEstado.length > 0 || filtroVencidos;
    const dataToExport = tieneFiltros ? filtered : mantenimientos;

    if (dataToExport.length === 0) return;

    const headers = [
      'N° Informe Técnico',
      'Equipo',
      'Código/Serie',
      'Tipo Mantenimiento',
      'Fecha Programada',
      'Fecha Realizada',
      'Responsable / Técnico',
      'Costo',
      'Estado',
      'Diagnóstico Final',
      'Observaciones',
    ];

    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const formatDate = (dateStr: string | null | undefined): string => {
      if (!dateStr) return '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return String(dateStr);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      } catch {
        return String(dateStr);
      }
    };

    const rows = dataToExport.map((m) => {
      const eq = equipos.find((e) => e.id === m.equipo_id);
      const numeroInforme = m.numero_informe || '';
      const equipoNombre = m.equipo_identificacion || eq?.nombre || '';
      const codigoSerie = [m.codigo, eq?.serie].filter(Boolean).join(' / ');
      const tipoMantenimiento = m.tipo_mantenimiento || '';
      const fechaProgramada = formatDate(m.fecha_requerimiento);
      const fechaRealizada = formatDate(m.fecha_cierre);
      const responsable = m.asignado_a || m.completado_por || '';
      const costoVal = (m as { costo?: number | string | null }).costo;
      const costo = costoVal != null ? String(costoVal) : '';
      const estado = m.estado_mantenimiento || '';
      const diagnostico = m.diagnostico_final || '';

      const obsParts: string[] = [];
      if (m.problema_reportado) obsParts.push(`Problema: ${m.problema_reportado}`);
      if (m.descripcion_trabajo_realizado) obsParts.push(`Trabajo: ${m.descripcion_trabajo_realizado}`);
      if (m.repuestos_utilizados) obsParts.push(`Repuestos: ${m.repuestos_utilizados}`);
      if (m.accesorios_adicionales) obsParts.push(`Accesorios: ${m.accesorios_adicionales}`);
      const observaciones = obsParts.join(' | ') || m.problema_reportado || '';

      return [
        escapeCsv(numeroInforme),
        escapeCsv(equipoNombre),
        escapeCsv(codigoSerie),
        escapeCsv(tipoMantenimiento),
        escapeCsv(fechaProgramada),
        escapeCsv(fechaRealizada),
        escapeCsv(responsable),
        escapeCsv(costo),
        escapeCsv(estado),
        escapeCsv(diagnostico),
        escapeCsv(observaciones),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const fileName = `mantenimientos_export_${year}-${month}-${day}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const filtrosActivos = filtrosEstado.length + (filtroVencidos ? 1 : 0);

  return (
    <div>
      <div className={informeModalOpen ? 'print:hidden' : ''}>
        {error && (
          <div
            id="mantenimiento-error-banner"
            className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/95 p-4 text-sm text-rose-800 shadow-sm"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-600" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold block text-rose-900 mb-0.5">Aviso del Sistema</span>
              <p className="text-xs text-rose-700 leading-relaxed break-words">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-400 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-100/80 transition-colors"
              aria-label="Cerrar aviso de error"
            >
              ×
            </button>
          </div>
        )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => toggleStatFilter(s.key)}
              aria-pressed={s.active}
              className={`rounded-2xl bg-white p-5 text-left shadow-sm ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                s.active ? 'ring-blue-400 bg-blue-50/30' : 'ring-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.active ? 'bg-white' : 'bg-slate-50'}`}>
                  <Icon className={`h-5 w-5 ${s.accent}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-xs font-medium text-slate-500">{s.label}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por equipo, problema, solicitante..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setMostrarFiltros((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  mostrarFiltros || filtrosActivos > 0
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Filter className="h-4 w-4" />
                Filtros interactivos
                {filtrosActivos > 0 && (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5">{filtrosActivos}</span>
                )}
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={filtered.length === 0}
                title={filtered.length === 0 ? 'No hay registros para exportar' : 'Exportar a CSV'}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:active:scale-100"
              >
                <Download className="h-4 w-4 text-slate-500" />
                <span>Exportar a CSV</span>
              </button>
            </div>

            {mostrarFiltros && (
              <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 sm:w-auto">
                <div className="flex flex-wrap items-center gap-2">
                  {estadosM.map((estado) => {
                    const active = filtrosEstado.includes(estado);
                    return (
                      <button
                        key={estado}
                        type="button"
                        onClick={() => toggleEstadoFiltro(estado)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                          active
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {estado}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setFiltroVencidos((prev) => !prev)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      filtroVencidos
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Vencidos
                  </button>
                  {filtrosActivos > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFiltrosEstado([]);
                        setFiltroVencidos(false);
                      }}
                      className="px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {filtrosActivos > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
            <span className="text-xs font-medium text-slate-500">Filtros activos:</span>
            {filtrosEstado.map((estado) => (
              <button
                key={estado}
                type="button"
                onClick={() => toggleEstadoFiltro(estado)}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-600/20"
              >
                {estado}
                <span aria-hidden="true">×</span>
              </button>
            ))}
            {filtroVencidos && (
              <button
                type="button"
                onClick={() => setFiltroVencidos(false)}
                className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-600/20"
              >
                Vencidos
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Código
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Equipo
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Tipo
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Problema
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Solicitado por
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Asignado a
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Fecha
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Estado
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-5 py-16">
                    <div className="flex items-center justify-center gap-2 text-slate-400">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm">Cargando mantenimientos...</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-16">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <Wrench className="h-10 w-10" />
                      <p className="text-sm font-medium text-slate-500">
                        No hay registros de mantenimiento
                      </p>
                      <p className="text-xs text-slate-400">
                        Registra un nuevo requerimiento de mantenimiento
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((m) => {
                  const vencido = m.estado_mantenimiento !== 'Completado' && esVencido(m.fecha_requerimiento);
                  return (
                  <tr
                    key={m.id}
                    className={`group transition-colors hover:bg-slate-50/70 ${
                      vencido ? 'bg-rose-50/40' : ''
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-1.5">
                          {vencido && (
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-600"
                              title="Vencido: más de 3 días desde la fecha de requerimiento"
                            >
                              <Flag className="h-3 w-3" />
                            </span>
                          )}
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {m.codigo}
                          </span>
                        </div>
                        {m.estado_mantenimiento === 'Completado' && (
                          <button
                            type="button"
                            onClick={() => handleVerInforme(m)}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700 ring-1 ring-blue-600/20 hover:bg-blue-100 transition"
                            title="Ver Informe Técnico emitido"
                          >
                            <FileText className="h-3 w-3 text-blue-600" />
                            <span>{m.numero_informe || `INF-${m.codigo}`}</span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-medium text-slate-900">
                        {m.equipo_identificacion}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <TipoMBadge tipo={m.tipo_mantenimiento} />
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600 line-clamp-2 max-w-[200px]">
                        {m.problema_reportado}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        {m.solicitado_por}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                        {m.asignado_a || (
                          <span className="italic text-slate-300">Sin asignar</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <Calendar className={`h-3.5 w-3.5 ${vencido ? 'text-rose-500' : 'text-slate-400'}`} />
                        <span className={vencido ? 'font-semibold text-rose-600' : ''}>
                          {m.fecha_requerimiento}
                        </span>
                        {vencido && (
                          <span className="text-xs font-medium text-rose-500">
                            (+{Math.floor((Date.now() - new Date(m.fecha_requerimiento).getTime()) / (1000 * 60 * 60 * 24))} días)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <button
                          onClick={() => {
                            setEditandoMant(m);
                            setModalOpen(true);
                          }}
                          className="transition-transform hover:scale-105 text-left"
                          title="Editar mantenimiento"
                        >
                          <EstadoMBadge estado={m.estado_mantenimiento} />
                        </button>
                        {m.estado_mantenimiento === 'Completado' && m.numero_informe && (
                          <button
                            type="button"
                            onClick={() => handleVerInforme(m)}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/20 hover:bg-blue-100 transition shadow-xs"
                            title="Ver Informe Técnico"
                          >
                            <FileText className="h-3 w-3 text-blue-600" />
                            <span>{m.numero_informe}</span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {m.estado_mantenimiento === 'Completado' && (
                          <>
                            <button
                              onClick={() => handleVerInforme(m)}
                              className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50"
                              title={
                                m.numero_informe
                                  ? `Ver Informe Técnico (${m.numero_informe})`
                                  : 'Ver Informe Técnico'
                              }
                              aria-label="Ver informe técnico"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleReabrirMantenimiento(m)}
                              className="rounded-lg p-2 text-amber-600 transition-colors hover:bg-amber-50"
                              title="Reabrir Orden / Modificar Datos"
                              aria-label="Reabrir orden de trabajo"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            setEditandoMant(m);
                            setModalOpen(true);
                          }}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                          aria-label="Editar"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Eliminar"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5 text-xs text-slate-500">
          <span>
            Mostrando <span className="font-semibold text-slate-700">{filtered.length}</span> de{' '}
            <span className="font-semibold text-slate-700">{mantenimientos.length}</span>{' '}
            registros
          </span>
          <span className="hidden sm:inline">Módulo de Mantenimiento</span>
        </div>
      </div>
      </div>

      {/* Floating add button */}
      <button
        onClick={() => {
          setEditandoMant(null);
          setModalOpen(true);
        }}
        className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl active:scale-95 print:hidden"
        aria-label="Nuevo mantenimiento"
      >
        <Plus className="h-6 w-6" />
      </button>

      <MantenimientoModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditandoMant(null);
        }}
        onSave={handleSave}
        equipos={equipos}
        mantenimientoEdicion={editandoMant}
      />

      <InformeMantenimientoModal
        open={informeModalOpen}
        onClose={() => {
          setInformeModalOpen(false);
          setInformeMantenimiento(null);
        }}
        mantenimiento={informeMantenimiento}
        equipo={equipos.find((e) => e.id === informeMantenimiento?.equipo_id)}
        equipos={equipos}
        onReabrir={handleReabrirMantenimiento}
      />
    </div>
  );
}
