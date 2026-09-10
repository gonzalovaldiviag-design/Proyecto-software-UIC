import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Plus,
  Boxes,
  Pencil,
  Trash2,
  Filter,
  Loader2,
  AlertCircle,
  Wrench,
  ClipboardList,
  ChevronDown,
  Download,
  ShoppingBag,
} from 'lucide-react';
import { useRef, useCallback } from 'react';
import { supabase, type Equipo, type EstadoEquipo, type EstadoMantenimiento, type ModalidadAdquisicion } from '@/lib/supabase';
import { saveMantenimientoRecord } from '@/lib/mantenimientoStorage';
import Dashboard from '@/components/Dashboard';
import EstadoBadge from '@/components/EstadoBadge';
import EquipoModal from '@/components/EquipoModal';
import MantenimientosView from '@/components/MantenimientosView';
import ExternalizacionView from '@/components/ExternalizacionView';
import HojaVidaModal from '@/components/HojaVidaModal';
import MantenimientoModal, { type MantenimientoFormData } from '@/components/MantenimientoModal';
import MantenimientoChoiceModal from '@/components/MantenimientoChoiceModal';

const estados: (EstadoEquipo | 'Todos')[] = ['Todos', 'Operativo', 'Mantenimiento', 'Dado de baja'];

type Tab = 'inventario' | 'mantenimiento' | 'externalizacion';

class TabErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-medium">No se pudo cargar el módulo de mantenimiento.</p>
            <p className="mt-1 text-rose-600">{this.state.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('inventario');

  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoEquipo | 'Todos'>('Todos');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Equipo | null>(null);
  const [hojaVidaEquipo, setHojaVidaEquipo] = useState<Equipo | null>(null);
  const [mantModalOpen, setMantModalOpen] = useState(false);
  const [mantEquipo, setMantEquipo] = useState<Equipo | null>(null);
  const [choiceModalOpen, setChoiceModalOpen] = useState(false);
  const [choiceEquipo, setChoiceEquipo] = useState<Equipo | null>(null);

  interface ActiveMenuState {
    equipo: Equipo;
    top: number;
    bottom?: number;
    left: number;
    openUpwards: boolean;
  }

  const [activeMenu, setActiveMenu] = useState<ActiveMenuState | null>(null);
  const menuDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeMenu) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setActiveMenu(null);
      }
    }

    function handleResizeOrScroll() {
      setActiveMenu(null);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, { passive: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll);
    };
  }, [activeMenu]);

  useEffect(() => {
    setActiveMenu(null);
  }, [search, estadoFiltro, tab]);

  const toggleMenu = useCallback(
    (eq: Equipo, e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (activeMenu?.equipo.id === eq.id) {
        setActiveMenu(null);
        return;
      }

      const button = e.currentTarget;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const menuEstimatedHeight = 210;
      const menuWidth = 224;

      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpwards = spaceBelow < menuEstimatedHeight && rect.top > menuEstimatedHeight;

      const left = Math.max(12, Math.min(rect.left, window.innerWidth - menuWidth - 16));
      const top = rect.bottom + 6;
      const bottom = window.innerHeight - rect.top + 6;

      setActiveMenu({
        equipo: eq,
        top,
        bottom,
        left,
        openUpwards,
      });
    },
    [activeMenu]
  );

  async function fetchEquipos() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('equipos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setEquipos((data as Equipo[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchEquipos();
  }, []);

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return equipos.filter((e) => {
      const matchSearch =
        q === '' ||
        e.nombre.toLowerCase().includes(q) ||
        e.codigo.toLowerCase().includes(q) ||
        (e.marca ?? '').toLowerCase().includes(q) ||
        (e.modelo ?? '').toLowerCase().includes(q) ||
        (e.serie ?? '').toLowerCase().includes(q) ||
        (e.ubicacion ?? '').toLowerCase().includes(q);
      const matchEstado =
        estadoFiltro === 'Todos' ||
        e.estado === estadoFiltro ||
        ((estadoFiltro === 'Mantenimiento' || (estadoFiltro as string) === 'En Mantenimiento') &&
          (e.estado === 'Mantenimiento' || (e.estado as string) === 'En Mantenimiento'));
      return matchSearch && matchEstado;
    });
  }, [equipos, search, estadoFiltro]);

  const total = equipos.length;
  const operativos = equipos.filter((e) => e.estado === 'Operativo').length;
  const mantenimiento = equipos.filter((e) => e.estado === 'Mantenimiento').length;

  function nextCodigo(): string {
    let max = 0;
    for (const e of equipos) {
      const m = e.codigo.match(/(\d+)\s*$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `EQ-${String(max + 1).padStart(3, '0')}`;
  }

  function handleExportCSV() {
    const hasFilterOrSearch = (search || '').trim() !== '' || estadoFiltro !== 'Todos';
    const dataToExport = hasFilterOrSearch ? filtered : equipos;

    if (dataToExport.length === 0) return;

    const headers = ['Código', 'Servicio Clínico', 'Nombre', 'Marca', 'Modelo', 'Serie', 'Estado'];

    const escapeCsv = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = dataToExport.map((eq) =>
      [
        escapeCsv(eq.codigo),
        escapeCsv(eq.ubicacion),
        escapeCsv(eq.nombre),
        escapeCsv(eq.marca),
        escapeCsv(eq.modelo),
        escapeCsv(eq.serie),
        escapeCsv(eq.estado),
      ].join(',')
    );

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const fileName = `equipos_export_${year}-${month}-${day}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(eq: Equipo) {
    setEditing(eq);
    setModalOpen(true);
  }

  function openHojaVida(eq: Equipo) {
    setHojaVidaEquipo(eq);
  }

  function openMantenimiento(eq: Equipo) {
    if (eq.estado === 'Mantenimiento') {
      setChoiceEquipo(eq);
      setChoiceModalOpen(true);
    } else {
      setMantEquipo(eq);
      setMantModalOpen(true);
    }
  }

  function openNuevoMantenimiento() {
    setChoiceModalOpen(false);
    setMantEquipo(choiceEquipo);
    setMantModalOpen(true);
  }

  async function handleSaveMantenimiento(data: MantenimientoFormData) {
    const asignado = (data.asignado_a || '').trim();
    const estadoFinal =
      data.estado_mantenimiento === 'En proceso' && !asignado
        ? 'Pendiente de Asignación'
        : data.estado_mantenimiento ||
          (asignado ? 'En proceso' : 'Pendiente de Asignación');

    const payload = {
      equipo_id: data.equipo_id,
      equipo_identificacion: data.equipo_identificacion,
      problema_reportado: data.problema_reportado,
      solicitado_por: data.solicitado_por,
      asignado_a: data.asignado_a,
      fecha_requerimiento: data.fecha_requerimiento,
      tipo_mantenimiento: data.tipo_mantenimiento,
      estado_mantenimiento: estadoFinal as EstadoMantenimiento,
      accesorios_adicionales: data.accesorios_adicionales,
      descripcion_trabajo_realizado: data.descripcion_trabajo_realizado,
      fecha_cierre: data.fecha_cierre,
      horas_hombre: data.horas_hombre,
      fotos_url: data.fotos_url,
      documentos_url: data.documentos_url,
      completado_por: data.completado_por,
      recibido_por: data.recibido_por,
      numero_informe: data.numero_informe ?? null,
      fecha_emision_informe: data.fecha_emision_informe ?? null,
      diagnostico_final: data.diagnostico_final ?? null,
      repuestos_utilizados: data.repuestos_utilizados ?? null,
      costo: data.costo ?? null,
    };
    const { error } = await saveMantenimientoRecord({
      isEdit: false,
      payload,
    });
    if (error) {
      setError(error.message);
      return;
    }
    if (data.equipo_id) {
      const nuevoEstadoEq = estadoFinal === 'Completado' ? 'Operativo' : 'Mantenimiento';
      await supabase.from('equipos').update({ estado: nuevoEstadoEq }).eq('id', data.equipo_id);
      await fetchEquipos();
    }
    setMantModalOpen(false);
    setMantEquipo(null);
  }

  async function handleSave(data: {
    codigo: string;
    nombre: string;
    marca: string;
    modelo: string;
    serie: string;
    ubicacion: string;
    estado: EstadoEquipo;
    inventario: string;
    anio_adquisicion: string;
    orden_compra: string;
    acta_entrega: string;
    vida_util: string;
    vida_util_residual: string;
    modalidad_adquisicion: ModalidadAdquisicion | '';
  }) {
    const payload = {
      codigo: (data.codigo || '').trim(),
      nombre: (data.nombre || '').trim(),
      marca: (data.marca || '').trim() || null,
      modelo: (data.modelo || '').trim() || null,
      serie: (data.serie || '').trim(),
      ubicacion: data.ubicacion || null,
      estado: data.estado,
      inventario: data.inventario || null,
      anio_adquisicion: data.anio_adquisicion ? parseInt(data.anio_adquisicion, 10) : null,
      orden_compra: data.orden_compra || null,
      acta_entrega: data.acta_entrega || null,
      vida_util: data.vida_util ? parseInt(data.vida_util, 10) : null,
      vida_util_residual: data.vida_util_residual ? parseInt(data.vida_util_residual, 10) : null,
      modalidad_adquisicion: data.modalidad_adquisicion || null,
    };
    if (editing) {
      const { error } = await supabase.from('equipos').update(payload).eq('id', editing.id);
      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('equipos').insert(payload);
      if (error) {
        setError(error.message);
        return;
      }
    }
    setModalOpen(false);
    await fetchEquipos();
  }

  async function handleDelete(eq: Equipo) {
    if (!confirm(`¿Eliminar el equipo "${eq.nombre}" (${eq.codigo})?`)) return;
    const { error } = await supabase.from('equipos').delete().eq('id', eq.id);
    if (error) {
      setError(error.message);
      return;
    }
    await fetchEquipos();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
                Gestión de Equipos
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                Control y seguimiento de equipos institucionales
              </p>
            </div>
          </div>
          {tab === 'inventario' && (
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Agregar Equipo</span>
              <span className="sm:hidden">Agregar</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1">
            <button
              onClick={() => setTab('inventario')}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === 'inventario'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Boxes className="h-4 w-4" />
              Catastro de Equipos
            </button>
            <button
              onClick={() => setTab('mantenimiento')}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === 'mantenimiento'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Wrench className="h-4 w-4" />
              Mantenimiento
            </button>
            <button
              onClick={() => setTab('externalizacion')}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === 'externalizacion'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              Compras / Externalización
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {tab === 'inventario' ? (
          <TabErrorBoundary>
            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div className="flex-1">{error}</div>
                <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
                  ×
                </button>
              </div>
            )}

            <Dashboard
              total={total}
              operativos={operativos}
              mantenimiento={mantenimiento}
              selectedEstado={estadoFiltro}
              onSelectEstado={setEstadoFiltro}
            />

            <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              {/* Filters */}
              <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="relative flex-1 sm:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nombre, código, marca..."
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400" />
                    <div className="flex flex-wrap gap-1.5">
                      {estados.map((e) => {
                        const active = estadoFiltro === e;
                        return (
                          <button
                            key={e}
                            onClick={() => setEstadoFiltro(e)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                              active
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {e}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={handleExportCSV}
                    disabled={filtered.length === 0}
                    title={filtered.length === 0 ? 'No hay equipos para exportar' : 'Exportar a CSV'}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:active:scale-100"
                  >
                    <Download className="h-4 w-4 text-slate-500" />
                    <span>Exportar a CSV</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto min-h-[200px]">
                <table className="w-full min-w-[840px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Código / ID
                      </th>
                      <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Servicio Clínico
                      </th>
                      <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Nombre / Equipo
                      </th>
                      <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Marca
                      </th>
                      <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Modelo
                      </th>
                      <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Serie
                      </th>
                      <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading && (
                      <tr>
                        <td colSpan={7} className="px-5 py-16">
                          <div className="flex items-center justify-center gap-2 text-slate-400">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm">Cargando equipos...</span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {!loading && filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-16">
                          <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                            <Boxes className="h-10 w-10" />
                            <p className="text-sm font-medium text-slate-500">
                              No se encontraron equipos
                            </p>
                            <p className="text-xs text-slate-400">
                              Ajusta los filtros o agrega un nuevo equipo
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                    {!loading &&
                      filtered.map((eq) => (
                        <tr key={eq.id} className="group transition-colors hover:bg-slate-50/70">
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={(e) => toggleMenu(eq, e)}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-xs font-semibold transition-all ${
                                activeMenu?.equipo.id === eq.id
                                  ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500/20 shadow-sm'
                                  : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                              }`}
                              title={`Acciones para ${eq.codigo}`}
                            >
                              {eq.codigo}
                              <ChevronDown
                                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                                  activeMenu?.equipo.id === eq.id ? 'rotate-180 text-blue-700' : 'text-blue-500'
                                }`}
                              />
                            </button>
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-700 font-medium">
                            {eq.ubicacion ?? '—'}
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm font-medium text-slate-900">{eq.nombre}</span>
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600">
                            {eq.marca ?? '—'}
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600">
                            {eq.modelo ?? '—'}
                          </td>
                          <td className="px-5 py-4">
                            <span className="font-mono text-xs text-slate-600">
                              {eq.serie ?? '—'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <EstadoBadge estado={eq.estado} />
                          </td>

                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5 text-xs text-slate-500">
                <span>
                  Mostrando <span className="font-semibold text-slate-700">{filtered.length}</span>{' '}
                  de <span className="font-semibold text-slate-700">{total}</span> equipos
                </span>
                <span className="hidden sm:inline">Sistema de Gestión de Equipos</span>
              </div>
            </div>

            <EquipoModal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              onSave={handleSave}
              editing={editing}
              defaultCodigo={nextCodigo()}
            />
            <HojaVidaModal
              open={hojaVidaEquipo !== null}
              onClose={() => setHojaVidaEquipo(null)}
              equipo={hojaVidaEquipo}
            />
            <MantenimientoChoiceModal
              open={choiceModalOpen}
              equipo={choiceEquipo}
              onClose={() => {
                setChoiceModalOpen(false);
                setChoiceEquipo(null);
              }}
              onNuevo={openNuevoMantenimiento}
            />
            <MantenimientoModal
              open={mantModalOpen}
              onClose={() => {
                setMantModalOpen(false);
                setMantEquipo(null);
              }}
              onSave={handleSaveMantenimiento}
              equipos={equipos}
              equipoPreseleccionado={mantEquipo}
            />

            {activeMenu &&
              createPortal(
                <>
                  <div
                    className="fixed inset-0 z-[9998] bg-transparent cursor-default"
                    onClick={() => setActiveMenu(null)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActiveMenu(null);
                    }}
                  />
                  <div
                    ref={menuDropdownRef}
                    style={{
                      position: 'fixed',
                      left: `${activeMenu.left}px`,
                      ...(activeMenu.openUpwards
                        ? { bottom: `${Math.max(10, activeMenu.bottom ?? 10)}px` }
                        : { top: `${activeMenu.top}px` }),
                    }}
                    className="z-[9999] w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl ring-1 ring-slate-900/10 animate-in fade-in zoom-in-95 duration-100"
                  >
                    <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/90 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Acciones</span>
                      <span className="font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60">
                        {activeMenu.equipo.codigo}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const eq = activeMenu.equipo;
                        setActiveMenu(null);
                        openMantenimiento(eq);
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-amber-50 hover:text-amber-800"
                    >
                      <Wrench className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      Ingresar Mantenimiento
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const eq = activeMenu.equipo;
                        setActiveMenu(null);
                        openHojaVida(eq);
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700"
                    >
                      <ClipboardList className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      Hoja de Vida
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const eq = activeMenu.equipo;
                        setActiveMenu(null);
                        openEdit(eq);
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      <Pencil className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      Editar
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      onClick={() => {
                        const eq = activeMenu.equipo;
                        setActiveMenu(null);
                        handleDelete(eq);
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4 text-rose-500 flex-shrink-0" />
                      Eliminar
                    </button>
                  </div>
                </>,
                document.body
              )}
          </TabErrorBoundary>
        ) : tab === 'mantenimiento' ? (
          <TabErrorBoundary>
            <MantenimientosView equipos={equipos} onEquiposChanged={fetchEquipos} />
          </TabErrorBoundary>
        ) : (
          <TabErrorBoundary>
            <ExternalizacionView
              equipos={equipos}
              onNavigateToMantenimiento={() => setTab('mantenimiento')}
            />
          </TabErrorBoundary>
        )}
      </main>
    </div>
  );
}
