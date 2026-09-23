import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  supabase,
  type PerfilUsuario,
  type PermisosUsuario,
  type RolUsuario,
  INITIAL_PERFILES,
  PERMISOS_DEFAULT_POR_ROL,
} from './supabase';

export interface AuthContextType {
  usuarioAutenticado: PerfilUsuario | null;
  usuarioActivo: PerfilUsuario | null;
  usuarios: PerfilUsuario[];
  loading: boolean;
  estaAutenticado: boolean;
  rolSimulado: RolUsuario | null;
  esModoSimulacion: boolean;
  esAdminReal: boolean;
  iniciarSimulacion: (rol: RolUsuario) => void;
  detenerSimulacion: () => void;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  cambiarUsuarioActivo: (usuarioId: string) => void;
  refetchUsuarios: () => Promise<void>;
  actualizarUsuario: (usuario: PerfilUsuario) => Promise<{ ok: boolean; error?: string }>;
  crearUsuario: (usuarioData: Omit<PerfilUsuario, 'id' | 'created_at'>) => Promise<{ ok: boolean; error?: string }>;
  eliminarUsuario: (usuarioId: string) => Promise<{ ok: boolean; error?: string }>;
  puede: (permiso: keyof PermisosUsuario) => boolean;
  esAdmin: boolean;
  esSupervisor: boolean;
  esTecnico: boolean;
  esClinico: boolean;
  esAuditor: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_AUTH_USER_KEY = 'uem_auth_user_id';
const STORAGE_SIMULATION_ROLE_KEY = 'uem_simulation_role';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>(INITIAL_PERFILES);
  const [autenticadoId, setAutenticadoId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_AUTH_USER_KEY);
      if (saved) return saved;
      // Default to admin for seamless first load if not explicitly logged out
      return INITIAL_PERFILES[0].id;
    }
    return INITIAL_PERFILES[0].id;
  });

  const [rolSimulado, setRolSimulado] = useState<RolUsuario | null>(() => {
    if (typeof window !== 'undefined') {
      const savedRole = localStorage.getItem(STORAGE_SIMULATION_ROLE_KEY);
      if (
        savedRole &&
        (savedRole === 'Ingeniero Supervisor' ||
          savedRole === 'Ingeniero de Servicio / Técnico' ||
          savedRole === 'Clínico / Solicitante' ||
          savedRole === 'Auditor / Directivo')
      ) {
        return savedRole as RolUsuario;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(true);

  const refetchUsuarios = useCallback(async () => {
    const sanitizePerfiles = (list: PerfilUsuario[]) =>
      list.map((p) => {
        if (p.rol === 'Ingeniero de Servicio / Técnico') {
          return {
            ...p,
            permisos: {
              ...p.permisos,
              crear_solicitud_ot: false,
              gestionar_etapas_compras: false,
              crear_solicitud_compra: false,
            },
          };
        }
        return p;
      });

    try {
      const { data, error } = await supabase.from('perfiles').select('*');
      if (!error && data && data.length > 0) {
        setUsuarios(sanitizePerfiles(data as unknown as PerfilUsuario[]));
      } else {
        if (typeof window !== 'undefined') {
          const raw = localStorage.getItem('app_perfiles');
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setUsuarios(sanitizePerfiles(parsed));
                return;
              }
            } catch {
              // ignore
            }
          }
        }
        setUsuarios(INITIAL_PERFILES);
      }
    } catch {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('app_perfiles');
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setUsuarios(sanitizePerfiles(parsed));
              return;
            }
          } catch {
            // ignore
          }
        }
      }
      setUsuarios(INITIAL_PERFILES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetchUsuarios();
  }, [refetchUsuarios]);

  // Usuario autenticado real (sin simulación)
  const usuarioAutenticado = useMemo<PerfilUsuario | null>(() => {
    if (!autenticadoId) return null;
    const found = usuarios.find((u) => u.id === autenticadoId);
    if (found) return found;
    // Si no se encuentra aún en la lista, buscar en INITIAL_PERFILES
    return INITIAL_PERFILES.find((u) => u.id === autenticadoId) || null;
  }, [usuarios, autenticadoId]);

  // Determinar si el usuario autenticado real es Administrador
  const esAdminReal = useMemo(() => {
    if (!usuarioAutenticado) return false;
    return (
      usuarioAutenticado.rol === 'Administrador (Jefe de Unidad)' ||
      usuarioAutenticado.rol.includes('Administrador')
    );
  }, [usuarioAutenticado]);

  // Modo de simulación activo solo si es Admin real y ha elegido un rol
  const esModoSimulacion = Boolean(esAdminReal && rolSimulado);

  // Perfil del rol simulado
  const usuarioSimulado = useMemo<PerfilUsuario | null>(() => {
    if (!esModoSimulacion || !rolSimulado || !usuarioAutenticado) return null;

    // Buscar si existe un usuario registrado en perfiles con este rol específico
    const match = usuarios.find((u) => u.rol === rolSimulado && u.activo !== false);
    if (match) {
      return {
        ...match,
        nombre: `${match.nombre} (Simulación)`,
      };
    }

    // Si no existe, crear perfil virtual simulado con los permisos exactos
    return {
      id: `sim-${rolSimulado.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      nombre: `Perfil Simulado (${rolSimulado})`,
      email: `simulacion@hospital.cl`,
      rol: rolSimulado,
      cargo: `Rol Simulado de ${rolSimulado}`,
      servicio_clinico_asignado:
        rolSimulado === 'Clínico / Solicitante' ? 'UCI - Sala 3' : null,
      permisos: { ...PERMISOS_DEFAULT_POR_ROL[rolSimulado] },
      activo: true,
      avatar_url: null,
      created_at: new Date().toISOString(),
    };
  }, [esModoSimulacion, rolSimulado, usuarioAutenticado, usuarios]);

  // Usuario activo que gobierna la interfaz: si hay simulación, usa el perfil simulado
  const usuarioActivo = useMemo<PerfilUsuario | null>(() => {
    if (esModoSimulacion && usuarioSimulado) {
      return usuarioSimulado;
    }
    return usuarioAutenticado;
  }, [esModoSimulacion, usuarioSimulado, usuarioAutenticado]);

  const estaAutenticado = usuarioAutenticado !== null;

  // Iniciar simulación de rol (exclusivo para Administrador)
  const iniciarSimulacion = useCallback(
    (rol: RolUsuario) => {
      if (!esAdminReal) {
        console.warn('Solo el Administrador tiene autorización para simular roles.');
        return;
      }
      setRolSimulado(rol);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_SIMULATION_ROLE_KEY, rol);
      }
    },
    [esAdminReal]
  );

  // Detener simulación y volver a Administrador
  const detenerSimulacion = useCallback(() => {
    setRolSimulado(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_SIMULATION_ROLE_KEY);
    }
  }, []);

  // Cambiar usuario activo directo
  const cambiarUsuarioActivo = useCallback((usuarioId: string) => {
    setAutenticadoId(usuarioId);
    setRolSimulado(null);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_AUTH_USER_KEY, usuarioId);
      localStorage.removeItem(STORAGE_SIMULATION_ROLE_KEY);
    }
  }, []);

  // Validación de credenciales e inicio de sesión
  const login = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanEmail || !cleanPass) {
      return { ok: false, error: 'Por favor, ingresa tu correo electrónico institucional y contraseña.' };
    }

    try {
      // 1. Intentar autenticar contra Supabase Auth si está configurado
      let authUser: { id: string; email?: string } | null = null;
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPass,
        });
        if (!authError && authData?.user) {
          authUser = authData.user;
        }
      } catch (err) {
        console.warn('Supabase Auth error:', err);
      }

      // 2. Obtener lista actualizada de perfiles
      let userList = usuarios;
      if (userList.length === 0) {
        const { data } = await supabase.from('perfiles').select('*');
        if (data && data.length > 0) {
          userList = data as unknown as PerfilUsuario[];
        } else {
          userList = INITIAL_PERFILES;
        }
      }

      // 3. Buscar perfil correspondiente
      let perfilEncontrado: PerfilUsuario | undefined;
      if (authUser) {
        perfilEncontrado = userList.find(
          (p) => p.id === authUser!.id || p.email.toLowerCase() === cleanEmail
        );
      }

      if (!perfilEncontrado) {
        perfilEncontrado = userList.find((p) => p.email.toLowerCase() === cleanEmail);
      }

      if (!perfilEncontrado) {
        return {
          ok: false,
          error: 'Credenciales inválidas. Verifica tu correo electrónico y contraseña.',
        };
      }

      // 4. Validar estado de la cuenta (activo/inactivo)
      if (perfilEncontrado.activo === false) {
        return {
          ok: false,
          error: 'Tu cuenta se encuentra inactiva o deshabilitada. Contacta al Administrador de la Unidad UEM.',
        };
      }

      // 5. Si Supabase Auth no resolvió la contraseña (modo local o fallback de demostración)
      if (!authUser) {
        if (perfilEncontrado.password && perfilEncontrado.password !== cleanPass) {
          return {
            ok: false,
            error: 'Credenciales inválidas. Verifica tu correo electrónico y contraseña.',
          };
        }
      }

      // Autenticación correcta
      setAutenticadoId(perfilEncontrado.id);
      setRolSimulado(null);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_AUTH_USER_KEY, perfilEncontrado.id);
        localStorage.removeItem(STORAGE_SIMULATION_ROLE_KEY);
      }

      return { ok: true };
    } catch (err) {
      console.error('Error durante el inicio de sesión:', err);
      return {
        ok: false,
        error: 'Ocurrió un error inesperado al procesar las credenciales. Inténtalo nuevamente.',
      };
    }
  };

  // Cierre de sesión formal
  const logout = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Error en supabase.auth.signOut:', err);
    }
    setAutenticadoId(null);
    setRolSimulado(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_AUTH_USER_KEY);
      localStorage.removeItem(STORAGE_SIMULATION_ROLE_KEY);
    }
  };

  // Evaluación de permisos RBAC reactiva al usuario activo (perfil simulado o real)
  const puede = useCallback(
    (permiso: keyof PermisosUsuario): boolean => {
      if (!usuarioActivo || !usuarioActivo.activo) return false;
      // Administrador siempre tiene acceso total
      if (usuarioActivo.rol === 'Administrador (Jefe de Unidad)') return true;
      // Los técnicos no tienen facultad para ingresar nuevos mantenimientos ni solicitudes de OT,
      // ni editar los estados de seguimiento y control de adquisición.
      if (usuarioActivo.rol === 'Ingeniero de Servicio / Técnico') {
        if (
          permiso === 'crear_solicitud_ot' ||
          permiso === 'gestionar_etapas_compras' ||
          permiso === 'crear_solicitud_compra'
        ) {
          return false;
        }
      }
      return Boolean(usuarioActivo.permisos && usuarioActivo.permisos[permiso]);
    },
    [usuarioActivo]
  );

  const esAdmin = usuarioActivo?.rol === 'Administrador (Jefe de Unidad)';
  const esSupervisor = usuarioActivo?.rol === 'Ingeniero Supervisor';
  const esTecnico = usuarioActivo?.rol === 'Ingeniero de Servicio / Técnico';
  const esClinico = usuarioActivo?.rol === 'Clínico / Solicitante';
  const esAuditor = usuarioActivo?.rol === 'Auditor / Directivo';

  const actualizarUsuario = async (usuario: PerfilUsuario): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('perfiles')
        .update(usuario as unknown as Record<string, unknown>)
        .eq('id', usuario.id);

      if (error) {
        return { ok: false, error: (error as Error).message };
      }
      await refetchUsuarios();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  };

  const crearUsuario = async (
    usuarioData: Omit<PerfilUsuario, 'id' | 'created_at'>
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('perfiles')
        .insert(usuarioData as unknown as Record<string, unknown>);

      if (error) {
        return { ok: false, error: (error as Error).message };
      }
      await refetchUsuarios();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  };

  const eliminarUsuario = async (usuarioId: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      if (usuarioId === usuarioActivo?.id || usuarioId === usuarioAutenticado?.id) {
        return { ok: false, error: 'No puedes eliminar el usuario activo actualmente en uso.' };
      }
      const { error } = await supabase.from('perfiles').delete().eq('id', usuarioId);
      if (error) {
        return { ok: false, error: (error as Error).message };
      }
      await refetchUsuarios();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        usuarioAutenticado,
        usuarioActivo: usuarioActivo || INITIAL_PERFILES[0],
        usuarios,
        loading,
        estaAutenticado,
        rolSimulado,
        esModoSimulacion,
        esAdminReal,
        iniciarSimulacion,
        detenerSimulacion,
        login,
        logout,
        cambiarUsuarioActivo,
        refetchUsuarios,
        actualizarUsuario,
        crearUsuario,
        eliminarUsuario,
        puede,
        esAdmin,
        esSupervisor,
        esTecnico,
        esClinico,
        esAuditor,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
