import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Mail,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  Loader2,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import {
  type PerfilUsuario,
  type RolUsuario,
  PERMISOS_DEFAULT_POR_ROL,
  supabase,
} from '@/lib/supabase';

export interface UsuarioModalProps {
  open: boolean;
  onClose: () => void;
  usuario: PerfilUsuario | null;
  onSuccess: (mensaje: string) => void;
}

const ROLES_DISPONIBLES: { rol: RolUsuario; label: string; descripcion: string }[] = [
  {
    rol: 'Administrador (Jefe de Unidad)',
    label: 'Administrador (Jefe de Unidad)',
    descripcion: 'Control total de inventario, OTs, compras y administración de usuarios.',
  },
  {
    rol: 'Ingeniero Supervisor',
    label: 'Ingeniero Supervisor',
    descripcion: 'Asignación técnica de OTs, emisión/cierre de informes y avance de compras.',
  },
  {
    rol: 'Ingeniero de Servicio / Técnico',
    label: 'Ingeniero de Servicio / Técnico',
    descripcion: 'Ejecución y resolución de OTs asignadas e informes técnicos de campo.',
  },
  {
    rol: 'Clínico / Solicitante',
    label: 'Clínico / Solicitante',
    descripcion: 'Solicitud de mantenimiento y visualización restringida por servicio clínico.',
  },
  {
    rol: 'Auditor / Directivo',
    label: 'Auditor / Directivo',
    descripcion: 'Acceso en modo Solo Lectura y exportación/descarga de informes PDF.',
  },
];

const SERVICIOS_CLINICOS: string[] = [
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
  'Cardiología',
  'Esterilización',
];

export default function UsuarioModal({
  open,
  onClose,
  usuario,
  onSuccess,
}: UsuarioModalProps) {
  const { crearUsuario, actualizarUsuario } = useAuth();

  const isEdit = Boolean(usuario);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<RolUsuario>('Ingeniero de Servicio / Técnico');
  const [cargo, setCargo] = useState('');
  const [servicioClinico, setServicioClinico] = useState('');
  const [password, setPassword] = useState('');
  const [activo, setActivo] = useState(true);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setMostrarPassword(false);
      if (usuario) {
        setNombre(usuario.nombre || '');
        setEmail(usuario.email || '');
        setRol(usuario.rol || 'Ingeniero de Servicio / Técnico');
        setCargo(usuario.cargo || '');
        setServicioClinico(usuario.servicio_clinico_asignado || '');
        setPassword(usuario.password || '');
        setActivo(usuario.activo !== false);
      } else {
        setNombre('');
        setEmail('');
        setRol('Ingeniero de Servicio / Técnico');
        setCargo('');
        setServicioClinico('');
        setPassword('pass*uem2026');
        setActivo(true);
      }
    }
  }, [open, usuario]);

  if (!open) return null;

  const generarPasswordProvisoria = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
    let prov = '';
    for (let i = 0; i < 6; i++) {
      prov += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(`uem*${prov}`);
    setMostrarPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanNombre = nombre.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCargo = cargo.trim();
    const cleanPassword = password.trim();

    if (!cleanNombre) {
      setError('Por favor ingresa el nombre completo del usuario.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Por favor ingresa un correo electrónico institucional válido (ej: nombre@hospital.cl).');
      return;
    }

    if (!isEdit && !cleanPassword) {
      setError('Por favor define una contraseña provisoria para la creación de la cuenta.');
      return;
    }

    setGuardando(true);

    try {
      if (isEdit && usuario) {
        // Modo Edición: Actualizar registro en perfiles
        const payload: PerfilUsuario = {
          ...usuario,
          nombre: cleanNombre,
          email: cleanEmail,
          rol,
          cargo: cleanCargo || (rol === 'Administrador (Jefe de Unidad)' ? 'Jefe de Unidad' : rol),
          servicio_clinico_asignado: rol === 'Clínico / Solicitante' ? (servicioClinico || 'UCI - Sala 3') : (servicioClinico || null),
          password: cleanPassword || usuario.password || 'pass*uem2026',
          activo,
          permisos: {
            ...PERMISOS_DEFAULT_POR_ROL[rol],
            // Si el rol no cambió, conservamos ajustes granulares si los hubiera
            ...(rol === usuario.rol ? usuario.permisos : {}),
          },
        };

        const res = await actualizarUsuario(payload);
        if (!res.ok) {
          throw new Error(res.error || 'No fue posible actualizar el perfil en la base de datos.');
        }

        onSuccess(`Perfil del usuario "${cleanNombre}" actualizado exitosamente.`);
        onClose();
      } else {
        // Modo Creación: Invocar registro Supabase Auth o insertar perfil
        let authUserId: string | null = null;
        try {
          if (supabase.auth?.signUp) {
            const { data: authData, error: authError } = await supabase.auth.signUp({
              email: cleanEmail,
              password: cleanPassword,
              options: {
                data: {
                  nombre: cleanNombre,
                  rol,
                  cargo: cleanCargo,
                },
              },
            });
            if (!authError && authData?.user?.id) {
              authUserId = authData.user.id;
            }
          }
        } catch (authErr) {
          console.warn('[UsuarioModal] Registro auth secundario no disponible, continuando con perfil:', authErr);
        }

        const nuevoPerfil: Omit<PerfilUsuario, 'id' | 'created_at'> & { id?: string } = {
          nombre: cleanNombre,
          email: cleanEmail,
          rol,
          cargo: cleanCargo || (rol === 'Administrador (Jefe de Unidad)' ? 'Jefe de Unidad' : rol),
          servicio_clinico_asignado: rol === 'Clínico / Solicitante' ? (servicioClinico || 'UCI - Sala 3') : (servicioClinico || null),
          password: cleanPassword,
          activo,
          avatar_url: null,
          permisos: { ...PERMISOS_DEFAULT_POR_ROL[rol] },
        };

        if (authUserId) {
          nuevoPerfil.id = authUserId;
        }

        const res = await crearUsuario(nuevoPerfil as Omit<PerfilUsuario, 'id' | 'created_at'>);
        if (!res.ok) {
          throw new Error(res.error || 'No fue posible registrar el nuevo perfil en la base de datos.');
        }

        onSuccess(`Usuario "${cleanNombre}" registrado exitosamente con rol ${rol}.`);
        onClose();
      }
    } catch (err: unknown) {
      console.error('[UsuarioModal] Error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-usuario-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden my-8">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm ring-4 ring-purple-100">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 id="modal-usuario-title" className="text-base font-bold text-slate-900">
                {isEdit ? 'Editar Usuario y Perfil' : 'Registrar Nuevo Usuario'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEdit
                  ? 'Modifica los datos institucionales, rol y credenciales de acceso'
                  : 'Crea una nueva cuenta con rol asignado y credenciales provisorias'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 animate-in fade-in"
            >
              <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">No se pudo procesar la solicitud:</span>
                <span className="mt-0.5 leading-relaxed block">{error}</span>
              </div>
            </div>
          )}

          {/* Nombre Completo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nombre Completo <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="input-usuario-nombre"
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Ing. Mauricio Morales"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>

          {/* Correo Electrónico Institucional */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Correo Electrónico Institucional <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="input-usuario-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@hospital.cl"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Se utilizará para iniciar sesión en UEM 1.3 y recibir notificaciones.
            </p>
          </div>

          {/* Rol Institucional (<select> con los 5 roles) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Rol Institucional en el Sistema <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Shield className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-600" />
              <select
                id="select-usuario-rol"
                value={rol}
                onChange={(e) => {
                  const nuevoRol = e.target.value as RolUsuario;
                  setRol(nuevoRol);
                  if (nuevoRol === 'Clínico / Solicitante' && !servicioClinico) {
                    setServicioClinico('UCI - Sala 3');
                  }
                }}
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-8 text-xs font-semibold text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
              >
                {ROLES_DISPONIBLES.map((r) => (
                  <option key={r.rol} value={r.rol}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Descripción contextual del rol */}
            <div className="mt-1.5 rounded-lg bg-purple-50/70 p-2.5 text-[11px] text-purple-900 border border-purple-100 flex items-start gap-2">
              <Sparkles className="h-3.5 w-3.5 text-purple-600 flex-shrink-0 mt-0.5" />
              <span>{ROLES_DISPONIBLES.find((r) => r.rol === rol)?.descripcion}</span>
            </div>
          </div>

          {/* Cargo o Función Hospitalaria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cargo / Cargo Asistencial
              </label>
              <div className="relative">
                <Briefcase className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="input-usuario-cargo"
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ej. Técnico Biomédico"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
            </div>

            {/* Servicio Clínico Asignado (opcional o requerido si Clínico) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Servicio Clínico
                {rol === 'Clínico / Solicitante' && (
                  <span className="text-emerald-700 font-semibold ml-1">(Asignado)</span>
                )}
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select
                  id="select-usuario-servicio"
                  value={servicioClinico}
                  onChange={(e) => setServicioClinico(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                >
                  <option value="">Sin servicio específico (Acceso global)</option>
                  {SERVICIOS_CLINICOS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Credencial / Contraseña Provisoria */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">
                {isEdit ? 'Contraseña Registrada' : 'Contraseña Provisoria Inicial'}
              </label>
              <button
                type="button"
                onClick={generarPasswordProvisoria}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 transition-colors"
              >
                <Sparkles className="h-3 w-3" />
                <span>Generar provisoria</span>
              </button>
            </div>
            <div className="relative flex items-center">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="input-usuario-password"
                type={mostrarPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa o genera una contraseña"
                className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-10 text-xs font-mono text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
              <button
                type="button"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title={mostrarPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {mostrarPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              El usuario podrá autenticarse inmediatamente con este correo y clave provisoria.
            </p>
          </div>

          {/* Estado de la Cuenta (Activo / Inactivo) */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Estado de la Cuenta
              </span>
              <span className="text-[11px] text-slate-500 block">
                {activo
                  ? 'Cuenta habilitada para iniciar sesión y operar en el sistema'
                  : 'Cuenta inhabilitada. Se bloqueará el acceso al iniciar sesión'}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={activo}
              onClick={() => setActivo(!activo)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500/30 ${
                activo ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  activo ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              id="btn-guardar-usuario-modal"
              type="submit"
              disabled={guardando}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {guardando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Guardando en el sistema...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isEdit ? 'Guardar Cambios' : 'Registrar Usuario'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
