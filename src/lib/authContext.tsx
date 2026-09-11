import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  supabase,
  type PerfilUsuario,
  type PermisosUsuario,
  INITIAL_PERFILES,
} from './supabase';

interface AuthContextType {
  usuarioActivo: PerfilUsuario;
  usuarios: PerfilUsuario[];
  loading: boolean;
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

const STORAGE_ACTIVE_USER_KEY = 'app_usuario_activo_id';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>(INITIAL_PERFILES);
  const [activeUserId, setActiveUserId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_ACTIVE_USER_KEY);
      if (saved) return saved;
    }
    return INITIAL_PERFILES[0].id; // Administrador por defecto
  });
  const [loading, setLoading] = useState(true);

  const refetchUsuarios = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('perfiles').select('*');
      if (!error && data && data.length > 0) {
        const sanitized = (data as unknown as PerfilUsuario[]).map((p) => {
          if (p.rol === 'Ingeniero de Servicio / Técnico') {
            return {
              ...p,
              permisos: {
                ...p.permisos,
                crear_solicitud_ot: false,
              },
            };
          }
          return p;
        });
        setUsuarios(sanitized);
      } else {
        if (typeof window !== 'undefined') {
          const raw = localStorage.getItem('app_perfiles');
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setUsuarios(parsed);
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
              setUsuarios(parsed);
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

  const cambiarUsuarioActivo = useCallback((usuarioId: string) => {
    setActiveUserId(usuarioId);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_ACTIVE_USER_KEY, usuarioId);
    }
  }, []);

  const usuarioActivo = useMemo(() => {
    const found = usuarios.find((u) => u.id === activeUserId);
    if (found) return found;
    return usuarios[0] || INITIAL_PERFILES[0];
  }, [usuarios, activeUserId]);

  const puede = useCallback(
    (permiso: keyof PermisosUsuario): boolean => {
      if (!usuarioActivo || !usuarioActivo.activo) return false;
      // Administrador siempre tiene acceso total
      if (usuarioActivo.rol === 'Administrador (Jefe de Unidad)') return true;
      // Los técnicos no tienen facultad para ingresar nuevos mantenimientos ni solicitudes de OT
      if (usuarioActivo.rol === 'Ingeniero de Servicio / Técnico' && permiso === 'crear_solicitud_ot') {
        return false;
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
      if (usuarioId === usuarioActivo.id) {
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
        usuarioActivo,
        usuarios,
        loading,
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
