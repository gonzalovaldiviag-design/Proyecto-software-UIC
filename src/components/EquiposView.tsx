import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  Building2,
  ShieldAlert,
} from 'lucide-react';
import {
  type Equipo,
  type EstadoEquipo,
} from '@/lib/supabase';
import Dashboard from '@/components/Dashboard';
import EstadoBadge from '@/components/EstadoBadge';
import { useAuth } from '@/lib/authContext';

const estados: (EstadoEquipo | 'Todos')[] = ['Todos', 'Operativo', 'Mantenimiento', 'Dado de baja'];

interface EquiposViewProps {
  equipos: Equipo[];
  loading: boolean;
  error: string | null;
  onClearError: () => void;
  onOpenAdd: () => void;
  onOpenEdit: (eq: Equipo) => void;
  onOpenMantenimiento: (eq: Equipo) => void;
  onOpenHojaVida: (eq: Equipo) => void;
  onDelete: (eq: Equipo) => void;
}

interface ActiveMenuState {
  equipo: Equipo;
  top: number;
  bottom?: number;
  left: number;
  openUpwards: boolean;
}

export default function EquiposView({
  equipos,
  loading,
  error,
  onClearError,
  onOpenAdd,
  onOpenEdit,
  onOpenMantenimiento,
  onOpenHojaVida,
  onDelete,
}: EquiposViewProps) {
  const { usuarioActivo, puede, esClinico, esAuditor } = useAuth();

  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoEquipo | 'Todos'>('Todos');
  const [activeMenu, setActiveMenu] = useState<ActiveMenuState | null>(null);
  const menuDropdownRef = useRef<HTMLDivElement | null>(null);

  // Filtrado institucional RBAC: Clínico / Solicitante solo ve equipos de su servicio clínico asignado
  const equiposBase = useMemo(() => {
    if (esClinico && usuarioActivo.servicio_clinico_asignado) {
      const servTarget = usuarioActivo.servicio_clinico_asignado.trim().toLowerCase();
      return equipos.filter((eq) => {
        if (!eq.ubicacion) return false;
        const ubi = eq.ubicacion.trim().toLowerCase();
        return ubi === servTarget || ubi.includes(servTarget) || servTarget.includes(ubi);
      });
    }
    return equipos;
  }, [equipos, esClinico, usuarioActivo.servicio_clinico_asignado]);

  // Manejo de clicks y escape para menú de acciones
  useEffect(() => {
    if (!activeMenu) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setActiveMenu(null);
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
  }, [search, estadoFiltro]);

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
      const menuEstimatedHeight = 220;
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

  const filtered = useMemo(() => {
    return equiposBase.filter((eq) => {
      const q = search.toLowerCase();
      const matchesSearch =
        eq.nombre.toLowerCase().includes(q) ||
        eq.codigo.toLowerCase().includes(q) ||
        (eq.marca && eq.marca.toLowerCase().includes(q)) ||
        (eq.modelo && eq.modelo.toLowerCase().includes(q)) ||
        (eq.serie && eq.serie.toLowerCase().includes(q)) ||
        (eq.ubicacion && eq.ubicacion.toLowerCase().includes(q));
      const matchesEstado = estadoFiltro === 'Todos' || eq.estado === estadoFiltro;
      return matchesSearch && matchesEstado;
    });
  }, [equiposBase, search, estadoFiltro]);

  const total = equiposBase.length;
  const operativos = equiposBase.filter((e) => e.estado === 'Operativo').length;
  const mantenimiento = equiposBase.filter((e) => e.estado === 'Mantenimiento').length;

  function handleExportCSV() {
    const hasFilterOrSearch = (search || '').trim() !== '' || estadoFiltro !== 'Todos';
    const dataToExport = hasFilterOrSearch ? filtered : equiposBase;

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
    const fileName = `catastro_equipos_${year}-${month}-${day}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="flex-1">{error}</div>
          <button onClick={onClearError} className="text-rose-500 hover:text-rose-700">
            ×
          </button>
        </div>
      )}

      {/* Banner de restricción por Servicio Clínico (Clínico / Solicitante) */}
      {esClinico && usuarioActivo.servicio_clinico_asignado && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-950">
                Catastro Restringido por Servicio Clínico
              </h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Has iniciado sesión con el rol <strong>Clínico / Solicitante</strong>. Solo tienes autorización para visualizar los equipos pertenecientes a tu servicio asignado:{' '}
                <span className="font-bold underline decoration-emerald-600">
                  {usuarioActivo.servicio_clinico_asignado}
                </span>{' '}
                ({total} de {equipos.length} equipos hospitalarios totales).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Banner de Modo Auditoría */}
      {esAuditor && (
        <div className="mb-6 rounded-2xl border border-slate-300 bg-slate-100/80 p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-700 text-white shadow-xs">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Modo Auditoría / Directivo (Solo Lectura)
              </h3>
              <p className="text-xs text-slate-700 mt-0.5">
                Tienes visualización global de todos los equipos del establecimiento en modo de consulta y auditoría. Las modificaciones y creaciones están deshabilitadas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header bar with Add Button if user has permission */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Catastro Hospitalario de Equipos</h2>
          <p className="text-xs text-slate-500">
            Inventario técnico, ubicación asistencial y estado operativo
          </p>
        </div>

        {puede('crear_equipos') && (
          <button
            type="button"
            onClick={onOpenAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>Agregar Equipo</span>
          </button>
        )}
      </div>

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
              placeholder="Buscar por nombre, código, marca, modelo..."
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

            {puede('exportar_equipos') && (
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={filtered.length === 0}
                title={filtered.length === 0 ? 'No hay equipos para exportar' : 'Exportar a CSV'}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:active:scale-100"
              >
                <Download className="h-4 w-4 text-slate-500" />
                <span>Exportar a CSV</span>
              </button>
            )}
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
                        {esClinico
                          ? `No hay equipos registrados para el servicio ${usuarioActivo.servicio_clinico_asignado}`
                          : 'Ajusta los filtros o agrega un nuevo equipo'}
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
                    <td className="px-5 py-4 text-sm text-slate-600">{eq.marca ?? '—'}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{eq.modelo ?? '—'}</td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs text-slate-600">{eq.serie ?? '—'}</span>
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
            Mostrando <span className="font-semibold text-slate-700">{filtered.length}</span> de{' '}
            <span className="font-semibold text-slate-700">{total}</span> equipos
            {esClinico && ` (Filtro por servicio: ${usuarioActivo.servicio_clinico_asignado})`}
          </span>
          <span className="hidden sm:inline">Sistema de Gestión de Equipos</span>
        </div>
      </div>

      {/* Floating menu rendered in Portal */}
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

              {/* Ingresar Mantenimiento / Reportar Falla */}
              {puede('crear_solicitud_ot') && (
                <button
                  type="button"
                  onClick={() => {
                    const eq = activeMenu.equipo;
                    setActiveMenu(null);
                    onOpenMantenimiento(eq);
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-amber-50 hover:text-amber-800"
                >
                  <Wrench className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  {esClinico ? 'Reportar Falla' : 'Ingresar Mantenimiento'}
                </button>
              )}

              {/* Hoja de Vida */}
              <button
                type="button"
                onClick={() => {
                  const eq = activeMenu.equipo;
                  setActiveMenu(null);
                  onOpenHojaVida(eq);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700"
              >
                <ClipboardList className="h-4 w-4 text-blue-500 flex-shrink-0" />
                Hoja de Vida
              </button>

              {/* Editar Equipo */}
              {puede('editar_equipos') && (
                <button
                  type="button"
                  onClick={() => {
                    const eq = activeMenu.equipo;
                    setActiveMenu(null);
                    onOpenEdit(eq);
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <Pencil className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  Editar
                </button>
              )}

              {/* Eliminar / Baja Definitiva (exclusivo para Administrador) */}
              {puede('eliminar_baja_equipos') && (
                <>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={() => {
                      const eq = activeMenu.equipo;
                      setActiveMenu(null);
                      onDelete(eq);
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4 text-rose-500 flex-shrink-0" />
                    Baja Definitiva / Eliminar
                  </button>
                </>
              )}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
