import React, { useState } from 'react';
import {
  Boxes,
  Lock,
  Mail,
  LogIn,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Shield,
  Wrench,
  Stethoscope,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { type RolUsuario } from '@/lib/supabase';

interface DemoUserCard {
  rol: RolUsuario;
  nombre: string;
  cargo: string;
  email: string;
  pass: string;
  badgeClass: string;
  icon: React.ReactNode;
}

const DEMO_USERS: DemoUserCard[] = [
  {
    rol: 'Administrador (Jefe de Unidad)',
    nombre: 'Ing. Carlos Mendoza',
    cargo: 'Jefe Unidad de Equipos Médicos',
    email: 'cmendoza@hospital.cl',
    pass: 'admin*uem2026',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />,
  },
  {
    rol: 'Ingeniero Supervisor',
    nombre: 'Ing. Pamela Soto',
    cargo: 'Supervisora de Operaciones Clínicas',
    email: 'psoto@hospital.cl',
    pass: 'super*uem2026',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Shield className="h-3.5 w-3.5 text-blue-600" />,
  },
  {
    rol: 'Ingeniero de Servicio / Técnico',
    nombre: 'Téc. Fernando Ruiz',
    cargo: 'Técnico Biomédico de Terreno',
    email: 'fruiz@hospital.cl',
    pass: 'tec*uem2026',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <Wrench className="h-3.5 w-3.5 text-amber-600" />,
  },
  {
    rol: 'Clínico / Solicitante',
    nombre: 'Enf. Marcela Fuentes',
    cargo: 'Enfermera Coordinadora UCI',
    email: 'mfuentes@hospital.cl',
    pass: 'clinico*uem2026',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: <Stethoscope className="h-3.5 w-3.5 text-emerald-600" />,
  },
  {
    rol: 'Auditor / Directivo',
    nombre: 'Dra. Andrea Morales',
    cargo: 'Directora de Calidad Asistencial',
    email: 'amorales@hospital.cl',
    pass: 'auditor*uem2026',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
    icon: <Building2 className="h-3.5 w-3.5 text-slate-600" />,
  },
];

export default function LoginView() {
  const { login } = useAuth();
  const [email, setEmail] = useState('cmendoza@hospital.cl');
  const [password, setPassword] = useState('admin*uem2026');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await login(email, password);
      if (!res.ok) {
        setErrorMsg(res.error || 'Credenciales inválidas. Verifica tu correo y contraseña.');
      }
    } catch {
      setErrorMsg('Error inesperado al iniciar sesión. Inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemo = (demo: DemoUserCard) => {
    setEmail(demo.email);
    setPassword(demo.pass);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        {/* Header Institucional */}
        <div className="text-center mb-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/20 ring-4 ring-blue-500/30">
            <Boxes className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            UIC CORE
          </h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-blue-400">
            Hospital Dr. Gustavo Fricke de Viña del Mar
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Ingreso Seguro al Sistema de Gestión Biomédica & Mantenimiento
          </p>
        </div>

        {/* Card Formulario */}
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div
                id="login-error-alert"
                className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/60 p-3.5 text-xs text-red-200 animate-in fade-in duration-200"
              >
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-100">Fallo de Autenticación</p>
                  <p className="mt-0.5 text-red-300 leading-relaxed">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Correo Electrónico Institucional
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@hospital.cl"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-3 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                >
                  Contraseña
                </label>
                <span className="text-[10px] text-slate-400">Supabase Auth / RBAC</span>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-10 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 transition"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                id="btn-login-submit"
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verificando Credenciales...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span>Iniciar Sesión en UEM</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Access Demo Credentials Section */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Acceso Rápido por Rol (Demostración)
              </span>
              <span className="text-[10px] font-semibold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-800/50">
                1-Clic
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
              {DEMO_USERS.map((demo) => {
                const isSelected = email.toLowerCase() === demo.email.toLowerCase();
                return (
                  <button
                    key={demo.email}
                    type="button"
                    onClick={() => handleSelectDemo(demo)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-left transition border ${
                      isSelected
                        ? 'border-blue-500/80 bg-blue-950/40 text-blue-200'
                        : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-300 flex-shrink-0">
                        {demo.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-200 truncate">
                            {demo.nombre}
                          </span>
                          <span className={`inline-flex items-center rounded px-1.5 py-0.2 text-[9px] font-semibold border ${demo.badgeClass}`}>
                            {demo.rol.split(' ')[0]}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">{demo.email}</p>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-4 w-4 text-blue-400 flex-shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Institucional */}
        <div className="text-center mt-6">
          <p className="text-[11px] text-slate-500">
            Control de Acceso Basado en Roles (RBAC) conforme a estándares hospitalarios.
          </p>
          <p className="text-[10px] text-slate-600 mt-1">
            Unidad de Equipos Médicos UEM 1.3 &copy; 2026 Hospital Clínico
          </p>
        </div>
      </div>
    </div>
  );
}
