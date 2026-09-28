import { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  X,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Shield,
  Wrench,
  Stethoscope,
  Eye,
  Power,
  Lock,
  Building2,
  Calendar,
  Sparkles,
  RotateCcw,
  Loader2,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import {
  type PerfilUsuario,
  type RolUsuario,
  supabase,
} from '@/lib/supabase';
import UsuarioModal from '@/components/UsuarioModal';

const FILTROS_ROLES: { valor: string; label: string }[] = [
  { valor: 'Todos', label: 'Todos los roles' },
  { valor: 'Administrador (Jefe de Unidad)', label: 'Administrador (Jefe de Unidad)' },
  { valor: 'Ingeniero Supervisor', label: 'Ingeniero Supervisor' },
  { valor: 'Ingeniero de Servicio / Técnico', label: 'Ingeniero de Servicio / Técnico' },
  { valor: 'Clínico / Solicitante', label: 'Clínico / Solicitante' },
  { valor: 'Auditor / Directivo', label: 'Auditor / Directivo' },
];

export default function UsuariosView() {
  const {
    usuarioActivo,
    usuarioAutenticado,
    usuarios,
    actualizarUsuario,
    refetchUsuarios,
    cambiarUsuarioActivo,
    esAdmin,
    esAdminReal,
    detenerSimulacion,
  } = useAuth();

  // Filtros de barra superior
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState<string>('Todos');
  const [filtroEstado, setFiltroEstado] = useState<'Todos' | 'Activos' | 'Inactivos'>('Todos');

  // Estado del Modal de Creación / Edición
  const [modalOpen, setModalOpen] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<PerfilUsuario | null>(null);

  // Estado del Modal de Confirmación para Desactivar Cuenta
  const [usuarioADesactivar, setUsuarioADesactivar] = useState<PerfilUsuario | null>(null);
  const [procesandoEstado, setProcesandoEstado] = useState(false);

  // Toast feedback visual
  const [toast, setToast] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null);

  // Modal para Carga Masiva (herramienta administrativa avanzada)
  const [modalCargaMasivaOpen, setModalCargaMasivaOpen] = useState(false);

  const mostrarToast = (tipo: 'exito' | 'error', mensaje: string) => {
    setToast({ tipo, mensaje });
    setTimeout(() => {
      setToast((curr) => (curr?.mensaje === mensaje ? null : curr));
    }, 4500);
  };

  // Filtrado de usuarios según buscador, rol y estado
  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    return usuarios.filter((u) => {
      // 1. Buscador por nombre o correo electrónico (o cargo / servicio)
      const matchBusqueda =
        q === '' ||
        u.nombre.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.cargo && u.cargo.toLowerCase().includes(q)) ||
        (u.servicio_clinico_asignado && u.servicio_clinico_asignado.toLowerCase().includes(q));

      // 2. Filtro desplegable por Rol
      let matchRol = true;
      if (filtroRol !== 'Todos') {
        if (filtroRol.startsWith('Administrador')) {
          matchRol = u.rol.includes('Administrador');
        } else if (filtroRol.startsWith('Auditor')) {
          matchRol = u.rol.includes('Auditor');
        } else {
          matchRol = u.rol === filtroRol;
        }
      }

      // 3. Filtro por estado: Todos, Activos, Inactivos
      let matchEstado = true;
      if (filtroEstado === 'Activos') {
        matchEstado = u.activo !== false;
      } else if (filtroEstado === 'Inactivos') {
        matchEstado = u.activo === false;
      }

      return matchBusqueda && matchRol && matchEstado;
    });
  }, [usuarios, busqueda, filtroRol, filtroEstado]);

  // 1. Acceso y Restricción de Ruta: Solo accesible cuando rolActivo === 'Administrador'
  if (!esAdmin) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center shadow-xs my-8 animate-in fade-in duration-200">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 ring-8 ring-amber-50 mb-4">
          <Lock className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-amber-950">Acceso Restringido a Gestión de Usuarios</h2>
        <p className="mt-2 text-sm text-amber-900 max-w-lg mx-auto">
          Esta vista está restringida exclusivamente a usuarios con rol de{' '}
          <strong className="font-semibold text-amber-950">Administrador (Jefe de Unidad)</strong>. Tu perfil activo actual es:{' '}
          <span className="font-bold underline decoration-amber-500">{usuarioActivo?.rol || 'Sin Rol'}</span>.
        </p>

        {esAdminReal && (
          <div className="mt-6">
            <button
              type="button"
              onClick={detenerSimulacion}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 transition active:scale-95 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Volver a Modo Administrador</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  const abrirCreacion = () => {
    setUsuarioEditando(null);
    setModalOpen(true);
  };

  const abrirEdicion = (u: PerfilUsuario) => {
    setUsuarioEditando(u);
    setModalOpen(true);
  };

  // Toggle de activación / desactivación con confirmación modal previa
  const handleToggleEstado = (u: PerfilUsuario) => {
    const esMismoUsuario =
      u.id === usuarioActivo?.id || u.id === usuarioAutenticado?.id;

    if (esMismoUsuario) {
      mostrarToast('error', 'No puedes desactivar tu propia cuenta en uso activo.');
      return;
    }

    if (u.activo) {
      // Si está activo, abrir modal de confirmación antes de desactivar
      setUsuarioADesactivar(u);
    } else {
      // Si está inactivo, reactivar directamente
      confirmarCambioEstado(u, true);
    }
  };

  const confirmarCambioEstado = async (u: PerfilUsuario, nuevoEstado: boolean) => {
    setProcesandoEstado(true);
    try {
      const res = await actualizarUsuario({
        ...u,
        activo: nuevoEstado,
      });

      if (res.ok) {
        mostrarToast(
          'exito',
          `La cuenta de ${u.nombre} ahora está ${nuevoEstado ? 'Activa' : 'Inactiva'}.`
        );
        setUsuarioADesactivar(null);
      } else {
        mostrarToast('error', res.error || 'No fue posible actualizar el estado del usuario.');
      }
    } catch (err: unknown) {
      mostrarToast('error', err instanceof Error ? err.message : String(err));
    } finally {
      setProcesandoEstado(false);
    }
  };

  const getRoleBadge = (rol: RolUsuario) => {
    if (rol.includes('Administrador')) {
      return {
        clase: 'bg-purple-100 text-purple-800 border-purple-200 ring-1 ring-purple-500/20',
        icono: <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />,
        etiqueta: 'Administrador',
      };
    }
    if (rol.includes('Supervisor')) {
      return {
        clase: 'bg-blue-100 text-blue-800 border-blue-200 ring-1 ring-blue-500/20',
        icono: <Shield className="h-3.5 w-3.5 text-blue-600" />,
        etiqueta: 'Ingeniero Supervisor',
      };
    }
    if (rol.includes('Técnico')) {
      return {
        clase: 'bg-amber-100 text-amber-800 border-amber-200 ring-1 ring-amber-500/20',
        icono: <Wrench className="h-3.5 w-3.5 text-amber-600" />,
        etiqueta: 'Ingeniero / Técnico',
      };
    }
    if (rol.includes('Clínico')) {
      return {
        clase: 'bg-emerald-100 text-emerald-800 border-emerald-200 ring-1 ring-emerald-500/20',
        icono: <Stethoscope className="h-3.5 w-3.5 text-emerald-600" />,
        etiqueta: 'Clínico / Solicitante',
      };
    }
    return {
      clase: 'bg-slate-100 text-slate-800 border-slate-200 ring-1 ring-slate-500/20',
      icono: <Eye className="h-3.5 w-3.5 text-slate-600" />,
      etiqueta: 'Auditor / Directivo',
    };
  };

  const formatearFecha = (fechaStr?: string) => {
    if (!fechaStr) return '—';
    try {
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback Visual Flotante */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl p-4 shadow-xl border backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200 max-w-md ${
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs ring-4 ring-purple-100">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Gestión de Usuarios y Perfiles
                </h2>
                <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800 ring-1 ring-inset ring-purple-500/20">
                  UEM 1.3
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Control de cuentas institucionales, asignación de roles y permisos del personal clínico y técnico
              </p>
            </div>
          </div>
        </div>

        {/* Acciones de Cabecera */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setModalCargaMasivaOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition active:scale-95"
            title="Carga masiva de catastro o registros"
          >
            <UploadCloud className="h-4 w-4 text-blue-600" />
            <span className="hidden sm:inline">Carga Masiva</span>
          </button>

          <button
            id="btn-nuevo-usuario-usuariosview"
            type="button"
            onClick={abrirCreacion}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 transition active:scale-95 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>+ Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* Resumen KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Total Usuarios</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{usuarios.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <p className="text-xs font-semibold text-emerald-700">Cuentas Activas</p>
          <p className="text-2xl font-bold text-emerald-950 mt-1">
            {usuarios.filter((u) => u.activo !== false).length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-600">Cuentas Inactivas</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {usuarios.filter((u) => u.activo === false).length}
          </p>
        </div>
        <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 shadow-xs">
          <p className="text-xs font-semibold text-purple-700">Administradores</p>
          <p className="text-2xl font-bold text-purple-950 mt-1">
            {usuarios.filter((u) => u.rol.includes('Administrador')).length}
          </p>
        </div>
      </div>

      {/* 2. Barra Superior: Buscador + Filtros por Rol y por Estado + Botón Nuevo Usuario */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/60">
          {/* Buscador por nombre o correo electrónico */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="input-busqueda-usuarios"
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o correo electrónico..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-9 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filtros Desplegables */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filtro por Rol */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Rol:</span>
              <select
                id="select-filtro-rol-usuarios"
                value={filtroRol}
                onChange={(e) => setFiltroRol(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer"
              >
                {FILTROS_ROLES.map((r) => (
                  <option key={r.valor} value={r.valor}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Estado (Todos, Activos, Inactivos) */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Estado:</span>
              <select
                id="select-filtro-estado-usuarios"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as 'Todos' | 'Activos' | 'Inactivos')}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer"
              >
                <option value="Todos">Todos</option>
                <option value="Activos">Activos</option>
                <option value="Inactivos">Inactivos</option>
              </select>
            </div>

            {/* Contador de resultados */}
            <span className="text-xs font-bold text-slate-600 bg-slate-100 rounded-lg px-2.5 py-1.5 border border-slate-200">
              {usuariosFiltrados.length} {usuariosFiltrados.length === 1 ? 'usuario' : 'usuarios'}
            </span>
          </div>
        </div>

        {/* Tabla de Usuarios:
            Columnas:
            1. Nombre / Identificación
            2. Correo Electrónico
            3. Rol Institucional (badge temático)
            4. Estado (Activo en verde / Inactivo en gris/rojo)
            5. Fecha de Registro
            6. Acciones (Editar + Botón/Switch Activar/Desactivar) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="px-5 py-3.5">Nombre / Identificación</th>
                <th className="px-5 py-3.5">Correo Electrónico</th>
                <th className="px-5 py-3.5">Rol Institucional</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5">Fecha de Registro</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-3">
                      <Users className="h-6 w-6" />
                    </div>
                    <p className="font-bold text-sm text-slate-700">No se encontraron usuarios coincidentes</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Intenta modificar los términos de búsqueda o los filtros de rol y estado.
                    </p>
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((u) => {
                  const roleConfig = getRoleBadge(u.rol);
                  const esUsuarioActual = u.id === usuarioActivo?.id;
                  const esActivo = u.activo !== false;

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !esActivo ? 'bg-slate-50/40 text-slate-400' : ''
                      }`}
                    >
                      {/* 1. Nombre / Identificación */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold text-xs ring-1 ${
                              esActivo
                                ? 'bg-purple-50 text-purple-800 ring-purple-200'
                                : 'bg-slate-100 text-slate-500 ring-slate-200'
                            }`}
                          >
                            {u.nombre
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold text-sm ${
                                  esActivo ? 'text-slate-900' : 'text-slate-500 line-through decoration-slate-400'
                                }`}
                              >
                                {u.nombre}
                              </span>
                              {esUsuarioActual && (
                                <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-700">
                                  Tú
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {u.cargo && (
                                <span className="text-[11px] text-slate-500">{u.cargo}</span>
                              )}
                              {u.servicio_clinico_asignado && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                                  <Building2 className="h-3 w-3" />
                                  <span>{u.servicio_clinico_asignado}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Correo Electrónico */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs text-slate-700 block select-all">
                          {u.email}
                        </span>
                      </td>

                      {/* 3. Rol Institucional (Badge con color temático) */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border ${roleConfig.clase}`}
                        >
                          {roleConfig.icono}
                          <span>{roleConfig.etiqueta}</span>
                        </span>
                      </td>

                      {/* 4. Estado (Activo en verde / Inactivo en gris/rojo) */}
                      <td className="px-5 py-3.5">
                        {esActivo ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200 ring-1 ring-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200 ring-1 ring-rose-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Inactivo
                          </span>
                        )}
                      </td>

                      {/* 5. Fecha de Registro */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>{formatearFecha(u.created_at)}</span>
                        </div>
                      </td>

                      {/* 6. Acciones:
                          - Botón para Editar (abre modal de edición de datos y rol)
                          - Botón/Switch para Activar / Desactivar cuenta */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Botón Simular (para pruebas del Administrador) */}
                          <button
                            type="button"
                            onClick={() => {
                              cambiarUsuarioActivo(u.id);
                              mostrarToast('exito', `Has iniciado sesión como ${u.nombre} (${u.rol}).`);
                            }}
                            title={`Simular sesión como ${u.nombre}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition"
                          >
                            <Sparkles className="h-3 w-3 text-blue-600" />
                            <span className="hidden lg:inline">Simular</span>
                          </button>

                          {/* Botón para Editar datos y rol */}
                          <button
                            id={`btn-editar-usuario-${u.id}`}
                            type="button"
                            onClick={() => abrirEdicion(u)}
                            title="Editar datos, rol y credenciales"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition cursor-pointer active:scale-95"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-purple-600" />
                            <span>Editar</span>
                          </button>

                          {/* Botón/Switch para Activar / Desactivar cuenta */}
                          <button
                            id={`btn-toggle-estado-${u.id}`}
                            type="button"
                            onClick={() => handleToggleEstado(u)}
                            disabled={esUsuarioActual}
                            title={
                              esUsuarioActual
                                ? 'No puedes desactivar tu propia cuenta'
                                : esActivo
                                ? 'Desactivar cuenta de usuario'
                                : 'Activar cuenta de usuario'
                            }
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                              esActivo
                                ? 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:border-rose-300'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300'
                            }`}
                          >
                            <Power className={`h-3.5 w-3.5 ${esActivo ? 'text-rose-600' : 'text-emerald-600'}`} />
                            <span>{esActivo ? 'Desactivar' : 'Activar'}</span>
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
      </div>

      {/* Modal de Creación / Edición de Usuario (UsuarioModal.tsx) */}
      <UsuarioModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        usuario={usuarioEditando}
        onSuccess={(msg) => {
          mostrarToast('exito', msg);
          refetchUsuarios();
        }}
      />

      {/* Modal de Confirmación antes de Desactivar Cuenta */}
      {usuarioADesactivar && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-700 ring-4 ring-rose-50">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  ¿Confirmas la desactivación de cuenta?
                </h3>
                <p className="text-xs text-slate-500">
                  Esta acción bloqueará de inmediato el acceso al sistema
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3.5 text-xs text-rose-900 space-y-2">
              <p>
                Estás a punto de desactivar la cuenta del usuario:
              </p>
              <div className="rounded-lg bg-white p-2.5 border border-rose-200 font-semibold text-slate-900">
                <p className="font-bold">{usuarioADesactivar.nombre}</p>
                <p className="font-mono text-[11px] text-slate-500 mt-0.5">{usuarioADesactivar.email}</p>
                <p className="text-[11px] text-purple-700 mt-0.5">Rol: {usuarioADesactivar.rol}</p>
              </div>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                El usuario no podrá iniciar sesión en la plataforma UEM 1.3 mientras la cuenta se mantenga inactiva. Podrás reactivarla en cualquier momento desde esta misma vista.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUsuarioADesactivar(null)}
                disabled={procesandoEstado}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                id="btn-confirmar-desactivar-usuario"
                type="button"
                onClick={() => confirmarCambioEstado(usuarioADesactivar, false)}
                disabled={procesandoEstado}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {procesandoEstado ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Desactivando...</span>
                  </>
                ) : (
                  <>
                    <Power className="h-4 w-4" />
                    <span>Desactivar Cuenta</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Carga Masiva (Catastro de Equipos y Órdenes de Trabajo) */}
      {modalCargaMasivaOpen && (
        <ModalCargaMasiva
          open={modalCargaMasivaOpen}
          onClose={() => setModalCargaMasivaOpen(false)}
          onSuccess={(mensaje) => {
            mostrarToast('exito', mensaje);
            setModalCargaMasivaOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Subcomponente de Carga Masiva CSV/JSON
function ModalCargaMasiva({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [tipoCarga, setTipoCarga] = useState<'equipos' | 'mantenimientos'>('equipos');
  const [contenidoTexto, setContenidoTexto] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  if (!open) return null;

  const plantillaEquipos = `codigo,nombre,marca,modelo,serie,ubicacion,estado
EQ-101,Bomba de Infusión Volumétrica,B. Braun,Infusomat Space,SN-BB-9901,UCI - Sala 3,Operativo
EQ-102,Desfibrilador Bifásico,Zoll,R Series,SN-ZL-4420,Urgencias / Reanimación,Operativo
EQ-103,Electrocardiógrafo 12 Canales,Mortara,ELI 280,SN-MT-3100,Laboratorio Central,Operativo`;

  const plantillaMantenimientos = `equipo_identificacion,problema_reportado,solicitado_por,asignado_a,fecha_requerimiento,tipo_mantenimiento,estado_mantenimiento
EQ-101 — Bomba de Infusión,Error de oclusión de vía distal durante perfusión,Enf. Marcela Fuentes,Téc. Fernando Ruiz,2026-03-01,Correctivo,Pendiente de Asignación
EQ-102 — Desfibrilador,Mantenimiento preventivo semestral y calibración de palas,Dra. Andrea Morales,Téc. Fernando Ruiz,2026-03-02,Preventivo,En proceso`;

  const handleCargarPlantilla = () => {
    setContenidoTexto(tipoCarga === 'equipos' ? plantillaEquipos : plantillaMantenimientos);
    setErrorCarga(null);
  };

  const handleProcesar = async () => {
    setErrorCarga(null);
    if (!contenidoTexto.trim()) {
      setErrorCarga('Por favor pega los datos en formato CSV o JSON.');
      return;
    }

    setProcesando(true);
    try {
      let filas: Record<string, unknown>[] = [];
      const trimmed = contenidoTexto.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        filas = JSON.parse(trimmed);
      } else {
        const lineas = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lineas.length < 2) {
          throw new Error('El archivo CSV debe contener al menos la cabecera y una fila de datos.');
        }
        const headers = lineas[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
        filas = lineas.slice(1).map((linea) => {
          const valores = linea.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
          const row: Record<string, unknown> = {};
          headers.forEach((h, idx) => {
            row[h] = valores[idx] || null;
          });
          return row;
        });
      }

      if (filas.length === 0) {
        throw new Error('No se encontraron registros válidos para importar.');
      }

      const tabla = tipoCarga === 'equipos' ? 'equipos' : 'mantenimientos';
      const { error } = await supabase.from(tabla).insert(filas);
      if (error) {
        throw new Error(error.message);
      }

      onSuccess(`Se importaron ${filas.length} registros en "${tabla}" con éxito.`);
      onClose();
    } catch (err: unknown) {
      setErrorCarga(err instanceof Error ? err.message : String(err));
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <UploadCloud className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">
              Carga Masiva (Catastro de Equipos y OTs)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorCarga && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
            <span>{errorCarga}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700">Módulo de Destino:</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTipoCarga('equipos');
                setContenidoTexto('');
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
                tipoCarga === 'equipos'
                  ? 'bg-blue-50 border-blue-300 text-blue-800'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              Catastro de Equipos
            </button>
            <button
              type="button"
              onClick={() => {
                setTipoCarga('mantenimientos');
                setContenidoTexto('');
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
                tipoCarga === 'mantenimientos'
                  ? 'bg-blue-50 border-blue-300 text-blue-800'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              Mantenimientos / OTs
            </button>
          </div>
          <button
            type="button"
            onClick={handleCargarPlantilla}
            className="ml-auto text-xs font-bold text-purple-700 hover:text-purple-900"
          >
            Cargar Plantilla Ejemplo
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Datos en formato CSV o JSON:
          </label>
          <textarea
            rows={8}
            value={contenidoTexto}
            onChange={(e) => setContenidoTexto(e.target.value)}
            placeholder="Pega aquí los datos delimitados por comas o array JSON..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50/50 p-3 font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleProcesar}
            disabled={procesando}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {procesando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Importando...</span>
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                <span>Procesar e Importar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
