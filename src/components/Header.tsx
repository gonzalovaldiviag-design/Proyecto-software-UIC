import React, { useState, useRef, useEffect } from 'react';
import {
  Boxes,
  Wrench,
  ShoppingBag,
  Users,
  Shield,
  ShieldCheck,
  Stethoscope,
  Eye,
  ChevronDown,
  Check,
  Building2,
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { type RolUsuario } from '@/lib/supabase';

export type AppTab = 'inventario' | 'mantenimiento' | 'externalizacion' | 'usuarios';

interface HeaderProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onAddEquipo?: () => void;
}

const ROL_CONFIG: Record<
  RolUsuario,
  {
    badgeClass: string;
    icon: React.ReactNode;
    shortLabel: string;
    descripcion: string;
  }
> = {
  'Administrador (Jefe de Unidad)': {
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200 ring-purple-500/20',
    icon: <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />,
    shortLabel: 'Admin UEM',
    descripcion: 'Control total, gestión de usuarios, anulación y reapertura de OTs.',
  },
  'Ingeniero Supervisor': {
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200 ring-blue-500/20',
    icon: <Shield className="h-3.5 w-3.5 text-blue-600" />,
    shortLabel: 'Supervisor',
    descripcion: 'Asignación técnica, cierre/emisión de informes y avance de compras.',
  },
  'Ingeniero de Servicio / Técnico': {
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200 ring-amber-500/20',
    icon: <Wrench className="h-3.5 w-3.5 text-amber-600" />,
    shortLabel: 'Técnico',
    descripcion: 'Atención y resolución de OTs asignadas con emisión de informe técnico (sin ingreso de nuevos mantenimientos).',
  },
  'Clínico / Solicitante': {
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200 ring-emerald-500/20',
    icon: <Stethoscope className="h-3.5 w-3.5 text-emerald-600" />,
    shortLabel: 'Clínico',
    descripcion: 'Filtro exclusivo por Servicio Clínico asignado y reporte de fallas.',
  },
  'Auditor / Directivo': {
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200 ring-slate-500/20',
    icon: <Eye className="h-3.5 w-3.5 text-slate-600" />,
    shortLabel: 'Auditor',
    descripcion: 'Acceso global en modo Solo Lectura y exportación/impresión PDF.',
  },
};

export default function Header({ currentTab, onTabChange }: HeaderProps) {
  const { usuarioActivo, usuarios, cambiarUsuarioActivo, puede } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const config = ROL_CONFIG[usuarioActivo.rol] || ROL_CONFIG['Administrador (Jefe de Unidad)'];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md print:hidden shadow-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm ring-4 ring-blue-50">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 sm:text-lg tracking-tight">
                UEM 1.3
              </h1>
              <span className="hidden rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-inset ring-blue-600/20 sm:inline-block">
                Hospital Clínico
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Gestión de Equipos Médicos & Mantenimiento
            </p>
          </div>
        </div>

        {/* Quick User Switcher */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-1.5 pr-3 shadow-xs hover:border-slate-300 hover:bg-slate-50 transition active:scale-[0.98]"
            title="Cambiar usuario activo (Simulación de Roles RBAC)"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 font-semibold text-xs text-slate-700 ring-1 ring-slate-200">
              {usuarioActivo.nombre
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div className="text-left hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800 leading-tight max-w-[140px] truncate">
                  {usuarioActivo.nombre}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold border ${config.badgeClass}`}
                >
                  {config.icon}
                  <span>{config.shortLabel}</span>
                </span>
                {usuarioActivo.servicio_clinico_asignado && (
                  <span className="inline-flex items-center rounded bg-emerald-50 px-1 py-0.5 text-[9px] font-semibold text-emerald-700 border border-emerald-200/60 max-w-[100px] truncate">
                    {usuarioActivo.servicio_clinico_asignado}
                  </span>
                )}
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl ring-1 ring-slate-900/10 animate-in fade-in zoom-in-95 duration-150 z-50">
              <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/80 rounded-xl mb-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Cambio Rápido de Perfil (RBAC)
                  </span>
                  <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-semibold border border-blue-200/60">
                    5 Roles UEM
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Selecciona un usuario institucional para probar visualmente sus restricciones y permisos.
                </p>
              </div>

              <div className="space-y-1 max-h-[380px] overflow-y-auto pr-1">
                {usuarios.map((u) => {
                  const isSelected = u.id === usuarioActivo.id;
                  const uConfig = ROL_CONFIG[u.rol] || ROL_CONFIG['Administrador (Jefe de Unidad)'];

                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        cambiarUsuarioActivo(u.id);
                        setDropdownOpen(false);
                      }}
                      className={`w-full flex items-start gap-3 rounded-xl p-2.5 text-left transition-all ${
                        isSelected
                          ? 'bg-blue-50/80 border border-blue-200 text-blue-950 shadow-xs'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ring-1 ${
                          isSelected
                            ? 'bg-blue-600 text-white ring-blue-600'
                            : 'bg-slate-100 text-slate-700 ring-slate-200'
                        }`}
                      >
                        {u.nombre
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold truncate">{u.nombre}</span>
                          {isSelected && <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold border ${uConfig.badgeClass}`}
                          >
                            {uConfig.icon}
                            <span>{u.rol}</span>
                          </span>

                          {u.servicio_clinico_asignado && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                              <Building2 className="h-2.5 w-2.5" />
                              <span>{u.servicio_clinico_asignado}</span>
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                          {uConfig.descripcion}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {puede('gestionar_usuarios') && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      onTabChange('usuarios');
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-100 hover:bg-slate-200 py-1.5 text-xs font-semibold text-slate-700 transition"
                  >
                    <Users className="h-3.5 w-3.5 text-slate-600" />
                    <span>Administrar Todos los Usuarios & Permisos</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Role Notice Banner */}
      {usuarioActivo.rol === 'Clínico / Solicitante' && (
        <div className="bg-emerald-50 border-y border-emerald-200/80 px-4 py-1.5 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2 mx-auto max-w-7xl w-full">
            <Building2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>
              <strong>Modo Clínico Activo:</strong> Filtrando automáticamente el catastro y requerimientos para tu servicio asignado:{' '}
              <strong className="underline decoration-emerald-500 decoration-2">
                {usuarioActivo.servicio_clinico_asignado || 'Servicio no asignado'}
              </strong>
            </span>
          </div>
        </div>
      )}

      {usuarioActivo.rol === 'Ingeniero de Servicio / Técnico' && (
        <div className="bg-amber-50 border-y border-amber-200/80 px-4 py-1.5 text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2 mx-auto max-w-7xl w-full">
            <Wrench className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Modo Técnico Activo:</strong> Visualizando por defecto únicamente las órdenes de trabajo asignadas a{' '}
              <strong>{usuarioActivo.nombre}</strong>.
            </span>
          </div>
        </div>
      )}

      {usuarioActivo.rol === 'Auditor / Directivo' && (
        <div className="bg-slate-100 border-y border-slate-300 px-4 py-1.5 text-xs text-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 mx-auto max-w-7xl w-full">
            <Eye className="h-4 w-4 text-slate-600 flex-shrink-0" />
            <span>
              <strong>Modo Auditoría Activo:</strong> Acceso a todos los módulos en <strong>Solo Lectura</strong> con descarga y exportación de informes oficiales.
            </span>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => onTabChange('inventario')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              currentTab === 'inventario'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Boxes className="h-4 w-4" />
            <span>Catastro de Equipos</span>
          </button>

          <button
            onClick={() => onTabChange('mantenimiento')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              currentTab === 'mantenimiento'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Wrench className="h-4 w-4" />
            <span>Mantenimiento</span>
          </button>

          {/* Compras: hidden for roles without permission e.g. Clínico */}
          {puede('ver_externalizacion') && (
            <button
              onClick={() => onTabChange('externalizacion')}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                currentTab === 'externalizacion'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Compras / Externalización</span>
            </button>
          )}

          {/* Usuarios: visible only for users with gestionar_usuarios (Administrador) */}
          {puede('gestionar_usuarios') && (
            <button
              onClick={() => onTabChange('usuarios')}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                currentTab === 'usuarios'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Usuarios y Roles</span>
              <span className="rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.2 ring-1 ring-purple-500/20">
                Admin
              </span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
