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
  X,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import {
  type Equipo,
  type EstadoEquipo,
} from '@/lib/supabase';
import Dashboard from '@/components/Dashboard';
import EstadoBadge from '@/components/EstadoBadge';
import { useAuth } from '@/lib/authContext';
import TableColumnHeader, { ColumnSortState } from '@/components/TableColumnHeader';
import { exportarACSV, type ExportColumn } from '@/utils/exportUtils';

const estados: (EstadoEquipo | 'Todos')[] = ['Todos', 'Operativo', 'Mantenimiento', 'Dado de baja'];

export type CampoBusquedaEquipo =
  | 'todos'
  | 'codigo'
  | 'nombre'
  | 'marca_modelo'
  | 'serie'
  | 'ubicacion'
  | 'inventario';

const CAMPOS_BUSQUEDA_EQUIPO: { id: CampoBusquedaEquipo; label: string; placeholder: string }[] = [
  { id: 'todos', label: 'Todos los campos', placeholder: 'Buscar por cualquier campo (código, nombre, marca, serie...)' },
  { id: 'codigo', label: 'Código / ID', placeholder: 'Buscar solo por código (ej. EQ-2026-001)...' },
  { id: 'nombre', label: 'Nombre / Tipo', placeholder: 'Buscar por denominación de equipo (ej. Monitor, Ventilador)...' },
  { id: 'marca_modelo', label: 'Marca / Modelo', placeholder: 'Buscar por marca o modelo (ej. Philips, Mindray)...' },
  { id: 'serie', label: 'N° de Serie', placeholder: 'Buscar exactamente por número de serie...' },
  { id: 'ubicacion', label: 'Servicio Clínico', placeholder: 'Buscar por servicio clínico o recinto...' },
  { id: 'inventario', label: 'N° Inventario', placeholder: 'Buscar por folio o número de inventario...' },
];

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
  const [campoBusqueda, setCampoBusqueda] = useState<CampoBusquedaEquipo>('todos');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoEquipo | 'Todos'>('Todos');
  const [filtroUbicacion, setFiltroUbicacion] = useState<string>('todos');
  const [subfiltroMarca, setSubfiltroMarca] = useState<string>('todas');
  const [filtroModalidad, setFiltroModalidad] = useState<string>('todas');
  const [filtroVidaResidual, setFiltroVidaResidual] = useState<'todas' | 'vigente' | 'critica' | 'obsoleta'>('todas');
  const [filtroSoloConSerie, setFiltroSoloConSerie] = useState<boolean>(false);
  const [mostrarSubfiltros, setMostrarSubfiltros] = useState<boolean>(false);

  // Subfiltros interactivos por encabezado de columna (th)
  const [colFilters, setColFilters] = useState<{
    codigo: string;
    ubicacion: string;
    nombre: string;
    marca: string;
    modelo: string;
    serie: string;
    estado: string;
  }>({
    codigo: '',
    ubicacion: '',
    nombre: '',
    marca: '',
    modelo: '',
    serie: '',
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

  // Lista de Servicios Clínicos únicos para el Filtro Principal
  const listaUbicaciones = useMemo(() => {
    const set = new Set<string>();
    equiposBase.forEach((eq) => {
      if (eq.ubicacion && eq.ubicacion.trim()) set.add(eq.ubicacion.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [equiposBase]);

  // Subfiltro en cascada: Marcas disponibles (si se selecciona un servicio clínico, solo muestra las marcas de ese servicio)
  const listaMarcasEnUbicacion = useMemo(() => {
    const set = new Set<string>();
    const base =
      filtroUbicacion === 'todos'
        ? equiposBase
        : equiposBase.filter(
            (eq) => eq.ubicacion && eq.ubicacion.trim().toLowerCase() === filtroUbicacion.toLowerCase()
          );
    base.forEach((eq) => {
      if (eq.marca && eq.marca.trim()) set.add(eq.marca.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [equiposBase, filtroUbicacion]);

  // Lista de Modalidades de Adquisición únicas
  const listaModalidades = useMemo(() => {
    const set = new Set<string>();
    equiposBase.forEach((eq) => {
      if (eq.modalidad_adquisicion && eq.modalidad_adquisicion.trim()) {
        set.add(eq.modalidad_adquisicion.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [equiposBase]);

  // Lista de todas las marcas únicas para el subfiltro de columna
  const listaTodasMarcas = useMemo(() => {
    const set = new Set<string>();
    equiposBase.forEach((eq) => {
      if (eq.marca && eq.marca.trim()) set.add(eq.marca.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [equiposBase]);

  const listaEstadosEquipo = useMemo(() => {
    return ['Operativo', 'Mantenimiento', 'Dado de baja'];
  }, []);

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
  }, [
    search,
    campoBusqueda,
    estadoFiltro,
    filtroUbicacion,
    subfiltroMarca,
    filtroModalidad,
    filtroVidaResidual,
    filtroSoloConSerie,
  ]);

  // Si cambia el servicio clínico y la marca seleccionada ya no existe en el subfiltro, se reinicia
  useEffect(() => {
    if (subfiltroMarca !== 'todas' && !listaMarcasEnUbicacion.includes(subfiltroMarca)) {
      setSubfiltroMarca('todas');
    }
  }, [filtroUbicacion, listaMarcasEnUbicacion, subfiltroMarca]);

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

  // Filtrado compuesto con búsqueda específica por campo y subfiltros
  const filtered = useMemo(() => {
    return equiposBase.filter((eq) => {
      // 1. Búsqueda específica según el campo seleccionado
      const q = search.trim().toLowerCase();
      if (q !== '') {
        switch (campoBusqueda) {
          case 'codigo':
            if (!eq.codigo.toLowerCase().includes(q)) return false;
            break;
          case 'nombre':
            if (!eq.nombre.toLowerCase().includes(q)) return false;
            break;
          case 'marca_modelo': {
            const matchMarca = eq.marca && eq.marca.toLowerCase().includes(q);
            const matchModelo = eq.modelo && eq.modelo.toLowerCase().includes(q);
            if (!matchMarca && !matchModelo) return false;
            break;
          }
          case 'serie':
            if (!eq.serie || !eq.serie.toLowerCase().includes(q)) return false;
            break;
          case 'ubicacion':
            if (!eq.ubicacion || !eq.ubicacion.toLowerCase().includes(q)) return false;
            break;
          case 'inventario':
            if (!eq.inventario || !eq.inventario.toLowerCase().includes(q)) return false;
            break;
          case 'todos':
          default: {
            const matchesGlobal =
              eq.nombre.toLowerCase().includes(q) ||
              eq.codigo.toLowerCase().includes(q) ||
              (eq.marca && eq.marca.toLowerCase().includes(q)) ||
              (eq.modelo && eq.modelo.toLowerCase().includes(q)) ||
              (eq.serie && eq.serie.toLowerCase().includes(q)) ||
              (eq.ubicacion && eq.ubicacion.toLowerCase().includes(q)) ||
              (eq.inventario && eq.inventario.toLowerCase().includes(q));
            if (!matchesGlobal) return false;
            break;
          }
        }
      }

      // 2. Filtro Estado Operativo
      if (estadoFiltro !== 'Todos' && eq.estado !== estadoFiltro) {
        return false;
      }

      // 3. Filtro Principal: Servicio Clínico
      if (filtroUbicacion !== 'todos') {
        if (!eq.ubicacion || eq.ubicacion.trim().toLowerCase() !== filtroUbicacion.toLowerCase()) {
          return false;
        }
      }

      // 4. Subfiltro en cascada: Marca
      if (subfiltroMarca !== 'todas') {
        if (!eq.marca || eq.marca.trim().toLowerCase() !== subfiltroMarca.toLowerCase()) {
          return false;
        }
      }

      // 5. Filtro: Modalidad de Adquisición
      if (filtroModalidad !== 'todas') {
        if (!eq.modalidad_adquisicion || eq.modalidad_adquisicion.trim() !== filtroModalidad) {
          return false;
        }
      }

      // 6. Subfiltro: Vida Útil Residual / Condición
      if (filtroVidaResidual !== 'todas') {
        const residual =
          eq.vida_util_residual !== null && eq.vida_util_residual !== undefined
            ? Number(eq.vida_util_residual)
            : null;
        if (filtroVidaResidual === 'obsoleta') {
          if (residual === null || residual > 0) return false;
        } else if (filtroVidaResidual === 'critica') {
          if (residual === null || residual <= 0 || residual > 2) return false;
        } else if (filtroVidaResidual === 'vigente') {
          if (residual === null || residual <= 2) return false;
        }
      }

      // 7. Subfiltro: Solo con Serie Registrada
      if (filtroSoloConSerie) {
        if (!eq.serie || eq.serie.trim() === '' || eq.serie === 'S/N' || eq.serie === '—') {
          return false;
        }
      }

      // 8. Subfiltros por Encabezados de Columna (AND aditivo)
      if (colFilters.codigo.trim()) {
        const c = colFilters.codigo.trim().toLowerCase();
        if (!eq.codigo.toLowerCase().includes(c)) return false;
      }
      if (colFilters.ubicacion.trim() && colFilters.ubicacion.toLowerCase() !== 'todos') {
        const u = colFilters.ubicacion.trim().toLowerCase();
        if (!eq.ubicacion || !eq.ubicacion.toLowerCase().includes(u)) return false;
      }
      if (colFilters.nombre.trim()) {
        const n = colFilters.nombre.trim().toLowerCase();
        if (!eq.nombre.toLowerCase().includes(n)) return false;
      }
      if (
        colFilters.marca.trim() &&
        colFilters.marca.toLowerCase() !== 'todas' &&
        colFilters.marca.toLowerCase() !== 'todos'
      ) {
        const m = colFilters.marca.trim().toLowerCase();
        if (!eq.marca || !eq.marca.toLowerCase().includes(m)) return false;
      }
      if (colFilters.modelo.trim()) {
        const mod = colFilters.modelo.trim().toLowerCase();
        if (!eq.modelo || !eq.modelo.toLowerCase().includes(mod)) return false;
      }
      if (colFilters.serie.trim()) {
        const s = colFilters.serie.trim().toLowerCase();
        if (!eq.serie || !eq.serie.toLowerCase().includes(s)) return false;
      }
      if (colFilters.estado.trim() && colFilters.estado.toLowerCase() !== 'todos') {
        const est = colFilters.estado.trim().toLowerCase();
        if (!eq.estado || eq.estado.toLowerCase() !== est) return false;
      }

      return true;
    });

    // Ordenamiento interactivo por encabezado de columna
    if (sortConfig) {
      const { key, direction } = sortConfig;
      const factor = direction === 'asc' ? 1 : -1;
      return [...res].sort((a, b) => {
        let valA = '';
        let valB = '';
        switch (key) {
          case 'codigo':
            valA = a.codigo || '';
            valB = b.codigo || '';
            break;
          case 'ubicacion':
            valA = a.ubicacion || '';
            valB = b.ubicacion || '';
            break;
          case 'nombre':
            valA = a.nombre || '';
            valB = b.nombre || '';
            break;
          case 'marca':
            valA = a.marca || '';
            valB = b.marca || '';
            break;
          case 'modelo':
            valA = a.modelo || '';
            valB = b.modelo || '';
            break;
          case 'serie':
            valA = a.serie || '';
            valB = b.serie || '';
            break;
          case 'estado':
            valA = a.estado || '';
            valB = b.estado || '';
            break;
          default:
            return 0;
        }
        return valA.localeCompare(valB) * factor;
      });
    }

    return res;
  }, [
    equiposBase,
    search,
    campoBusqueda,
    estadoFiltro,
    filtroUbicacion,
    subfiltroMarca,
    filtroModalidad,
    filtroVidaResidual,
    filtroSoloConSerie,
    colFilters,
    sortConfig,
  ]);

  const total = equiposBase.length;
  const operativos = equiposBase.filter((e) => e.estado === 'Operativo').length;
  const mantenimiento = equiposBase.filter((e) => e.estado === 'Mantenimiento').length;

  // Contador de filtros activos
  const filtrosActivos = useMemo(() => {
    let count = 0;
    if (search.trim() !== '') count++;
    if (estadoFiltro !== 'Todos') count++;
    if (filtroUbicacion !== 'todos') count++;
    if (subfiltroMarca !== 'todas') count++;
    if (filtroModalidad !== 'todas') count++;
    if (filtroVidaResidual !== 'todas') count++;
    if (filtroSoloConSerie) count++;
    Object.values(colFilters).forEach((val) => {
      if (val.trim() !== '' && val.toLowerCase() !== 'todos' && val.toLowerCase() !== 'todas') {
        count++;
      }
    });
    return count;
  }, [
    search,
    estadoFiltro,
    filtroUbicacion,
    subfiltroMarca,
    filtroModalidad,
    filtroVidaResidual,
    filtroSoloConSerie,
    colFilters,
  ]);

  const handleLimpiarTodosLosFiltros = () => {
    setSearch('');
    setCampoBusqueda('todos');
    setEstadoFiltro('Todos');
    setFiltroUbicacion('todos');
    setSubfiltroMarca('todas');
    setFiltroModalidad('todas');
    setFiltroVidaResidual('todas');
    setFiltroSoloConSerie(false);
    setColFilters({
      codigo: '',
      ubicacion: '',
      nombre: '',
      marca: '',
      modelo: '',
      serie: '',
      estado: '',
    });
    setSortConfig(null);
  };

  function handleExportCSV() {
    if (filtered.length === 0) return;

    const columnas: ExportColumn<Equipo>[] = [
      {
        header: 'Código UEM',
        accessor: (eq) => eq.codigo,
      },
      {
        header: 'Nombre del Equipo',
        accessor: (eq) => eq.nombre,
      },
      {
        header: 'Marca',
        accessor: (eq) => eq.marca || '—',
      },
      {
        header: 'Modelo',
        accessor: (eq) => eq.modelo || '—',
      },
      {
        header: 'Serie',
        accessor: (eq) => eq.serie || 'S/N',
      },
      {
        header: 'Servicio Clínico / Ubicación',
        accessor: (eq) => eq.ubicacion || '—',
      },
      {
        header: 'Estado Operativo',
        accessor: (eq) => eq.estado || '—',
      },
      {
        header: 'Criticidad',
        accessor: (eq) => {
          const crit = (eq as unknown as { criticidad?: string }).criticidad;
          if (crit) return crit;
          const u = (eq.ubicacion || '').toUpperCase();
          if (
            u.includes('UCI') ||
            u.includes('UTI') ||
            u.includes('PABELL') ||
            u.includes('URGENC') ||
            u.includes('UPC')
          ) {
            return 'Alta';
          }
          return 'Media';
        },
      },
      {
        header: 'Frecuencia de Mantención',
        accessor: (eq) => {
          return (
            (eq as unknown as { frecuencia_mantencion?: string; frecuencia?: string }).frecuencia_mantencion ||
            (eq as unknown as { frecuencia?: string }).frecuencia ||
            'Semestral'
          );
        },
      },
    ];

    exportarACSV(filtered, columnas, 'Equipos_Catastro_Filtrados');
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
        {/* Barra Principal de Búsqueda Específica y Filtros */}
        <div className="flex flex-col gap-3.5 border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Input con Selector de Campo Específico de Búsqueda */}
            <div className="flex flex-1 items-stretch rounded-xl border border-slate-300 bg-white shadow-2xs transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
              {/* Selector de campo específico */}
              <div className="relative flex items-center">
                <select
                  value={campoBusqueda}
                  onChange={(e) => setCampoBusqueda(e.target.value as CampoBusquedaEquipo)}
                  title="Seleccionar campo específico para la búsqueda"
                  className="h-full rounded-l-xl border-r border-slate-200 bg-slate-50/90 py-2 pl-3 pr-7 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:bg-white focus:outline-none cursor-pointer transition-colors"
                >
                  {CAMPOS_BUSQUEDA_EQUIPO.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Campo de texto de búsqueda */}
              <div className="relative flex flex-1 items-center">
                <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    CAMPOS_BUSQUEDA_EQUIPO.find((c) => c.id === campoBusqueda)?.placeholder ||
                    'Buscar...'
                  }
                  className="w-full bg-transparent py-2.5 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    title="Borrar texto de búsqueda"
                    className="absolute right-2.5 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Botones de acción, contador y filtros rápidos */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="text-xs text-slate-500 whitespace-nowrap">
                Mostrando <span className="font-bold text-slate-900">{filtered.length}</span> de{' '}
                <span className="font-bold text-slate-900">{equiposBase.length}</span> registros
              </div>

              {filtrosActivos > 0 && (
                <button
                  type="button"
                  id="btn-limpiar-todos-filtros-equipos"
                  onClick={handleLimpiarTodosLosFiltros}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-100 hover:text-rose-800 transition active:scale-95 cursor-pointer"
                  title="Restablecer todos los filtros y búsqueda"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Limpiar todos los filtros ({filtrosActivos})</span>
                </button>
              )}

              {/* Botón para desplegar / contraer Filtros y Subfiltros Avanzados */}
              <button
                type="button"
                onClick={() => setMostrarSubfiltros((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold shadow-2xs transition-all active:scale-[0.98] ${
                  mostrarSubfiltros || filtrosActivos > (search.trim() ? 1 : 0)
                    ? 'border-blue-400 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600" />
                <span>Filtros y Subfiltros</span>
                {filtrosActivos > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    {filtrosActivos}
                  </span>
                )}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    mostrarSubfiltros ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Botón Exportar a Excel / CSV */}
              <button
                type="button"
                id="btn-exportar-equipos-csv"
                onClick={handleExportCSV}
                disabled={filtered.length === 0}
                title={
                  filtered.length === 0
                    ? 'No hay registros visibles para exportar'
                    : `Exportar ${filtered.length} equipo(s) a Excel / CSV`
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Exportar a Excel / CSV ({filtered.length})</span>
              </button>
            </div>
          </div>

          {/* Fila de Filtro Rápido por Estado */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="h-3 w-3" /> Estado:
              </span>
              {estados.map((e) => {
                const active = estadoFiltro === e;
                return (
                  <button
                    key={e}
                    onClick={() => setEstadoFiltro(e)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                      active
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {e}
                  </button>
                );
              })}
            </div>

            {filtrosActivos > 0 && (
              <button
                type="button"
                onClick={handleLimpiarTodosLosFiltros}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Limpiar todos los filtros ({filtrosActivos})</span>
              </button>
            )}
          </div>

          {/* Panel de Filtros y Subfiltros Avanzados en Cascada */}
          {mostrarSubfiltros && (
            <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/40 p-4 transition-all">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                    Panel de Filtros Específicos y Subfiltros en Cascada
                  </span>
                </div>
                <span className="text-[11px] text-blue-600 font-medium">
                  {filtered.length} {filtered.length === 1 ? 'equipo coincide' : 'equipos coinciden'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. FILTRO PRINCIPAL: Servicio Clínico */}
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    1. Servicio Clínico
                  </label>
                  <select
                    value={filtroUbicacion}
                    onChange={(e) => setFiltroUbicacion(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-slate-50/50 py-1.5 px-2.5 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="todos">Todos los servicios ({listaUbicaciones.length})</option>
                    {listaUbicaciones.map((ub) => (
                      <option key={ub} value={ub}>
                        {ub}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[10px] text-slate-400">
                    Filtro base por área hospitalaria
                  </span>
                </div>

                {/* 2. SUBFILTRO EN CASCADA: Marca en el servicio seleccionado */}
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    2. Subfiltro: Marca
                  </label>
                  <select
                    value={subfiltroMarca}
                    onChange={(e) => setSubfiltroMarca(e.target.value)}
                    disabled={listaMarcasEnUbicacion.length === 0}
                    className="w-full rounded-md border border-slate-200 bg-slate-50/50 py-1.5 px-2.5 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="todas">
                      {filtroUbicacion === 'todos'
                        ? `Todas las marcas (${listaMarcasEnUbicacion.length})`
                        : `Marcas en este servicio (${listaMarcasEnUbicacion.length})`}
                    </option>
                    {listaMarcasEnUbicacion.map((marca) => (
                      <option key={marca} value={marca}>
                        {marca}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[10px] text-slate-400">
                    Dependiente del servicio seleccionado
                  </span>
                </div>

                {/* 3. FILTRO: Modalidad de Adquisición */}
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    3. Modalidad de Compra
                  </label>
                  <select
                    value={filtroModalidad}
                    onChange={(e) => setFiltroModalidad(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-slate-50/50 py-1.5 px-2.5 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="todas">Todas las modalidades</option>
                    {listaModalidades.map((mod) => (
                      <option key={mod} value={mod}>
                        {mod}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[10px] text-slate-400">
                    Tipo contractual o procedencia
                  </span>
                </div>

                {/* 4. SUBFILTRO: Vida Útil Residual / Condición */}
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    4. Condición / Vida Residual
                  </label>
                  <select
                    value={filtroVidaResidual}
                    onChange={(e) =>
                      setFiltroVidaResidual(
                        e.target.value as 'todas' | 'vigente' | 'critica' | 'obsoleta'
                      )
                    }
                    className="w-full rounded-md border border-slate-200 bg-slate-50/50 py-1.5 px-2.5 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="todas">Todas las condiciones</option>
                    <option value="vigente">Vigente (&gt; 2 años vida residual)</option>
                    <option value="critica">Crítica / Próxima a obsolescencia (≤ 2 años)</option>
                    <option value="obsoleta">Obsolescencia técnica agotada (0 años)</option>
                  </select>
                  <span className="mt-1 block text-[10px] text-slate-400">
                    Estado de depreciación y recambio
                  </span>
                </div>
              </div>

              {/* Subfiltro específico complementario: Solo con serie */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-blue-200/50 pt-3">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filtroSoloConSerie}
                    onChange={(e) => setFiltroSoloConSerie(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Solo equipos con N° de Serie auditado (excluir sin serie)</span>
                </label>

                {filtrosActivos > 0 && (
                  <button
                    type="button"
                    onClick={handleLimpiarTodosLosFiltros}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Restablecer todos los subfiltros</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Chips de Filtros y Subfiltros Activos */}
          {filtrosActivos > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">Filtros aplicados:</span>

              {search.trim() !== '' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 py-0.5 pl-2.5 pr-1.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-600/20">
                  <span className="font-semibold text-blue-900">
                    {CAMPOS_BUSQUEDA_EQUIPO.find((c) => c.id === campoBusqueda)?.label}:
                  </span>
                  &ldquo;{search}&rdquo;
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="rounded-full p-0.5 hover:bg-blue-200/60"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {estadoFiltro !== 'Todos' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1.5 text-[11px] font-medium text-slate-800 ring-1 ring-slate-300/60">
                  <span className="font-semibold text-slate-900">Estado:</span> {estadoFiltro}
                  <button
                    type="button"
                    onClick={() => setEstadoFiltro('Todos')}
                    className="rounded-full p-0.5 hover:bg-slate-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {filtroUbicacion !== 'todos' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-0.5 pl-2.5 pr-1.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-600/20">
                  <span className="font-semibold text-indigo-900">Servicio:</span> {filtroUbicacion}
                  <button
                    type="button"
                    onClick={() => setFiltroUbicacion('todos')}
                    className="rounded-full p-0.5 hover:bg-indigo-200/60"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {subfiltroMarca !== 'todas' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 py-0.5 pl-2.5 pr-1.5 text-[11px] font-medium text-purple-700 ring-1 ring-purple-600/20">
                  <span className="font-semibold text-purple-900">Subfiltro Marca:</span> {subfiltroMarca}
                  <button
                    type="button"
                    onClick={() => setSubfiltroMarca('todas')}
                    className="rounded-full p-0.5 hover:bg-purple-200/60"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {filtroModalidad !== 'todas' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 py-0.5 pl-2.5 pr-1.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-600/20">
                  <span className="font-semibold text-amber-900">Modalidad:</span> {filtroModalidad}
                  <button
                    type="button"
                    onClick={() => setFiltroModalidad('todas')}
                    className="rounded-full p-0.5 hover:bg-amber-200/60"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {filtroVidaResidual !== 'todas' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 py-0.5 pl-2.5 pr-1.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-600/20">
                  <span className="font-semibold text-rose-900">Condición:</span>{' '}
                  {filtroVidaResidual === 'vigente'
                    ? 'Vigente'
                    : filtroVidaResidual === 'critica'
                    ? 'Crítica (≤ 2 años)'
                    : 'Obsolescencia (0 años)'}
                  <button
                    type="button"
                    onClick={() => setFiltroVidaResidual('todas')}
                    className="rounded-full p-0.5 hover:bg-rose-200/60"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {filtroSoloConSerie && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 py-0.5 pl-2.5 pr-1.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-600/20">
                  <span>Solo con N° Serie auditado</span>
                  <button
                    type="button"
                    onClick={() => setFiltroSoloConSerie(false)}
                    className="rounded-full p-0.5 hover:bg-emerald-200/60"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={handleLimpiarTodosLosFiltros}
                className="ml-auto text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-2"
              >
                Limpiar todo
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[200px]">
          <table className="w-full min-w-[840px] text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <TableColumnHeader
                  id="th-equipos-codigo"
                  title="Código / ID"
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
                  id="th-equipos-ubicacion"
                  title="Servicio Clínico"
                  sortKey="ubicacion"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterType="select"
                  filterValue={colFilters.ubicacion}
                  onFilterChange={(v) => handleColumnFilterChange('ubicacion', v)}
                  selectOptions={listaUbicaciones}
                  className="min-w-[160px]"
                />
                <TableColumnHeader
                  id="th-equipos-nombre"
                  title="Nombre / Equipo"
                  sortKey="nombre"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterType="text"
                  filterValue={colFilters.nombre}
                  onFilterChange={(v) => handleColumnFilterChange('nombre', v)}
                  placeholder="Filtrar nombre..."
                  className="min-w-[180px]"
                />
                <TableColumnHeader
                  id="th-equipos-marca"
                  title="Marca"
                  sortKey="marca"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterType="select"
                  filterValue={colFilters.marca}
                  onFilterChange={(v) => handleColumnFilterChange('marca', v)}
                  selectOptions={listaTodasMarcas}
                  className="min-w-[130px]"
                />
                <TableColumnHeader
                  id="th-equipos-modelo"
                  title="Modelo"
                  sortKey="modelo"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterType="text"
                  filterValue={colFilters.modelo}
                  onFilterChange={(v) => handleColumnFilterChange('modelo', v)}
                  placeholder="Filtrar modelo..."
                  className="min-w-[120px]"
                />
                <TableColumnHeader
                  id="th-equipos-serie"
                  title="Serie"
                  sortKey="serie"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterType="text"
                  filterValue={colFilters.serie}
                  onFilterChange={(v) => handleColumnFilterChange('serie', v)}
                  placeholder="Filtrar serie..."
                  className="min-w-[120px]"
                />
                <TableColumnHeader
                  id="th-equipos-estado"
                  title="Estado"
                  sortKey="estado"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterType="select"
                  filterValue={colFilters.estado}
                  onFilterChange={(v) => handleColumnFilterChange('estado', v)}
                  selectOptions={listaEstadosEquipo}
                  className="min-w-[140px]"
                />
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
                      {filtrosActivos > 0 && (
                        <button
                          type="button"
                          onClick={handleLimpiarTodosLosFiltros}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Restablecer todos los filtros</span>
                        </button>
                      )}
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
