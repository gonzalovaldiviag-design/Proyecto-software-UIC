import React, { useState, useMemo } from 'react';
import {
  UserPlus,
  KeyRound,
  X,
  Trash2,
  Search,
  RotateCcw,
  Building2,
  AlertTriangle,
  UploadCloud,
  CheckCircle2,
  Sliders,
  LogIn,
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import {
  type PerfilUsuario,
  type PermisosUsuario,
  type RolUsuario,
  PERMISOS_DEFAULT_POR_ROL,
  supabase,
} from '@/lib/supabase';

const ROLES_DISPONIBLES: RolUsuario[] = [
  'Administrador (Jefe de Unidad)',
  'Ingeniero Supervisor',
  'Ingeniero de Servicio / Técnico',
  'Clínico / Solicitante',
  'Auditor / Directivo',
];

const SERVICIOS_CLINICOS = [
  'UCI - Sala 3',
  'UCI Pediátrica',
  'Pabellón Central - Quirófano 1',
  'Pabellón Central - Quirófano 2',
  'Urgencias / Reanimación',
  'Imagenología / TAC',
  'Laboratorio Central',
  'Maternidad',
  'Neonatología',
  'Hemodiálisis',
  'Endoscopía',
];

const GRUPOS_PERMISOS: {
  titulo: string;
  descripcion: string;
  permisos: { clave: keyof PermisosUsuario; etiqueta: string; detalle: string }[];
}[] = [
  {
    titulo: 'Catastro de Equipamiento Médico',
    descripcion: 'Control de inventario técnico y trazabilidad hospitalaria',
    permisos: [
      {
        clave: 'ver_equipos',
        etiqueta: 'Visualizar Catastro de Equipos',
        detalle: 'Permite consultar el inventario técnico general o del servicio asignado.',
      },
      {
        clave: 'crear_equipos',
        etiqueta: 'Agregar Nuevos Equipos',
        detalle: 'Permite dar de alta equipos médicos en el sistema.',
      },
      {
        clave: 'editar_equipos',
        etiqueta: 'Modificar Datos de Equipos',
        detalle: 'Permite actualizar ficha técnica, modelo, serie y ubicación.',
      },
      {
        clave: 'eliminar_baja_equipos',
        etiqueta: 'Baja Definitiva de Equipamiento',
        detalle: 'Autorización para retirar y eliminar definitivamente equipos del catastro.',
      },
      {
        clave: 'exportar_equipos',
        etiqueta: 'Exportar Catastro a CSV',
        detalle: 'Permite descargar el inventario en formato CSV/Excel.',
      },
    ],
  },
  {
    titulo: 'Mantenimiento y Órdenes de Trabajo (OT)',
    descripcion: 'Operaciones técnicas, informes y ciclo de vida de mantenimiento',
    permisos: [
      {
        clave: 'ver_mantenimientos',
        etiqueta: 'Visualizar Módulo de Mantenimientos',
        detalle: 'Acceso a la vista de requerimientos y órdenes de trabajo.',
      },
      {
        clave: 'crear_solicitud_ot',
        etiqueta: 'Ingresar Solicitud / Reportar Falla',
        detalle: 'Permite a clínicos y supervisores reportar averías técnicas.',
      },
      {
        clave: 'asignar_tecnico_ot',
        etiqueta: 'Asignar Técnicos a OTs',
        detalle: 'Facultad para delegar y planificar técnicos responsables.',
      },
      {
        clave: 'cerrar_emitir_informe_ot',
        etiqueta: 'Cerrar OT y Emitir Informe Técnico',
        detalle: 'Generar diagnóstico final, registrar costos y emitir el informe oficial.',
      },
      {
        clave: 'reabrir_anular_ot',
        etiqueta: 'Reabrir OTs y Anular Informes',
        detalle: 'Potestad de reapertura técnica reservada para la Jefatura de Unidad.',
      },
      {
        clave: 'eliminar_ot',
        etiqueta: 'Eliminar Registros de OT',
        detalle: 'Eliminación permanente de órdenes de trabajo.',
      },
      {
        clave: 'exportar_mantenimientos',
        etiqueta: 'Exportar e Imprimir Informes Técnicos',
        detalle: 'Descargar listados y generar documentos PDF oficiales.',
      },
    ],
  },
  {
    titulo: 'Compras y Externalización',
    descripcion: 'Gestión de servicios externos y adquisición de repuestos',
    permisos: [
      {
        clave: 'ver_externalizacion',
        etiqueta: 'Acceso al Módulo de Externalización',
        detalle: 'Visualizar órdenes de compra y trazabilidad de etapas.',
      },
      {
        clave: 'gestionar_etapas_compras',
        etiqueta: 'Avanzar y Gestionar Etapas de Compras',
        detalle: 'Gestionar Línea A (repuestos) y Línea B (servicios técnicos).',
      },
      {
        clave: 'crear_solicitud_compra',
        etiqueta: 'Crear Requerimientos de Compra',
        detalle: 'Iniciar procesos de cotización y adquisición.',
      },
      {
        clave: 'exportar_compras',
        etiqueta: 'Exportar Compras a CSV',
        detalle: 'Descargar datos de externalización con detalle de equipos asociados.',
      },
    ],
  },
  {
    titulo: 'Administración y Seguridad del Sistema',
    descripcion: 'Control de usuarios, perfiles y permisos institucionales',
    permisos: [
      {
        clave: 'gestionar_usuarios',
        etiqueta: 'Administrar Usuarios y Permisos RBAC',
        detalle: 'Potestad exclusiva para crear usuarios, asignar roles y modificar permisos.',
      },
    ],
  },
];

export default function UsuariosView() {
  const {
    usuarioActivo,
    usuarios,
    actualizarUsuario,
    crearUsuario,
    eliminarUsuario,
    cambiarUsuarioActivo,
  } = useAuth();

  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState<string>('Todos');
  const [modalUsuarioOpen, setModalUsuarioOpen] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<PerfilUsuario | null>(null);
  const [modalCargaMasivaOpen, setModalCargaMasivaOpen] = useState(false);
  const [mensajeAlerta, setMensajeAlerta] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  // Form state
  const [formNombre, setFormNombre] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRol, setFormRol] = useState<RolUsuario>('Ingeniero de Servicio / Técnico');
  const [formCargo, setFormCargo] = useState('');
  const [formServicio, setFormServicio] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formActivo, setFormActivo] = useState(true);
  const [formPermisos, setFormPermisos] = useState<PermisosUsuario>(
    PERMISOS_DEFAULT_POR_ROL['Ingeniero de Servicio / Técnico']
  );
  const [mostrarPassword, setMostrarPassword] = useState(false);

  // Filtrado de usuarios en tabla
  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return usuarios.filter((u) => {
      const matchBusqueda =
        q === '' ||
        u.nombre.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.cargo.toLowerCase().includes(q) ||
        (u.servicio_clinico_asignado && u.servicio_clinico_asignado.toLowerCase().includes(q));
      const matchRol = filtroRol === 'Todos' || u.rol === filtroRol;
      return matchBusqueda && matchRol;
    });
  }, [usuarios, busqueda, filtroRol]);

  const abrirCrear = () => {
    setUsuarioEditando(null);
    setFormNombre('');
    setFormEmail('');
    setFormRol('Ingeniero de Servicio / Técnico');
    setFormCargo('');
    setFormServicio('');
    setFormPassword('pass*uem2026');
    setFormActivo(true);
    setFormPermisos({ ...PERMISOS_DEFAULT_POR_ROL['Ingeniero de Servicio / Técnico'] });
    setMostrarPassword(false);
    setModalUsuarioOpen(true);
  };

  const abrirEditar = (u: PerfilUsuario) => {
    setUsuarioEditando(u);
    setFormNombre(u.nombre);
    setFormEmail(u.email);
    setFormRol(u.rol);
    setFormCargo(u.cargo);
    setFormServicio(u.servicio_clinico_asignado || '');
    setFormPassword(u.password || '');
    setFormActivo(u.activo);
    setFormPermisos({ ...u.permisos });
    setMostrarPassword(false);
    setModalUsuarioOpen(true);
  };

  const handleCambiarRol = (nuevoRol: RolUsuario) => {
    setFormRol(nuevoRol);
    // Preguntar si desea restablecer permisos a los predeterminados de este rol
    setFormPermisos({ ...PERMISOS_DEFAULT_POR_ROL[nuevoRol] });
    if (nuevoRol === 'Clínico / Solicitante' && !formServicio) {
      setFormServicio('UCI - Sala 3');
    }
  };

  const handleTogglePermiso = (clave: keyof PermisosUsuario) => {
    setFormPermisos((prev) => ({
      ...prev,
      [clave]: !prev[clave],
    }));
  };

  const handleSeleccionarTodosPermisos = (valor: boolean) => {
    const nuevos = { ...formPermisos };
    (Object.keys(nuevos) as (keyof PermisosUsuario)[]).forEach((k) => {
      nuevos[k] = valor;
    });
    setFormPermisos(nuevos);
  };

  const handleRestablecerPermisosRol = () => {
    setFormPermisos({ ...PERMISOS_DEFAULT_POR_ROL[formRol] });
    setMensajeAlerta({
      tipo: 'exito',
      texto: `Permisos restablecidos a los valores predeterminados de "${formRol}".`,
    });
    setTimeout(() => setMensajeAlerta(null), 3000);
  };

  const handleGuardarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim() || !formEmail.trim()) {
      setMensajeAlerta({ tipo: 'error', texto: 'El nombre y correo electrónico son obligatorios.' });
      return;
    }

    if (usuarioEditando) {
      const payload: PerfilUsuario = {
        ...usuarioEditando,
        nombre: formNombre.trim(),
        email: formEmail.trim(),
        rol: formRol,
        cargo: formCargo.trim(),
        servicio_clinico_asignado: formRol === 'Clínico / Solicitante' ? formServicio : null,
        password: formPassword,
        activo: formActivo,
        permisos: formPermisos,
      };
      const res = await actualizarUsuario(payload);
      if (res.ok) {
        setMensajeAlerta({ tipo: 'exito', texto: `Usuario "${formNombre}" actualizado con éxito.` });
        setModalUsuarioOpen(false);
      } else {
        setMensajeAlerta({ tipo: 'error', texto: res.error || 'Error al actualizar usuario' });
      }
    } else {
      const payload: Omit<PerfilUsuario, 'id' | 'created_at'> = {
        nombre: formNombre.trim(),
        email: formEmail.trim(),
        rol: formRol,
        cargo: formCargo.trim(),
        servicio_clinico_asignado: formRol === 'Clínico / Solicitante' ? formServicio : null,
        password: formPassword,
        activo: formActivo,
        permisos: formPermisos,
      };
      const res = await crearUsuario(payload);
      if (res.ok) {
        setMensajeAlerta({ tipo: 'exito', texto: `Usuario "${formNombre}" creado con éxito.` });
        setModalUsuarioOpen(false);
      } else {
        setMensajeAlerta({ tipo: 'error', texto: res.error || 'Error al crear usuario' });
      }
    }
    setTimeout(() => setMensajeAlerta(null), 4000);
  };

  const handleEliminar = async (u: PerfilUsuario) => {
    if (u.id === usuarioActivo.id) {
      alert('No puedes eliminar el usuario que estás utilizando actualmente.');
      return;
    }
    if (
      !confirm(
        `¿Confirmas la eliminación del usuario "${u.nombre}" (${u.rol})?\n\nEsta acción revocará todo acceso al sistema.`
      )
    ) {
      return;
    }
    const res = await eliminarUsuario(u.id);
    if (res.ok) {
      setMensajeAlerta({ tipo: 'exito', texto: `Usuario "${u.nombre}" eliminado del sistema.` });
    } else {
      setMensajeAlerta({ tipo: 'error', texto: res.error || 'Error al eliminar usuario' });
    }
    setTimeout(() => setMensajeAlerta(null), 4000);
  };

  const contarPermisosActivos = (permisos: PermisosUsuario) => {
    return Object.values(permisos).filter(Boolean).length;
  };

  return (
    <div className="space-y-6">
      {/* Alerta de acción */}
      {mensajeAlerta && (
        <div
          className={`flex items-center gap-3 rounded-xl p-4 text-sm font-medium border shadow-xs animate-in fade-in duration-200 ${
            mensajeAlerta.tipo === 'exito'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {mensajeAlerta.tipo === 'exito' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          )}
          <span className="flex-1">{mensajeAlerta.texto}</span>
          <button
            onClick={() => setMensajeAlerta(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Header institucional de sección */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Gestión Institucional de Usuarios & Roles (RBAC)
            </h2>
            <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800 ring-1 ring-inset ring-purple-500/20">
              Jefatura UEM
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Administración centralizada de cuentas, contraseñas y permisos granulares con checkboxes por módulo
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botón de Carga Masiva (Catastro y OTs) para el Administrador */}
          <button
            type="button"
            onClick={() => setModalCargaMasivaOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition active:scale-[0.98]"
          >
            <UploadCloud className="h-4 w-4 text-blue-600" />
            <span>Carga Masiva (Catastro / OTs)</span>
          </button>

          <button
            type="button"
            onClick={abrirCrear}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 transition active:scale-[0.98]"
          >
            <UserPlus className="h-4 w-4" />
            <span>Crear Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* Resumen KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Usuarios Registrados</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{usuarios.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <p className="text-xs font-semibold text-emerald-700">Usuarios Activos</p>
          <p className="text-2xl font-bold text-emerald-950 mt-1">
            {usuarios.filter((u) => u.activo).length}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs">
          <p className="text-xs font-semibold text-blue-700">Roles Configurados</p>
          <p className="text-2xl font-bold text-blue-950 mt-1">{ROLES_DISPONIBLES.length}</p>
        </div>
        <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 shadow-xs">
          <p className="text-xs font-semibold text-purple-700">Jefes con Acceso Total</p>
          <p className="text-2xl font-bold text-purple-950 mt-1">
            {usuarios.filter((u) => u.rol === 'Administrador (Jefe de Unidad)').length}
          </p>
        </div>
      </div>

      {/* Filtros y Buscador */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar usuario por nombre, correo, cargo o servicio..."
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 whitespace-nowrap">Filtrar por Rol:</span>
            <select
              value={filtroRol}
              onChange={(e) => setFiltroRol(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="Todos">Todos los roles</option>
              {ROLES_DISPONIBLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabla de Usuarios */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-4 py-3">Usuario Institucional</th>
                <th className="px-4 py-3">Rol UEM</th>
                <th className="px-4 py-3">Cargo / Servicio</th>
                <th className="px-4 py-3">Permisos</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuariosFiltrados.map((u) => {
                const totalPermisos = 16;
                const activos = contarPermisosActivos(u.permisos);
                const esUsuarioActual = u.id === usuarioActivo.id;

                let roleBadgeClass = 'bg-slate-100 text-slate-800 border-slate-200';
                if (u.rol === 'Administrador (Jefe de Unidad)') {
                  roleBadgeClass = 'bg-purple-100 text-purple-800 border-purple-200';
                } else if (u.rol === 'Ingeniero Supervisor') {
                  roleBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
                } else if (u.rol === 'Ingeniero de Servicio / Técnico') {
                  roleBadgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
                } else if (u.rol === 'Clínico / Solicitante') {
                  roleBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                }

                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold text-xs ring-1 ring-slate-200">
                          {u.nombre
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-sm">{u.nombre}</span>
                            {esUsuarioActual && (
                              <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-700">
                                Tú
                              </span>
                            )}
                          </div>
                          <span className="text-slate-500 font-mono text-[11px] block">{u.email}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold border ${roleBadgeClass}`}>
                        {u.rol}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-slate-700 font-medium">{u.cargo || '—'}</div>
                      {u.servicio_clinico_asignado && (
                        <div className="flex items-center gap-1 text-[11px] text-emerald-700 mt-0.5">
                          <Building2 className="h-3 w-3" />
                          <span>{u.servicio_clinico_asignado}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-purple-600 h-1.5 rounded-full"
                            style={{ width: `${(activos / totalPermisos) * 100}%` }}
                          />
                        </div>
                        <span className="font-mono text-slate-600 text-[11px] font-semibold">
                          {activos} / {totalPermisos}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      {u.activo ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 border border-slate-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Inactivo
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => cambiarUsuarioActivo(u.id)}
                          title={`Simular sesión como ${u.nombre}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-blue-700 transition"
                        >
                          <LogIn className="h-3.5 w-3.5 text-blue-600" />
                          <span className="hidden md:inline">Simular</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => abrirEditar(u)}
                          title="Modificar usuario, contraseña y permisos"
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition"
                        >
                          <Sliders className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEliminar(u)}
                          disabled={esUsuarioActual}
                          title={esUsuarioActual ? 'No puedes eliminar tu propio usuario' : 'Eliminar usuario'}
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Creación / Edición de Usuario con Matriz de Permisos */}
      {modalUsuarioOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Header modal */}
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {usuarioEditando ? `Editar Usuario: ${usuarioEditando.nombre}` : 'Crear Nuevo Usuario Institucional'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configuración de perfil, credenciales de acceso y permisos granulares individuales
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalUsuarioOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarUsuario} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Sección 1: Datos Generales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre Completo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                    placeholder="Ej. Ing. Carlos Mendoza"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Correo Electrónico Institucional <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="usuario@hospital.cl"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rol Institucional (Plantilla Base) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formRol}
                    onChange={(e) => handleCambiarRol(e.target.value as RolUsuario)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  >
                    {ROLES_DISPONIBLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Al cambiar el rol, los checkboxes de permisos se ajustan automáticamente a la plantilla predeterminada.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cargo o Función Hospitalaria
                  </label>
                  <input
                    type="text"
                    value={formCargo}
                    onChange={(e) => setFormCargo(e.target.value)}
                    placeholder="Ej. Técnico Especialista Biomédico"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                </div>

                {/* Servicio Clínico Asignado (relevante especialmente para Clínico / Solicitante) */}
                <div className={formRol === 'Clínico / Solicitante' ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Servicio Clínico Asignado
                    {formRol === 'Clínico / Solicitante' && (
                      <span className="text-emerald-600 font-semibold ml-1.5">
                        (Obligatorio para el filtro automático de catastro y OTs)
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formServicio}
                      onChange={(e) => setFormServicio(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    >
                      <option value="">Sin servicio asignado (Acceso global)</option>
                      {SERVICIOS_CLINICOS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Sección 2: Contraseña y Estado */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Contraseña de Acceso Institucional
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={mostrarPassword ? 'text' : 'password'}
                          value={formPassword}
                          onChange={(e) => setFormPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="w-full rounded-lg border border-slate-300 bg-white pl-3.5 pr-10 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        />
                        <button
                          type="button"
                          onClick={() => setMostrarPassword(!mostrarPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[11px]"
                        >
                          {mostrarPassword ? 'Ocultar' : 'Ver'}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const rnd = Math.random().toString(36).slice(-6);
                          setFormPassword(`pass*${rnd}`);
                          setMostrarPassword(true);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Generar
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-4 sm:pt-0">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formActivo}
                        onChange={(e) => setFormActivo(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span>Usuario Activo en el Sistema</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Sección 3: Matriz de Permisos Granulares con Checkboxes */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Matriz de Permisos Granulares Individuales
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Activa o desactiva facultades específicas para personalizar este usuario más allá del rol base.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRestablecerPermisosRol}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-md transition"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Restablecer a {formRol}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSeleccionarTodosPermisos(true)}
                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 px-2 py-1 rounded-md hover:bg-slate-100"
                    >
                      Marcar todos
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSeleccionarTodosPermisos(false)}
                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 px-2 py-1 rounded-md hover:bg-slate-100"
                    >
                      Desmarcar todos
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {GRUPOS_PERMISOS.map((grupo) => (
                    <div
                      key={grupo.titulo}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">{grupo.titulo}</span>
                          <span className="text-[10px] text-slate-500">{grupo.descripcion}</span>
                        </div>
                        <span className="text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {grupo.permisos.filter((p) => formPermisos[p.clave]).length} / {grupo.permisos.length}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {grupo.permisos.map((p) => {
                          const activo = formPermisos[p.clave];
                          return (
                            <label
                              key={p.clave}
                              className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-all ${
                                activo
                                  ? 'border-purple-200 bg-purple-50/50 text-purple-950'
                                  : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100/60'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={activo}
                                onChange={() => handleTogglePermiso(p.clave)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                              />
                              <div className="min-w-0">
                                <span className="text-xs font-semibold block leading-tight">
                                  {p.etiqueta}
                                </span>
                                <span className="text-[10px] text-slate-500 leading-snug mt-0.5 block">
                                  {p.detalle}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer modal */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalUsuarioOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 active:scale-[0.98] transition"
                >
                  {usuarioEditando ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Carga Masiva (Catastro de Equipos y Órdenes de Trabajo) */}
      {modalCargaMasivaOpen && (
        <ModalCargaMasiva
          open={modalCargaMasivaOpen}
          onClose={() => setModalCargaMasivaOpen(false)}
          onSuccess={(mensaje) => {
            setMensajeAlerta({ tipo: 'exito', texto: mensaje });
            setModalCargaMasivaOpen(false);
            setTimeout(() => setMensajeAlerta(null), 5000);
          }}
        />
      )}
    </div>
  );
}

// Subcomponente de Carga Masiva (Catastro de Equipos y Órdenes de Trabajo)
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
      // Intenta primero como JSON
      let filas: Record<string, unknown>[] = [];
      const trimmed = contenidoTexto.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        filas = JSON.parse(trimmed);
      } else {
        // Procesar como CSV
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

      // Guardar en Supabase
      const tabla = tipoCarga === 'equipos' ? 'equipos' : 'mantenimientos';
      const { error } = await supabase.from(tabla).insert(filas);
      if (error) throw error;

      onSuccess(`¡Carga masiva completada exitosamente! Se importaron ${filas.length} registros en "${tabla}".`);
    } catch (err) {
      setErrorCarga(err instanceof Error ? err.message : String(err));
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Carga Masiva Institucional (Catastro / OTs)
              </h3>
              <p className="text-xs text-slate-500">
                Potestad exclusiva del Administrador (Jefe de Unidad) para importación de datos en lote
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {errorCarga && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span className="flex-1">{errorCarga}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700">Módulo a Cargar:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTipoCarga('equipos');
                  setContenidoTexto('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  tipoCarga === 'equipos'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  tipoCarga === 'mantenimientos'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Órdenes de Trabajo (OT)
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">
              Datos en formato CSV o JSON:
            </label>
            <button
              type="button"
              onClick={handleCargarPlantilla}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline"
            >
              Pegar plantilla de ejemplo
            </button>
          </div>

          <textarea
            rows={8}
            value={contenidoTexto}
            onChange={(e) => setContenidoTexto(e.target.value)}
            placeholder="Pega aquí los datos en formato CSV separados por comas o un array JSON..."
            className="w-full rounded-xl border border-slate-300 p-3 font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />

          <p className="text-[11px] text-slate-500">
            Los registros importados se incorporan de inmediato al almacenamiento local persistente del sistema.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50/80 border-t border-slate-200">
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
            disabled={procesando || !contenidoTexto.trim()}
            className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {procesando ? 'Procesando Carga...' : 'Procesar e Importar'}
          </button>
        </div>
      </div>
    </div>
  );
}
