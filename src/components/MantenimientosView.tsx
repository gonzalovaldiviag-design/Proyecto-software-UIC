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
  Download,
  FileText,
  Stethoscope,
  CheckCircle2,
  ExternalLink,
  X,
  Clock,
  ShoppingBag,
  RotateCcw,
} from 'lucide-react';
import { supabase, type Mantenimiento, type EstadoMantenimiento, type TipoMantenimiento, type Equipo } from '@/lib/supabase';
import { enrichMantenimiento, saveMantenimientoRecord } from '@/lib/mantenimientoStorage';
import MantenimientoModal, { type MantenimientoFormData } from '@/components/MantenimientoModal';
import InformeMantenimientoModal from '@/components/InformeMantenimientoModal';
import TableColumnHeader, { type ColumnSortState } from '@/components/TableColumnHeader';
import { useAuth } from '@/lib/authContext';
import { exportarACSV, type ExportColumn } from '@/utils/exportUtils';

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
  const {
    usuarioActivo,
    puede,
    esTecnico,
    esClinico,
  } = useAuth();

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
  const [notificacionExito, setNotificacionExito] = useState<{
    id: string;
    codigo: string;
    record: Mantenimiento;
  } | null>(null);

  // Subfiltros interactivos por encabezado de columna
  const [colFilters, setColFilters] = useState<{
    codigo: string;
    equipo: string;
    tipo: string;
    problema: string;
    solicitado_por: string;
    asignado_a: string;
    fecha: string;
    estado: string;
  }>({
    codigo: '',
    equipo: '',
    tipo: '',
    problema: '',
    solicitado_por: '',
    asignado_a: '',
    fecha: '',
    estado: '',
  });

  const [sortConfig, setSortConfig] = useState<ColumnSortState | null>(null);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return null;
      }
      return { key, direction: 'asc' };
    });
  };

  const handleColumnFilterChange = (key: keyof typeof colFilters, value: string) => {
    setColFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Auto-cierre de la notificación de éxito tras 8 segundos
  useEffect(() => {
    if (!notificacionExito) return;
    const timer = setTimeout(() => {
      setNotificacionExito(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [notificacionExito]);

  function handleAbrirOTCreada(record: Mantenimiento) {
    setNotificacionExito(null);
    setEditandoMant(record);
    setModalOpen(true);
  }

  async function fetchMantenimientos(): Promise<Mantenimiento[]> {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('mantenimientos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
      setLoading(false);
      return [];
    } else {
      const enriched = ((data as Mantenimiento[]) ?? []).map(enrichMantenimiento);
      setMantenimientos(enriched);
      setLoading(false);
      return enriched;
    }
  }

  useEffect(() => {
    fetchMantenimientos();
  }, []);

  useEffect(() => {
    function handleCustomAbrir(e: Event) {
      const customEvent = e as CustomEvent<{ codigo?: string }>;
      const cod = customEvent.detail?.codigo;
      if (!cod) return;
      const encontrado = mantenimientos.find(
        (m) => m.codigo?.toLowerCase() === cod.toLowerCase() || m.id === cod
      );
      if (encontrado) {
        setEditandoMant(encontrado);
        setModalOpen(true);
      } else {
        supabase
          .from('mantenimientos')
          .select('*')
          .or(`codigo.eq.${cod},id.eq.${cod}`)
          .then(({ data }) => {
            if (data && data[0]) {
              const enriched = enrichMantenimiento(data[0] as Mantenimiento);
              setEditandoMant(enriched);
              setModalOpen(true);
            }
          });
      }
    }
    window.addEventListener('abrir_mantenimiento_por_codigo', handleCustomAbrir);
    return () => window.removeEventListener('abrir_mantenimiento_por_codigo', handleCustomAbrir);
  }, [mantenimientos]);

  // Equipos del servicio del clínico
  const serviceEquipmentIds = useMemo(() => {
    if (!esClinico || !usuarioActivo.servicio_clinico_asignado) return null;
    const serv = usuarioActivo.servicio_clinico_asignado.trim().toLowerCase();
    return new Set(
      equipos
        .filter((eq) => {
          if (!eq.ubicacion) return false;
          const u = eq.ubicacion.trim().toLowerCase();
          return u === serv || u.includes(serv) || serv.includes(u);
        })
        .map((eq) => eq.id)
    );
  }, [esClinico, usuarioActivo.servicio_clinico_asignado, equipos]);

  // Dataset base filtrado por Rol RBAC
  const mantenimientosBase = useMemo(() => {
    // 1. Clínico / Solicitante: ve únicamente las OTs de su servicio clínico asignado
    if (esClinico && usuarioActivo.servicio_clinico_asignado) {
      const serv = usuarioActivo.servicio_clinico_asignado.trim().toLowerCase();
      return mantenimientos.filter((m) => {
        if (m.equipo_id && serviceEquipmentIds?.has(m.equipo_id)) return true;
        if (m.equipo_identificacion && m.equipo_identificacion.toLowerCase().includes(serv)) return true;
        if (m.solicitado_por && m.solicitado_por.toLowerCase().includes(usuarioActivo.nombre.toLowerCase())) return true;
        return false;
      });
    }

    // 2. Ingeniero de Servicio / Técnico: ve exclusivamente las OTs asignadas a su nombre/usuario
    if (esTecnico) {
      const tecNombre = usuarioActivo.nombre.trim().toLowerCase();
      return mantenimientos.filter((m) => {
        if (!m.asignado_a) return false;
        const asig = m.asignado_a.trim().toLowerCase();
        return asig === tecNombre || asig.includes(tecNombre) || tecNombre.includes(asig);
      });
    }

    return mantenimientos;
  }, [mantenimientos, esClinico, esTecnico, serviceEquipmentIds, usuarioActivo]);

  // Opciones únicas para los subfiltros dropdown de encabezados
  const uniqueTipos = useMemo(() => {
    const s = new Set<string>();
    mantenimientosBase.forEach((m) => {
      if (m.tipo_mantenimiento) s.add(m.tipo_mantenimiento);
    });
    return Array.from(s).sort();
  }, [mantenimientosBase]);

  const uniqueSolicitadosPor = useMemo(() => {
    const s = new Set<string>();
    mantenimientosBase.forEach((m) => {
      if (m.solicitado_por?.trim()) s.add(m.solicitado_por.trim());
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [mantenimientosBase]);

  const uniqueAsignadosA = useMemo(() => {
    const s = new Set<string>();
    mantenimientosBase.forEach((m) => {
      if (m.asignado_a?.trim()) s.add(m.asignado_a.trim());
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [mantenimientosBase]);

  const uniqueEstados = useMemo(() => {
    return ['Pendiente de Asignación', 'En proceso', 'Completado'];
  }, []);

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    const cCodigo = colFilters.codigo.trim().toLowerCase();
    const cEquipo = colFilters.equipo.trim().toLowerCase();
    const cTipo = colFilters.tipo.trim().toLowerCase();
    const cProblema = colFilters.problema.trim().toLowerCase();
    const cSolicitado = colFilters.solicitado_por.trim().toLowerCase();
    const cAsignado = colFilters.asignado_a.trim().toLowerCase();
    const cFecha = colFilters.fecha.trim().toLowerCase();
    const cEstado = colFilters.estado.trim().toLowerCase();

    const result = mantenimientosBase.filter((m) => {
      // 1. Buscador Global
      const matchSearch =
        q === '' ||
        (m.codigo ?? '').toLowerCase().includes(q) ||
        (m.numero_informe ?? '').toLowerCase().includes(q) ||
        (m.equipo_identificacion ?? '').toLowerCase().includes(q) ||
        (m.problema_reportado ?? '').toLowerCase().includes(q) ||
        (m.solicitado_por ?? '').toLowerCase().includes(q) ||
        (m.asignado_a ?? '').toLowerCase().includes(q);

      // 2. Filtros de Estado y Vencimiento generales
      const matchEstado =
        filtrosEstado.length === 0 || filtrosEstado.includes(m.estado_mantenimiento);
      const matchVencido =
        !filtroVencidos || (m.estado_mantenimiento !== 'Completado' && esVencido(m.fecha_requerimiento));

      if (!matchSearch || !matchEstado || !matchVencido) return false;

      // 3. Subfiltros por Encabezados de Columna (AND aditivo)
      if (cCodigo) {
        const cod = `${m.codigo || ''} ${m.numero_informe || ''}`.toLowerCase();
        if (!cod.includes(cCodigo)) return false;
      }

      if (cEquipo) {
        const eqText = (m.equipo_identificacion || '').toLowerCase();
        if (!eqText.includes(cEquipo)) return false;
      }

      if (cTipo && cTipo !== 'todos' && cTipo !== 'todas') {
        if ((m.tipo_mantenimiento || '').toLowerCase() !== cTipo) return false;
      }

      if (cProblema) {
        const prob = (m.problema_reportado || '').toLowerCase();
        if (!prob.includes(cProblema)) return false;
      }

      if (cSolicitado && cSolicitado !== 'todos' && cSolicitado !== 'todas') {
        if ((m.solicitado_por || '').toLowerCase() !== cSolicitado) return false;
      }

      if (cAsignado && cAsignado !== 'todos' && cAsignado !== 'todas') {
        if ((m.asignado_a || '').toLowerCase() !== cAsignado) return false;
      }

      if (cFecha) {
        const fec = (m.fecha_requerimiento || '').toLowerCase();
        if (!fec.includes(cFecha)) return false;
      }

      if (cEstado && cEstado !== 'todos' && cEstado !== 'todas') {
        if ((m.estado_mantenimiento || '').toLowerCase() !== cEstado) return false;
      }

      return true;
    });

    // 4. Ordenamiento interactivo por columna
    if (sortConfig) {
      const { key, direction } = sortConfig;
      const factor = direction === 'asc' ? 1 : -1;
      return [...result].sort((a, b) => {
        let valA: string | number = '';
        let valB: string | number = '';

        switch (key) {
          case 'codigo':
            valA = a.codigo || a.numero_informe || '';
            valB = b.codigo || b.numero_informe || '';
            break;
          case 'equipo':
            valA = a.equipo_identificacion || '';
            valB = b.equipo_identificacion || '';
            break;
          case 'tipo':
            valA = a.tipo_mantenimiento || '';
            valB = b.tipo_mantenimiento || '';
            break;
          case 'problema':
            valA = a.problema_reportado || '';
            valB = b.problema_reportado || '';
            break;
          case 'solicitado_por':
            valA = a.solicitado_por || '';
            valB = b.solicitado_por || '';
            break;
          case 'asignado_a':
            valA = a.asignado_a || '';
            valB = b.asignado_a || '';
            break;
          case 'fecha':
            valA = a.fecha_requerimiento || '';
            valB = b.fecha_requerimiento || '';
            break;
          case 'estado':
            valA = a.estado_mantenimiento || '';
            valB = b.estado_mantenimiento || '';
            break;
          default:
            return 0;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          return valA.localeCompare(valB) * factor;
        }
        return (valA > valB ? 1 : -1) * factor;
      });
    }

    return result;
  }, [
    mantenimientosBase,
    search,
    filtrosEstado,
    filtroVencidos,
    colFilters,
    sortConfig,
  ]);

  const pendientes = mantenimientosBase.filter((m) => m.estado_mantenimiento === 'Pendiente de Asignación').length;
  const enProceso = mantenimientosBase.filter((m) => m.estado_mantenimiento === 'En proceso').length;
  const completados = mantenimientosBase.filter((m) => m.estado_mantenimiento === 'Completado').length;
  const vencidos = mantenimientosBase.filter(
    (m) => m.estado_mantenimiento !== 'Completado' && esVencido(m.fecha_requerimiento)
  ).length;

  function handleVerInforme(m: Mantenimiento) {
    setInformeMantenimiento(m);
    setInformeModalOpen(true);
  }

  async function handleReabrirMantenimiento(m: Mantenimiento) {
    if (!puede('reabrir_anular_ot')) {
      alert('La reapertura de órdenes de trabajo está reservada exclusivamente a la Jefatura de Unidad (Administrador).');
      return;
    }
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
    const asignado = (data.asignado_a || '').trim();
    if (data.estado_mantenimiento === 'En proceso' && !asignado) {
      setError('Para el estado "En proceso" es obligatorio completar el campo "Asignado a (Técnico / Responsable)"');
      return;
    }

    const estadoFinal =
      data.estado_mantenimiento || (asignado ? 'En proceso' : 'Pendiente de Asignación');

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
      requiere_externalizacion: data.requiere_externalizacion ?? false,
      tipo_externalizacion: data.tipo_externalizacion ?? null,
      estado_solicitud_externalizacion: data.estado_solicitud_externalizacion ?? null,
      motivo_externalizacion: data.motivo_externalizacion ?? null,
      externalizacion_solicitada_por: data.externalizacion_solicitada_por ?? null,
      externalizacion_resuelta_por: data.externalizacion_resuelta_por ?? null,
    };

    const esNuevo = !editandoMant;

    const { error: saveError, record: savedRecord, data: savedData } = await saveMantenimientoRecord({
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
    const refreshed = await fetchMantenimientos();

    // Notificación de Asignación / Reasignación de OT para el técnico
    const nuevoAsignado = (data.asignado_a || '').trim();
    const anteriorAsignado = (editandoMant?.asignado_a || '').trim();
    if (nuevoAsignado && (esNuevo || nuevoAsignado !== anteriorAsignado)) {
      try {
        let tecnicoId: string | null = null;
        const { data: uData } = await supabase.from('perfiles').select('*');
        if (uData && Array.isArray(uData)) {
          const u = uData.find((usr) => usr.nombre?.toLowerCase() === nuevoAsignado.toLowerCase());
          if (u) tecnicoId = u.id;
        }

        const rawCreated = (savedRecord || (Array.isArray(savedData) ? savedData[0] : savedData)) as Mantenimiento | undefined;
        const codOT = editandoMant?.codigo || rawCreated?.codigo || 'MANT-00X';
        const mantId = editandoMant?.id || rawCreated?.id || null;
        const eqNombre = data.equipo_identificacion || 'Equipo Médico';
        const servClinico = data.solicitado_por || 'Servicio Clínico';

        await supabase.from('notificaciones').insert({
          destinatario_rol: 'Ingeniero de Servicio / Técnico',
          destinatario_id: tecnicoId,
          destinatario_nombre: nuevoAsignado,
          titulo: `Nueva OT Asignada: ${codOT}`,
          mensaje: `Se te ha asignado la orden para el equipo ${eqNombre} del servicio ${servClinico}.`,
          tipo: 'ot_asignada',
          leida: false,
          mantenimiento_id: mantId,
          codigo_mantenimiento: codOT,
          codigo_mantenimiento_ref: codOT,
        });
        window.dispatchEvent(new CustomEvent('notificaciones_updated'));
      } catch (asigErr) {
        console.warn('Error emitiendo notificación de asignación:', asigErr);
      }
    }

    if (esNuevo) {
      const rawCreated = (savedRecord || (Array.isArray(savedData) ? savedData[0] : savedData)) as Mantenimiento | undefined;
      const targetRecord =
        (rawCreated?.id && refreshed.find((m) => m.id === rawCreated.id)) ||
        (rawCreated?.codigo && refreshed.find((m) => m.codigo === rawCreated.codigo)) ||
        rawCreated ||
        refreshed[0];

      if (targetRecord) {
        setNotificacionExito({
          id: targetRecord.id,
          codigo: targetRecord.codigo || 'MANT-00X',
          record: targetRecord,
        });
      }
    }
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
    if (filtered.length === 0) return;

    const columnas: ExportColumn<Mantenimiento>[] = [
      {
        header: 'Código OT',
        accessor: (m) => m.codigo,
      },
      {
        header: 'Equipo',
        accessor: (m) => {
          const eq = equipos.find((e) => e.id === m.equipo_id);
          return m.equipo_identificacion || eq?.nombre || '—';
        },
      },
      {
        header: 'N° Inventario/Serie',
        accessor: (m) => {
          const eq = equipos.find((e) => e.id === m.equipo_id);
          const partes = [eq?.inventario, eq?.serie].filter(Boolean);
          return partes.length > 0 ? partes.join(' / ') : '—';
        },
      },
      {
        header: 'Servicio Clínico',
        accessor: (m) => {
          const eq = equipos.find((e) => e.id === m.equipo_id);
          return (m as unknown as { servicio_clinico?: string }).servicio_clinico || eq?.ubicacion || '—';
        },
      },
      {
        header: 'Tipo de Mantenimiento',
        accessor: (m) => m.tipo_mantenimiento || '—',
      },
      {
        header: 'Estado',
        accessor: (m) => m.estado_mantenimiento || '—',
      },
      {
        header: 'Prioridad',
        accessor: (m) => {
          return (
            (m as unknown as { prioridad?: string }).prioridad ||
            (esVencido(m.fecha_requerimiento) ? 'Alta (Vencida)' : 'Normal')
          );
        },
      },
      {
        header: 'Técnico Asignado',
        accessor: (m) => m.asignado_a || m.completado_por || 'Sin asignar',
      },
      {
        header: 'Externalización (Sí/No)',
        accessor: (m) => (m.requiere_externalizacion ? 'Sí' : 'No'),
      },
      {
        header: 'Fecha',
        accessor: (m) => {
          if (!m.fecha_requerimiento) {
            return m.created_at ? m.created_at.split('T')[0] : '—';
          }
          return m.fecha_requerimiento.split('T')[0];
        },
      },
    ];

    exportarACSV(filtered, columnas, 'Mantenimientos_Filtrados');
  }

  const filtrosActivos = useMemo(() => {
    let count = 0;
    if (search.trim() !== '') count++;
    count += filtrosEstado.length;
    if (filtroVencidos) count++;
    Object.values(colFilters).forEach((v) => {
      if (v.trim() !== '' && v.toLowerCase() !== 'todos' && v.toLowerCase() !== 'todas') {
        count++;
      }
    });
    return count;
  }, [search, filtrosEstado, filtroVencidos, colFilters]);

  const handleLimpiarTodosLosFiltros = () => {
    setSearch('');
    setFiltrosEstado([]);
    setFiltroVencidos(false);
    setColFilters({
      codigo: '',
      equipo: '',
      tipo: '',
      problema: '',
      solicitado_por: '',
      asignado_a: '',
      fecha: '',
      estado: '',
    });
    setSortConfig(null);
  };

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

        {/* Banner de Rol RBAC activo */}
        {esClinico && usuarioActivo.servicio_clinico_asignado && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 flex-shrink-0">
                <Stethoscope className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold block text-emerald-950">
                  Requerimientos del Servicio Clínico: {usuarioActivo.servicio_clinico_asignado}
                </span>
                <span className="text-[11px] text-emerald-700">
                  Visualizando únicamente órdenes de trabajo asociadas a equipamiento de tu servicio.
                </span>
              </div>
            </div>
            {puede('crear_solicitud_ot') && (
              <button
                type="button"
                onClick={() => {
                  setEditandoMant(null);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition active:scale-[0.98] whitespace-nowrap self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Reportar Falla</span>
              </button>
            )}
          </div>
        )}

        {esTecnico && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 flex-shrink-0">
                <Wrench className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold block text-amber-950">
                  Panel de Trabajo Técnico: OTs asignadas a {usuarioActivo.nombre}
                </span>
                <span className="text-[11px] text-amber-700">
                  Visualización exclusiva de las órdenes de trabajo asignadas a tu usuario para intervención, cierre y emisión de informe técnico.
                </span>
              </div>
            </div>
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
          <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por equipo, problema, solicitante, código..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  title="Borrar búsqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Contador de resultados en tiempo real */}
            <div className="text-xs text-slate-500 whitespace-nowrap">
              Mostrando <span className="font-bold text-slate-900">{filtered.length}</span> de{' '}
              <span className="font-bold text-slate-900">{mantenimientosBase.length}</span> registros
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Botón Limpiar todos los filtros (sólo visible y activo cuando hay filtros aplicados) */}
            {filtrosActivos > 0 && (
              <button
                type="button"
                id="btn-limpiar-todos-filtros-ot"
                onClick={handleLimpiarTodosLosFiltros}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-100 hover:text-rose-800 transition active:scale-95 cursor-pointer"
                title="Restablecer todos los filtros y búsqueda"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Limpiar todos los filtros ({filtrosActivos})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMostrarFiltros((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                mostrarFiltros || filtrosEstado.length > 0 || filtroVencidos
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Filter className="h-4 w-4" />
              <span>Filtros rápidos</span>
              {(filtrosEstado.length > 0 || filtroVencidos) && (
                <span className="rounded-full bg-white/20 px-1.5 py-0.5">
                  {filtrosEstado.length + (filtroVencidos ? 1 : 0)}
                </span>
              )}
            </button>

            <button
              type="button"
              id="btn-exportar-mantenimientos-csv"
              onClick={handleExportCSV}
              disabled={filtered.length === 0}
              title={
                filtered.length === 0
                  ? 'No hay registros visibles para exportar'
                  : `Exportar ${filtered.length} registro(s) a Excel / CSV`
              }
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none cursor-pointer"
            >
              <Download className="h-4 w-4 text-slate-500" />
              <span>Exportar a Excel / CSV ({filtered.length})</span>
            </button>
          </div>
        </div>

        {mostrarFiltros && (
          <div className="border-b border-slate-100 bg-slate-50/60 p-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 mr-1">Filtrar por estado:</span>
              {estadosM.map((estado) => {
                const active = filtrosEstado.includes(estado);
                return (
                  <button
                    key={estado}
                    type="button"
                    onClick={() => toggleEstadoFiltro(estado)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
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
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                  filtroVencidos
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                }`}
              >
                Vencidos
              </button>
              {(filtrosEstado.length > 0 || filtroVencidos) && (
                <button
                  type="button"
                  onClick={() => {
                    setFiltrosEstado([]);
                    setFiltroVencidos(false);
                  }}
                  className="px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Restablecer estados
                </button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <TableColumnHeader
                  id="th-mant-codigo"
                  title="Código"
                  sortKey="codigo"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterType="text"
                  filterValue={colFilters.codigo}
                  onFilterChange={(v) => handleColumnFilterChange('codigo', v)}
                  placeholder="Filtrar código..."
                  className="min-w-[130px]"
                />
                <TableColumnHeader
                  id="th-mant-equipo"
                  title="Equipo"
                  sortKey="equipo"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterType="text"
                  filterValue={colFilters.equipo}
                  onFilterChange={(v) => handleColumnFilterChange('equipo', v)}
                  placeholder="Filtrar equipo..."
                  className="min-w-[180px]"
                />
                <TableColumnHeader
                  id="th-mant-tipo"
                  title="Tipo"
                  sortKey="tipo"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterType="select"
                  filterValue={colFilters.tipo}
                  onFilterChange={(v) => handleColumnFilterChange('tipo', v)}
                  selectOptions={uniqueTipos}
                  className="min-w-[120px]"
                />
                <TableColumnHeader
                  id="th-mant-problema"
                  title="Problema"
                  sortKey="problema"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterType="text"
                  filterValue={colFilters.problema}
                  onFilterChange={(v) => handleColumnFilterChange('problema', v)}
                  placeholder="Filtrar problema..."
                  className="min-w-[160px]"
                />
                <TableColumnHeader
                  id="th-mant-solicitado"
                  title="Solicitado por"
                  sortKey="solicitado_por"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterType="select"
                  filterValue={colFilters.solicitado_por}
                  onFilterChange={(v) => handleColumnFilterChange('solicitado_por', v)}
                  selectOptions={uniqueSolicitadosPor}
                  className="min-w-[150px]"
                />
                <TableColumnHeader
                  id="th-mant-asignado"
                  title="Asignado a"
                  sortKey="asignado_a"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterType="select"
                  filterValue={colFilters.asignado_a}
                  onFilterChange={(v) => handleColumnFilterChange('asignado_a', v)}
                  selectOptions={uniqueAsignadosA}
                  className="min-w-[140px]"
                />
                <TableColumnHeader
                  id="th-mant-fecha"
                  title="Fecha"
                  sortKey="fecha"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterType="text"
                  filterValue={colFilters.fecha}
                  onFilterChange={(v) => handleColumnFilterChange('fecha', v)}
                  placeholder="Filtrar fecha..."
                  className="min-w-[110px]"
                />
                <TableColumnHeader
                  id="th-mant-estado"
                  title="Estado"
                  sortKey="estado"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterType="select"
                  filterValue={colFilters.estado}
                  onFilterChange={(v) => handleColumnFilterChange('estado', v)}
                  selectOptions={uniqueEstados}
                  className="min-w-[140px]"
                />
                <TableColumnHeader
                  id="th-mant-acciones"
                  title="Acciones"
                  align="right"
                  filterType="none"
                  className="min-w-[100px]"
                />
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
                          <button
                            type="button"
                            onClick={() => {
                              setEditandoMant(m);
                              setModalOpen(true);
                            }}
                            className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors text-left"
                            title="Ver o editar mantenimiento"
                          >
                            {m.codigo}
                          </button>
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
                        {m.estado_solicitud_externalizacion === 'Pendiente_Aprobacion' && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                            <Clock className="h-2.5 w-2.5 text-amber-600 animate-pulse" />
                            <span>Ext. Pendiente</span>
                          </span>
                        )}
                        {m.estado_solicitud_externalizacion === 'Aprobada' && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-900 border border-emerald-300">
                            <ShoppingBag className="h-2.5 w-2.5 text-emerald-600" />
                            <span>Ext. Aprobada</span>
                          </span>
                        )}
                        {m.estado_solicitud_externalizacion === 'Rechazada' && (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-900 border border-rose-300">
                            <X className="h-2.5 w-2.5 text-rose-600" />
                            <span>Ext. Rechazada</span>
                          </span>
                        )}
                        {!m.estado_solicitud_externalizacion && m.requiere_externalizacion && (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-900 border border-blue-200">
                            <ShoppingBag className="h-2.5 w-2.5 text-blue-600" />
                            <span>Externalización</span>
                          </span>
                        )}
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
                      <div className="flex items-center justify-end gap-1">
                        {puede('eliminar_ot') && (
                          <button
                            onClick={() => handleDelete(m)}
                            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                            aria-label="Eliminar mantenimiento"
                            title="Eliminar mantenimiento (Exclusivo Administrador)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
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

      {/* Floating add button - only shown if user has permission to create OT */}
      {puede('crear_solicitud_ot') && (
        <button
          onClick={() => {
            setEditandoMant(null);
            setModalOpen(true);
          }}
          className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl active:scale-95 print:hidden"
          aria-label="Nuevo mantenimiento"
          title={esClinico ? 'Reportar Falla / Solicitar Mantenimiento' : 'Nueva Orden de Trabajo'}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Banner / Alerta flotante interactiva de confirmación tras crear orden de mantenimiento */}
      {notificacionExito && (
        <div
          id="toast-confirmacion-mantenimiento"
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-50 w-[94vw] sm:w-[460px] rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-xl ring-1 ring-emerald-900/10 transition-all duration-300 animate-in fade-in slide-in-from-top-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-emerald-950">
                  Orden de Trabajo Creada
                </span>
                <span className="rounded-md border border-emerald-300/80 bg-emerald-100/90 px-2 py-0.5 font-mono text-xs font-bold text-emerald-800">
                  {notificacionExito.codigo}
                </span>
              </div>
              <p className="mt-1 text-sm text-emerald-900 leading-snug">
                Mantenimiento creado exitosamente con el correlativo{' '}
                <strong className="font-mono font-semibold text-emerald-950">
                  {notificacionExito.codigo}
                </strong>
                .
              </p>
              <div className="mt-3 flex items-center gap-2.5">
                <button
                  type="button"
                  id="btn-verificar-abrir-ot"
                  onClick={() => handleAbrirOTCreada(notificacionExito.record)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Verificar / Abrir OT</span>
                </button>
                <span className="text-[11px] font-medium text-emerald-600">
                  Auto-cierre en 8s
                </span>
              </div>
            </div>
            <button
              type="button"
              id="btn-cerrar-notificacion-ot"
              onClick={() => setNotificacionExito(null)}
              className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800 transition-colors focus:outline-none"
              title="Cerrar notificación"
              aria-label="Cerrar notificación"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

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
