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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
} from 'lucide-react';
import {
  type Equipo,
  type EstadoEquipo,
  type Convenio,
  type ConvenioEquipo,
  supabase,
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

export interface EquiposViewProps {
  equipos?: Equipo[];
  loading?: boolean;
  error?: string | null;
  onClearError?: () => void;
  onOpenAdd: () => void;
  onOpenEdit: (eq: Equipo) => void;
  onOpenMantenimiento: (eq: Equipo) => void;
  onOpenHojaVida: (eq: Equipo) => void;
  onDelete: (eq: Equipo) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onEquiposChanged?: () => void;
}

interface ActiveMenuState {
  equipo: Equipo;
  top: number;
  bottom?: number;
  left: number;
  openUpwards: boolean;
}

export default function EquiposView({
  equipos: equiposProp,
  error: errorProp,
  onClearError,
  onOpenAdd,
  onOpenEdit,
  onOpenMantenimiento,
  onOpenHojaVida,
  onDelete,
  searchQuery,
  onSearchChange,
}: EquiposViewProps) {
  const { usuarioActivo, puede, esClinico, esAuditor } = useAuth();

  // Estados de paginación servidor
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [equiposPaginados, setEquiposPaginados] = useState<Equipo[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [errorSupabase, setErrorSupabase] = useState<string | null>(null);

  // Estados de KPIs globales (consultas de recuento exacto en Supabase)
  const [kpis, setKpis] = useState<{ total: number; operativos: number; mantenimiento: number }>({
    total: 0,
    operativos: 0,
    mantenimiento: 0,
  });

  // Filtros interactivos
  const [search, setSearch] = useState(searchQuery ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [campoBusqueda, setCampoBusqueda] = useState<CampoBusquedaEquipo>('todos');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoEquipo | 'Todos'>('Todos');
  const [filtroUbicacion, setFiltroUbicacion] = useState<string>('todos');
  const [subfiltroMarca, setSubfiltroMarca] = useState<string>('todas');
  const [filtroModalidad, setFiltroModalidad] = useState<string>('todas');
  const [filtroVidaResidual, setFiltroVidaResidual] = useState<'todas' | 'vigente' | 'critica' | 'obsoleta'>('todas');
  const [filtroSoloConSerie, setFiltroSoloConSerie] = useState<boolean>(false);
  const [mostrarSubfiltros, setMostrarSubfiltros] = useState<boolean>(false);

  // Opciones para dropdowns de filtros obtenidos de la base de datos
  const [listaUbicaciones, setListaUbicaciones] = useState<string[]>([]);
  const [listaMarcas, setListaMarcas] = useState<string[]>([]);
  const [listaModalidades, setListaModalidades] = useState<string[]>([]);

  // Subfiltros interactivos por encabezado de columna (th)
  const [colFilters, setColFilters] = useState<{
    codigo: string;
    ubicacion: string;
    nombre: string;
    marca: string;
    modelo: string;
    serie: string;
    estado: string;
    condicion_contractual: string;
  }>({
    codigo: '',
    ubicacion: '',
    nombre: '',
    marca: '',
    modelo: '',
    serie: '',
    estado: '',
    condicion_contractual: '',
  });

  // Ordenamiento por columna
  const [sortConfig, setSortConfig] = useState<ColumnSortState | null>(null);

  // Convenios vinculados para determinar la Condición Contractual
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [convenioEquipos, setConvenioEquipos] = useState<ConvenioEquipo[]>([]);

  // Estado del menú contextual
  const [activeMenu, setActiveMenu] = useState<ActiveMenuState | null>(null);
  const menuDropdownRef = useRef<HTMLDivElement | null>(null);
  const [exportando, setExportando] = useState(false);

  // Sincronizar búsqueda global si se envía desde el header
  useEffect(() => {
    if (searchQuery !== undefined && searchQuery !== search) {
      setSearch(searchQuery);
    }
  }, [searchQuery, search]);

  // Debounce del input de búsqueda (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Resetear a la primera página cuando cambian los filtros principales o la búsqueda
  useEffect(() => {
    setPaginaActual(1);
  }, [
    debouncedSearch,
    campoBusqueda,
    estadoFiltro,
    filtroUbicacion,
    subfiltroMarca,
    filtroModalidad,
    filtroVidaResidual,
    filtroSoloConSerie,
    colFilters,
    sortConfig,
    pageSize,
  ]);

  // Cargar convenios para condición contractual
  useEffect(() => {
    let activo = true;
    async function cargarConvenios() {
      try {
        const [resC, resV] = await Promise.all([
          supabase.from('convenios').select('*'),
          supabase.from('convenio_equipos').select('*'),
        ]);
        if (activo) {
          if (resC.data) setConvenios(resC.data as Convenio[]);
          if (resV.data) setConvenioEquipos(resV.data as ConvenioEquipo[]);
        }
      } catch (e) {
        console.warn('Advertencia cargando convenios en EquiposView:', e);
      }
    }
    cargarConvenios();
    return () => {
      activo = false;
    };
  }, []);

  // Cargar opciones únicas de Servicios Clínicos, Marcas y Modalidades
  useEffect(() => {
    let activo = true;
    async function cargarOpcionesFiltros() {
      try {
        const { data, error } = await supabase
          .from('equipos')
          .select('ubicacion, marca, modalidad_adquisicion')
          .limit(1000);

        if (activo && !error && data) {
          const uSet = new Set<string>();
          const mSet = new Set<string>();
          const modSet = new Set<string>();

          data.forEach((row: { ubicacion?: string; marca?: string; modalidad_adquisicion?: string }) => {
            if (row.ubicacion?.trim()) uSet.add(row.ubicacion.trim());
            if (row.marca?.trim()) mSet.add(row.marca.trim());
            if (row.modalidad_adquisicion?.trim()) modSet.add(row.modalidad_adquisicion.trim());
          });

          if (equiposProp) {
            equiposProp.forEach((eq) => {
              if (eq.ubicacion?.trim()) uSet.add(eq.ubicacion.trim());
              if (eq.marca?.trim()) mSet.add(eq.marca.trim());
              if (eq.modalidad_adquisicion?.trim()) modSet.add(eq.modalidad_adquisicion.trim());
            });
          }

          setListaUbicaciones(Array.from(uSet).sort((a, b) => a.localeCompare(b)));
          setListaMarcas(Array.from(mSet).sort((a, b) => a.localeCompare(b)));
          setListaModalidades(Array.from(modSet).sort((a, b) => a.localeCompare(b)));
        }
      } catch (err) {
        console.warn('Error cargando listas de filtros:', err);
      }
    }
    cargarOpcionesFiltros();
    return () => {
      activo = false;
    };
  }, [equiposProp]);

  // Consultar KPIs globales de equipos en Supabase (HEAD exact count)
  const fetchKpis = useCallback(async () => {
    try {
      let qTotal = supabase.from('equipos').select('*', { count: 'exact', head: true });
      let qOper = supabase.from('equipos').select('*', { count: 'exact', head: true }).eq('estado', 'Operativo');
      let qMant = supabase.from('equipos').select('*', { count: 'exact', head: true }).eq('estado', 'Mantenimiento');

      if (esClinico && usuarioActivo.servicio_clinico_asignado) {
        const serv = `%${usuarioActivo.servicio_clinico_asignado.trim()}%`;
        qTotal = qTotal.ilike('ubicacion', serv);
        qOper = qOper.ilike('ubicacion', serv);
        qMant = qMant.ilike('ubicacion', serv);
      }

      const [resTotal, resOper, resMant] = await Promise.all([qTotal, qOper, qMant]);

      setKpis({
        total: resTotal.count ?? (equiposProp ? equiposProp.length : 0),
        operativos: resOper.count ?? (equiposProp ? equiposProp.filter((e) => e.estado === 'Operativo').length : 0),
        mantenimiento: resMant.count ?? (equiposProp ? equiposProp.filter((e) => e.estado === 'Mantenimiento').length : 0),
      });
    } catch (e) {
      console.warn('Error al obtener KPIs exactos de Supabase:', e);
      if (equiposProp && equiposProp.length > 0) {
        setKpis({
          total: equiposProp.length,
          operativos: equiposProp.filter((e) => e.estado === 'Operativo').length,
          mantenimiento: equiposProp.filter((e) => e.estado === 'Mantenimiento').length,
        });
      }
    }
  }, [esClinico, usuarioActivo.servicio_clinico_asignado, equiposProp]);

  // Consulta paginada principal con Supabase
  const fetchEquiposPaginados = useCallback(async () => {
    setCargando(true);
    setErrorSupabase(null);

    try {
      let query = supabase.from('equipos').select('*', { count: 'exact' });

      // 1. RBAC Clínico: Restricción por servicio clínico asignado
      if (esClinico && usuarioActivo.servicio_clinico_asignado) {
        query = query.ilike('ubicacion', `%${usuarioActivo.servicio_clinico_asignado.trim()}%`);
      }

      // 2. Buscador integrado a nivel de base de datos
      const term = debouncedSearch.trim();
      if (term) {
        // Sanitizar caracteres especiales para PostgREST ilike/or
        const cleanTerm = term.replace(/[,()]/g, ' ').trim();
        if (cleanTerm) {
          switch (campoBusqueda) {
            case 'codigo':
              query = query.ilike('codigo', `%${cleanTerm}%`);
              break;
            case 'nombre':
              query = query.ilike('nombre', `%${cleanTerm}%`);
              break;
            case 'serie':
              query = query.ilike('serie', `%${cleanTerm}%`);
              break;
            case 'marca_modelo':
              query = query.or(`marca.ilike.%${cleanTerm}%,modelo.ilike.%${cleanTerm}%`);
              break;
            case 'ubicacion':
              query = query.ilike('ubicacion', `%${cleanTerm}%`);
              break;
            case 'inventario':
              query = query.ilike('inventario', `%${cleanTerm}%`);
              break;
            case 'todos':
            default:
              query = query.or(
                `codigo.ilike.%${cleanTerm}%,nombre.ilike.%${cleanTerm}%,serie.ilike.%${cleanTerm}%,marca.ilike.%${cleanTerm}%,modelo.ilike.%${cleanTerm}%,ubicacion.ilike.%${cleanTerm}%,inventario.ilike.%${cleanTerm}%`
              );
              break;
          }
        }
      }

      // 3. Filtro Estado Operativo
      if (estadoFiltro !== 'Todos') {
        query = query.eq('estado', estadoFiltro);
      }

      // 4. Filtro Ubicación (Servicio Clínico)
      if (filtroUbicacion !== 'todos') {
        query = query.eq('ubicacion', filtroUbicacion);
      }

      // 5. Subfiltro Marca
      if (subfiltroMarca !== 'todas') {
        query = query.eq('marca', subfiltroMarca);
      }

      // 6. Filtro Modalidad de Adquisición
      if (filtroModalidad !== 'todas') {
        query = query.eq('modalidad_adquisicion', filtroModalidad);
      }

      // 7. Subfiltro Vida Útil Residual
      if (filtroVidaResidual !== 'todas') {
        if (filtroVidaResidual === 'obsoleta') {
          query = query.lte('vida_util_residual', 0);
        } else if (filtroVidaResidual === 'critica') {
          query = query.gt('vida_util_residual', 0).lte('vida_util_residual', 2);
        } else if (filtroVidaResidual === 'vigente') {
          query = query.gt('vida_util_residual', 2);
        }
      }

      // 8. Subfiltro Solo con Serie
      if (filtroSoloConSerie) {
        query = query.not('serie', 'is', null).neq('serie', '').neq('serie', 'S/N').neq('serie', '—');
      }

      // 9. Subfiltros por Encabezados de Columna (AND aditivo)
      if (colFilters.codigo.trim()) {
        query = query.ilike('codigo', `%${colFilters.codigo.trim()}%`);
      }
      if (colFilters.ubicacion.trim() && colFilters.ubicacion.toLowerCase() !== 'todos') {
        query = query.ilike('ubicacion', `%${colFilters.ubicacion.trim()}%`);
      }
      if (colFilters.nombre.trim()) {
        query = query.ilike('nombre', `%${colFilters.nombre.trim()}%`);
      }
      if (
        colFilters.marca.trim() &&
        colFilters.marca.toLowerCase() !== 'todas' &&
        colFilters.marca.toLowerCase() !== 'todos'
      ) {
        query = query.ilike('marca', `%${colFilters.marca.trim()}%`);
      }
      if (colFilters.modelo.trim()) {
        query = query.ilike('modelo', `%${colFilters.modelo.trim()}%`);
      }
      if (colFilters.serie.trim()) {
        query = query.ilike('serie', `%${colFilters.serie.trim()}%`);
      }
      if (colFilters.estado.trim() && colFilters.estado.toLowerCase() !== 'todos') {
        query = query.eq('estado', colFilters.estado.trim());
      }

      // 10. Ordenamiento interactivo
      if (sortConfig && sortConfig.key !== 'condicion_contractual') {
        query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // 11. Paginación Servidor con .range(desde, hasta)
      const desde = (paginaActual - 1) * pageSize;
      const hasta = desde + pageSize - 1;
      query = query.range(desde, hasta);

      const { data, count, error } = await query;

      if (error) {
        console.error('Error devuelto por Supabase al consultar equipos:', error);
        setErrorSupabase(
          `Error de Supabase: ${error.message || 'Fallo de consulta'}${
            error.details ? ` (${error.details})` : ''
          }${error.hint ? ` - Sugerencia: ${error.hint}` : ''}`
        );
        setEquiposPaginados([]);
        setTotalCount(0);
      } else {
        const registros = (data as Equipo[]) || [];
        setEquiposPaginados(registros);
        setTotalCount(count ?? registros.length);
        setErrorSupabase(null);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err);
      console.error('Error de red o RLS en Supabase:', err);
      setErrorSupabase(`Error de conexión o RLS en Supabase: ${msg}`);
      setEquiposPaginados([]);
      setTotalCount(0);
    } finally {
      setCargando(false);
    }
  }, [
    debouncedSearch,
    campoBusqueda,
    estadoFiltro,
    filtroUbicacion,
    subfiltroMarca,
    filtroModalidad,
    filtroVidaResidual,
    filtroSoloConSerie,
    colFilters,
    sortConfig,
    paginaActual,
    pageSize,
    esClinico,
    usuarioActivo.servicio_clinico_asignado,
  ]);

  // Ejecutar consulta al cambiar dependencias
  useEffect(() => {
    fetchEquiposPaginados();
  }, [fetchEquiposPaginados]);

  // Cargar KPIs iniciales y escuchar eventos de actualización de equipos
  useEffect(() => {
    fetchKpis();

    const handleUpdate = () => {
      fetchKpis();
      fetchEquiposPaginados();
    };

    window.addEventListener('equipos_updated', handleUpdate);
    return () => {
      window.removeEventListener('equipos_updated', handleUpdate);
    };
  }, [fetchKpis, fetchEquiposPaginados]);

  // Mapa de condición contractual por ID de equipo según convenios activos
  const condicionContractualMap = useMemo(() => {
    const map = new Map<
      string,
      {
        tipo: 'garantia' | 'vigente' | 'por_vencer' | 'sin_convenio' | 'vencido';
        label: string;
        badgeClass: string;
        dotClass: string;
        convenioCodigo?: string;
        convenioNombre?: string;
        empresa?: string;
        diasRestantes?: number;
      }
    >();

    const hoy = new Date();

    equiposPaginados.forEach((eq) => {
      const vinculo = convenioEquipos.find(
        (v) => v.equipo_id === eq.id && v.estado_vinculo === 'Activo'
      );

      if (!vinculo) {
        map.set(eq.id, {
          tipo: 'sin_convenio',
          label: 'Sin Convenio / Vencido',
          badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 ring-slate-400/20',
          dotClass: 'bg-slate-400',
        });
        return;
      }

      const conv = convenios.find((c) => c.id === vinculo.convenio_id);
      if (!conv) {
        map.set(eq.id, {
          tipo: 'sin_convenio',
          label: 'Sin Convenio / Vencido',
          badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 ring-slate-400/20',
          dotClass: 'bg-slate-400',
        });
        return;
      }

      let diasRestantes = 999;
      if (conv.fecha_termino) {
        const fTerm = new Date(conv.fecha_termino);
        diasRestantes = Math.ceil((fTerm.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      }

      if (diasRestantes < 0 || conv.estado === 'Vencido' || conv.estado === 'Finalizado') {
        map.set(eq.id, {
          tipo: 'vencido',
          label: 'Sin Convenio / Vencido',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 ring-rose-500/20',
          dotClass: 'bg-rose-500',
          convenioCodigo: conv.codigo,
          convenioNombre: conv.nombre,
          empresa: conv.empresa,
          diasRestantes,
        });
        return;
      }

      if (conv.tipo_convenio === 'Garantía') {
        map.set(eq.id, {
          tipo: 'garantia',
          label: 'En Garantía',
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-emerald-500/20 font-bold',
          dotClass: 'bg-emerald-500',
          convenioCodigo: conv.codigo,
          convenioNombre: conv.nombre,
          empresa: conv.empresa,
          diasRestantes,
        });
        return;
      }

      if (diasRestantes >= 0 && diasRestantes <= 60) {
        const label =
          conv.tipo_convenio === 'Comodato'
            ? 'Comodato por Vencer'
            : conv.tipo_convenio === 'Arriendo'
            ? 'Arriendo por Vencer'
            : `${conv.tipo_convenio} por Vencer`;

        map.set(eq.id, {
          tipo: 'por_vencer',
          label,
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 ring-amber-500/20 font-bold',
          dotClass: 'bg-amber-500 animate-pulse',
          convenioCodigo: conv.codigo,
          convenioNombre: conv.nombre,
          empresa: conv.empresa,
          diasRestantes,
        });
        return;
      }

      const label =
        conv.tipo_convenio === 'Comodato'
          ? 'Comodato Vigente'
          : conv.tipo_convenio === 'Arriendo'
          ? 'Arriendo Vigente'
          : `${conv.tipo_convenio} Vigente`;

      map.set(eq.id, {
        tipo: 'vigente',
        label,
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-500/20 font-medium',
        dotClass: 'bg-blue-500',
        convenioCodigo: conv.codigo,
        convenioNombre: conv.nombre,
        empresa: conv.empresa,
        diasRestantes,
      });
    });

    return map;
  }, [equiposPaginados, convenioEquipos, convenios]);

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
    if (onSearchChange) onSearchChange('');
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
      condicion_contractual: '',
    });
    setSortConfig(null);
    setPaginaActual(1);
  };

  // Cálculos de navegación de páginas
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const registroInicio = totalCount === 0 ? 0 : (paginaActual - 1) * pageSize + 1;
  const registroFin = Math.min((paginaActual - 1) * pageSize + pageSize, totalCount);

  // Manejo de exportación a CSV con volumen amplio
  async function handleExportCSV() {
    setExportando(true);
    try {
      let query = supabase.from('equipos').select('*');

      if (esClinico && usuarioActivo.servicio_clinico_asignado) {
        query = query.ilike('ubicacion', `%${usuarioActivo.servicio_clinico_asignado.trim()}%`);
      }

      const term = debouncedSearch.trim();
      if (term) {
        const cleanTerm = term.replace(/[,()]/g, ' ').trim();
        if (cleanTerm) {
          query = query.or(
            `codigo.ilike.%${cleanTerm}%,nombre.ilike.%${cleanTerm}%,serie.ilike.%${cleanTerm}%,marca.ilike.%${cleanTerm}%,modelo.ilike.%${cleanTerm}%,ubicacion.ilike.%${cleanTerm}%,inventario.ilike.%${cleanTerm}%`
          );
        }
      }

      if (estadoFiltro !== 'Todos') query = query.eq('estado', estadoFiltro);
      if (filtroUbicacion !== 'todos') query = query.eq('ubicacion', filtroUbicacion);
      if (subfiltroMarca !== 'todas') query = query.eq('marca', subfiltroMarca);
      if (filtroModalidad !== 'todas') query = query.eq('modalidad_adquisicion', filtroModalidad);

      // Limitar a máximo 5.000 para no sobrecargar descarga
      query = query.limit(5000);

      const { data, error } = await query;
      if (error) throw error;

      const itemsAExportar = (data as Equipo[]) || equiposPaginados;

      const columnas: ExportColumn<Equipo>[] = [
        { header: 'Código UEM', accessor: (eq) => eq.codigo },
        { header: 'Nombre del Equipo', accessor: (eq) => eq.nombre },
        { header: 'Marca', accessor: (eq) => eq.marca || '—' },
        { header: 'Modelo', accessor: (eq) => eq.modelo || '—' },
        { header: 'Serie', accessor: (eq) => eq.serie || 'S/N' },
        { header: 'Servicio Clínico / Ubicación', accessor: (eq) => eq.ubicacion || '—' },
        { header: 'Estado Operativo', accessor: (eq) => eq.estado || '—' },
        {
          header: 'Condición Contractual',
          accessor: (eq) => {
            const cond = condicionContractualMap.get(eq.id);
            return cond ? cond.label : 'Sin Convenio / Vencido';
          },
        },
        {
          header: 'Convenio Asociado',
          accessor: (eq) => {
            const cond = condicionContractualMap.get(eq.id);
            return cond?.convenioCodigo ? `${cond.convenioCodigo}: ${cond.convenioNombre}` : '—';
          },
        },
      ];

      exportarACSV(itemsAExportar, columnas, `Catastro_Equipos_${itemsAExportar.length}_registros`);
    } catch (e) {
      console.warn('Fallo en descarga masiva de CSV, exportando página visible:', e);
      const columnas: ExportColumn<Equipo>[] = [
        { header: 'Código UEM', accessor: (eq) => eq.codigo },
        { header: 'Nombre del Equipo', accessor: (eq) => eq.nombre },
        { header: 'Marca', accessor: (eq) => eq.marca || '—' },
        { header: 'Modelo', accessor: (eq) => eq.modelo || '—' },
        { header: 'Serie', accessor: (eq) => eq.serie || 'S/N' },
        { header: 'Servicio Clínico / Ubicación', accessor: (eq) => eq.ubicacion || '—' },
        { header: 'Estado Operativo', accessor: (eq) => eq.estado || '—' },
      ];
      exportarACSV(equiposPaginados, columnas, 'Catastro_Equipos_Pagina');
    } finally {
      setExportando(false);
    }
  }

  return (
    <div>
      {/* Alerta de Error de Supabase exacto (RLS, Red o BD) */}
      {errorSupabase && (
        <div
          id="alert-error-supabase-equipos"
          role="alert"
          className="mb-6 rounded-2xl border border-rose-300 bg-rose-50 p-4 shadow-sm animate-in fade-in"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-rose-950">
                  Fallo en Consulta a Base de Datos (Supabase)
                </h3>
                <button
                  type="button"
                  onClick={() => setErrorSupabase(null)}
                  className="rounded-lg p-1 text-rose-500 hover:bg-rose-100 hover:text-rose-800"
                  title="Cerrar alerta"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-xs text-rose-800 font-mono bg-white/80 rounded-lg p-2.5 border border-rose-200 break-all select-all">
                {errorSupabase}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={fetchEquiposPaginados}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 transition active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reintentar Consulta</span>
                </button>
                <span className="text-[11px] text-rose-700">
                  Si persiste, verifique políticas de acceso RLS o conectividad con PostgREST.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de error heredado de props si existe */}
      {errorProp && !errorSupabase && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="flex-1">{errorProp}</div>
          {onClearError && (
            <button onClick={onClearError} className="text-rose-500 hover:text-rose-700">
              ×
            </button>
          )}
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
                ({kpis.total.toLocaleString()} equipos vinculados).
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

      {/* Header bar con Título y Botón Agregar Equipo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Catastro Hospitalario de Equipos</h2>
          <p className="text-xs text-slate-500">
            Inventario técnico asistencial con paginación servidor de alto rendimiento ({kpis.total.toLocaleString()} registros en total)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              fetchKpis();
              fetchEquiposPaginados();
            }}
            disabled={cargando}
            title="Refrescar catálogo desde Supabase"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${cargando ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          {puede('crear_equipos') && (
            <button
              type="button"
              onClick={onOpenAdd}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Agregar Equipo</span>
            </button>
          )}
        </div>
      </div>

      {/* Dashboard de KPIs conectado con recuentos globales exactos */}
      <Dashboard
        total={kpis.total}
        operativos={kpis.operativos}
        mantenimiento={kpis.mantenimiento}
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
                  title="Seleccionar campo específico para la búsqueda en todo el universo de equipos"
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
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (onSearchChange) onSearchChange(e.target.value);
                  }}
                  placeholder={
                    CAMPOS_BUSQUEDA_EQUIPO.find((c) => c.id === campoBusqueda)?.placeholder ||
                    'Buscar en todo el catastro...'
                  }
                  className="w-full bg-transparent py-2.5 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      if (onSearchChange) onSearchChange('');
                    }}
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
                {cargando ? (
                  <span className="inline-flex items-center gap-1.5 text-blue-600 font-medium">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Consultando Supabase...
                  </span>
                ) : (
                  <span>
                    Coincidencias:{' '}
                    <span className="font-bold text-slate-900">{totalCount.toLocaleString()}</span> de{' '}
                    <span className="font-bold text-slate-900">{kpis.total.toLocaleString()}</span> equipos
                  </span>
                )}
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
                  <span>Limpiar filtros ({filtrosActivos})</span>
                </button>
              )}

              {/* Botón para desplegar / contraer Filtros y Subfiltros Avanzados */}
              <button
                type="button"
                onClick={() => setMostrarSubfiltros((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold shadow-2xs transition-all active:scale-[0.98] cursor-pointer ${
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
                disabled={exportando || totalCount === 0}
                title={
                  totalCount === 0
                    ? 'No hay registros para exportar'
                    : `Exportar hasta ${totalCount.toLocaleString()} equipos a Excel / CSV`
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none cursor-pointer"
              >
                {exportando ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                )}
                <span>Exportar CSV</span>
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
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
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

            {/* Selector de tamaño de página integrado arriba también */}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Registros por página:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white py-1 px-2.5 text-xs font-semibold text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Panel de Filtros y Subfiltros Avanzados en Cascada */}
          {mostrarSubfiltros && (
            <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/40 p-4 transition-all">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                    Filtros Avanzados Directos a Supabase
                  </span>
                </div>
                <span className="text-[11px] text-blue-600 font-medium">
                  {totalCount.toLocaleString()} {totalCount === 1 ? 'equipo coincide' : 'equipos coinciden'}
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

                {/* 2. SUBFILTRO EN CASCADA: Marca */}
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    2. Marca Fabricante
                  </label>
                  <select
                    value={subfiltroMarca}
                    onChange={(e) => setSubfiltroMarca(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-slate-50/50 py-1.5 px-2.5 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="todas">Todas las marcas ({listaMarcas.length})</option>
                    {listaMarcas.map((marca) => (
                      <option key={marca} value={marca}>
                        {marca}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[10px] text-slate-400">
                    Fabricante o marca comercial
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

                {/* 4. SUBFILTRO: Vida Útil Residual */}
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
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Restablecer filtros avanzados</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Chips de Filtros Activos */}
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
                    onClick={() => {
                      setSearch('');
                      if (onSearchChange) onSearchChange('');
                    }}
                    className="rounded-full p-0.5 hover:bg-blue-200/60"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {estadoFiltro !== 'Todos' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-400/20">
                  Estado: {estadoFiltro}
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
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-0.5 pl-2.5 pr-1.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-500/20">
                  Servicio: {filtroUbicacion}
                  <button
                    type="button"
                    onClick={() => setFiltroUbicacion('todos')}
                    className="rounded-full p-0.5 hover:bg-indigo-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {subfiltroMarca !== 'todas' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 py-0.5 pl-2.5 pr-1.5 text-[11px] font-medium text-teal-700 ring-1 ring-teal-500/20">
                  Marca: {subfiltroMarca}
                  <button
                    type="button"
                    onClick={() => setSubfiltroMarca('todas')}
                    className="rounded-full p-0.5 hover:bg-teal-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {filtroSoloConSerie && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 py-0.5 pl-2.5 pr-1.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-500/20">
                  Con Serie Registrada
                  <button
                    type="button"
                    onClick={() => setFiltroSoloConSerie(false)}
                    className="rounded-full p-0.5 hover:bg-amber-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Indicador sutil de recarga cuando la tabla ya tiene datos */}
        {cargando && equiposPaginados.length > 0 && (
          <div className="h-1 w-full bg-blue-100 overflow-hidden">
            <div className="h-full bg-blue-600 animate-pulse w-full" />
          </div>
        )}

        {/* Tabla Responsiva de Equipos */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75">
                <TableColumnHeader
                  id="th-equipos-codigo"
                  title="Código UEM"
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
                  filterType="text"
                  filterValue={colFilters.ubicacion}
                  onFilterChange={(v) => handleColumnFilterChange('ubicacion', v)}
                  placeholder="Filtrar servicio..."
                  className="min-w-[180px]"
                />
                <TableColumnHeader
                  id="th-equipos-nombre"
                  title="Nombre del Equipo"
                  sortKey="nombre"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterType="text"
                  filterValue={colFilters.nombre}
                  onFilterChange={(v) => handleColumnFilterChange('nombre', v)}
                  placeholder="Filtrar nombre..."
                  className="min-w-[200px]"
                />
                <TableColumnHeader
                  id="th-equipos-marca"
                  title="Marca"
                  sortKey="marca"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterType="text"
                  filterValue={colFilters.marca}
                  onFilterChange={(v) => handleColumnFilterChange('marca', v)}
                  placeholder="Filtrar marca..."
                  className="min-w-[120px]"
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
                  selectOptions={['Operativo', 'Mantenimiento', 'Dado de baja']}
                  className="min-w-[140px]"
                />
                <TableColumnHeader
                  id="th-equipos-condicion"
                  title="Condición Contractual"
                  sortKey="condicion_contractual"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  filterType="select"
                  filterValue={colFilters.condicion_contractual}
                  onFilterChange={(v) => handleColumnFilterChange('condicion_contractual', v)}
                  selectOptions={[
                    'En Garantía',
                    'Comodato Vigente',
                    'Arriendo Vigente',
                    'Comodato por Vencer',
                    'Sin Convenio / Vencido',
                  ]}
                  className="min-w-[180px]"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Estado de Carga con Esqueleto Visual */}
              {cargando && equiposPaginados.length === 0 && (
                <>
                  {Array.from({ length: Math.min(pageSize, 10) }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="animate-pulse bg-white">
                      <td className="px-5 py-4">
                        <div className="h-6 w-24 rounded-lg bg-slate-200" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-4 w-32 rounded bg-slate-200" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-4 w-48 rounded bg-slate-200" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-4 w-20 rounded bg-slate-200" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-4 w-24 rounded bg-slate-200" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-4 w-28 rounded bg-slate-200" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-6 w-24 rounded-full bg-slate-200" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-6 w-36 rounded-full bg-slate-200" />
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {/* Estado Vacío */}
              {!cargando && equiposPaginados.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <Boxes className="h-10 w-10 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-600">
                        No se encontraron equipos en esta consulta
                      </p>
                      <p className="text-xs text-slate-400 text-center max-w-md">
                        {esClinico
                          ? `No hay registros vinculados a ${usuarioActivo.servicio_clinico_asignado} con los filtros seleccionados.`
                          : 'Intenta modificar el término de búsqueda o limpiar los filtros activos.'}
                      </p>
                      {filtrosActivos > 0 && (
                        <button
                          type="button"
                          onClick={handleLimpiarTodosLosFiltros}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Restablecer todos los filtros</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {/* Filas de Equipos Paginados */}
              {equiposPaginados.map((eq) => (
                <tr key={eq.id} className="group transition-colors hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={(e) => toggleMenu(eq, e)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-xs font-semibold transition-all cursor-pointer ${
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
                  <td className="px-5 py-4 whitespace-nowrap">
                    {(() => {
                      const cond = condicionContractualMap.get(eq.id) || {
                        tipo: 'sin_convenio',
                        label: 'Sin Convenio / Vencido',
                        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 ring-slate-400/20',
                        dotClass: 'bg-slate-400',
                      };
                      return (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ring-1 ${cond.badgeClass}`}
                          title={
                            cond.convenioCodigo
                              ? `${cond.convenioCodigo}: ${cond.convenioNombre}${
                                  cond.diasRestantes !== undefined
                                    ? ` (${cond.diasRestantes} días restantes)`
                                    : ''
                                }`
                              : 'Sin convenio activo asociado'
                          }
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${cond.dotClass}`} />
                          {cond.label}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* BARRA DE NAVEGACIÓN INFERIOR CON PAGINACIÓN SERVIDOR */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/70 px-5 py-4 text-xs text-slate-600">
          {/* Rango de registros y total general */}
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Mostrando registros{' '}
              <span className="font-bold text-slate-900">{registroInicio.toLocaleString()}</span> -{' '}
              <span className="font-bold text-slate-900">{registroFin.toLocaleString()}</span> de{' '}
              <span className="font-bold text-slate-900">{totalCount.toLocaleString()}</span> equipos
            </span>
            {esClinico && (
              <span className="text-slate-400">
                (Filtro asignado: {usuarioActivo.servicio_clinico_asignado})
              </span>
            )}
          </div>

          {/* Controles de Navegación: Primera, Anterior, Página X de N, Siguiente, Última */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Selector de tamaño de página inferior */}
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-[11px] text-slate-500">Filas:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white py-1 px-2 text-xs font-semibold text-slate-700 shadow-2xs focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              {/* Primera Página */}
              <button
                type="button"
                onClick={() => setPaginaActual(1)}
                disabled={paginaActual <= 1 || cargando}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 transition active:scale-95 cursor-pointer"
                title="Ir a la primera página"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Primera</span>
              </button>

              {/* Anterior */}
              <button
                type="button"
                onClick={() => setPaginaActual((prev) => Math.max(1, prev - 1))}
                disabled={paginaActual <= 1 || cargando}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 transition active:scale-95 cursor-pointer"
                title="Página anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Anterior</span>
              </button>

              {/* Indicador de Página y Salto Rápido */}
              <div className="flex items-center gap-1.5 px-2">
                <span className="font-semibold text-slate-700">Página</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={paginaActual}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1 && val <= totalPages) {
                      setPaginaActual(val);
                    }
                  }}
                  className="w-14 rounded-lg border border-slate-300 bg-white py-1 px-1.5 text-center text-xs font-bold text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none"
                />
                <span className="text-slate-500">de</span>
                <span className="font-bold text-slate-800">{totalPages.toLocaleString()}</span>
              </div>

              {/* Siguiente */}
              <button
                type="button"
                onClick={() => setPaginaActual((prev) => Math.min(totalPages, prev + 1))}
                disabled={paginaActual >= totalPages || cargando}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 transition active:scale-95 cursor-pointer"
                title="Página siguiente"
              >
                <span>Siguiente</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>

              {/* Última Página */}
              <button
                type="button"
                onClick={() => setPaginaActual(totalPages)}
                disabled={paginaActual >= totalPages || cargando}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 transition active:scale-95 cursor-pointer"
                title="Ir a la última página"
              >
                <span className="hidden md:inline">Última</span>
                <ChevronsRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
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
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-amber-50 hover:text-amber-800 cursor-pointer"
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
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
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
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 cursor-pointer"
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
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 cursor-pointer"
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
