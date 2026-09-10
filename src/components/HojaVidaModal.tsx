import { useEffect, useState } from 'react';
import {
  X,
  Boxes,
  Calendar,
  User,
  UserCheck,
  ClipboardList,
  Wrench,
  Loader2,
  AlertCircle,
  Tag,
  Building2,
  Hash,
  CheckCircle2,
  FileText,
  ShoppingCart,
  Hourglass,
  PackageCheck,
} from 'lucide-react';
import { supabase, type Equipo, type Mantenimiento } from '@/lib/supabase';
import EstadoBadge from '@/components/EstadoBadge';
import { getNombreArchivo } from '@/lib/fileUtils';

interface HojaVidaModalProps {
  open: boolean;
  onClose: () => void;
  equipo: Equipo | null;
}

const estadoMStyles: Record<string, { dot: string; badge: string }> = {
  'Pendiente de Asignación': { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  'En proceso': { dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  Completado: { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Tag;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-slate-800">
          {value && typeof value === 'string' && value.trim() !== '' ? value : '—'}
        </p>
      </div>
    </div>
  );
}

export default function HojaVidaModal({ open, onClose, equipo }: HojaVidaModalProps) {
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !equipo) return;
    setLoading(true);
    setError(null);
    supabase
      .from('mantenimientos')
      .select('*')
      .eq('equipo_id', equipo.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
        } else {
          setMantenimientos((data as Mantenimiento[]) ?? []);
        }
        setLoading(false);
      });
  }, [open, equipo]);

  if (!open || !equipo) return null;

  const totalMant = mantenimientos.length;
  const completados = mantenimientos.filter((m) => m.estado_mantenimiento === 'Completado').length;
  const pendientes = mantenimientos.filter(
    (m) => m.estado_mantenimiento === 'Pendiente de Asignación' || m.estado_mantenimiento === 'En proceso'
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/60">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Hoja de Vida del Equipo</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {equipo.codigo} — {equipo.nombre}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Datos del inventario */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Boxes className="h-4 w-4 text-blue-600" />
                Datos de Ingreso al Inventario
              </h3>
              <EstadoBadge estado={equipo.estado} />
            </div>
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              <InfoRow icon={Tag} label="Código / ID" value={equipo.codigo} />
              <InfoRow icon={Building2} label="Servicio Clínico" value={equipo.ubicacion} />
              <InfoRow icon={Tag} label="Marca" value={equipo.marca} />
              <InfoRow icon={Tag} label="Modelo" value={equipo.modelo} />
              <InfoRow icon={Hash} label="Serie" value={equipo.serie} />
              <InfoRow icon={Hash} label="Inventario" value={equipo.inventario} />
              <InfoRow icon={Calendar} label="Año de Adquisición" value={equipo.anio_adquisicion?.toString()} />
              <InfoRow icon={ShoppingCart} label="Orden de Compra" value={equipo.orden_compra} />
              <InfoRow icon={FileText} label="Acta de Entrega" value={equipo.acta_entrega} />
              <InfoRow icon={Hourglass} label="Vida Útil (años)" value={equipo.vida_util?.toString()} />
              <InfoRow icon={Hourglass} label="Vida Útil Residual (años)" value={equipo.vida_util_residual?.toString()} />
              <InfoRow icon={PackageCheck} label="Modalidad" value={equipo.modalidad_adquisicion} />
              <InfoRow icon={Calendar} label="Fecha de ingreso" value={formatDate(equipo.created_at)} />
            </div>
          </div>

          {/* Historial de mantenimientos */}
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Wrench className="h-4 w-4 text-blue-600" />
                Historial de Mantenimientos
              </h3>
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {totalMant} total
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  {pendientes} activos
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  {completados} completados
                </span>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="ml-2 text-sm">Cargando historial...</span>
              </div>
            ) : mantenimientos.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-12 text-slate-400">
                <CheckCircle2 className="h-8 w-8" />
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Sin mantenimientos registrados
                </p>
                <p className="text-xs text-slate-400">
                  Este equipo no tiene mantenimientos asociados
                </p>
              </div>
            ) : (
              <div className="relative space-y-3">
                {/* Timeline line */}
                <div className="absolute bottom-4 left-[19px] top-4 w-px bg-slate-200" />
                {mantenimientos.map((m) => {
                  const s = estadoMStyles[m.estado_mantenimiento] ?? estadoMStyles['Pendiente de Asignación'];
                  return (
                    <div key={m.id} className="relative flex gap-4">
                      {/* Dot */}
                      <div
                        className={`relative z-10 mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${s.badge} ring-1 ring-inset`}
                      >
                        <Wrench className="h-4 w-4" />
                      </div>
                      {/* Card */}
                      <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-xs font-semibold text-blue-600">
                              {m.codigo}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-800">
                                {m.problema_reportado}
                              </p>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                                  m.tipo_mantenimiento === 'Correctivo'
                                    ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
                                    : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                                }`}
                              >
                                {m.tipo_mantenimiento}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${s.badge}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                            {m.estado_mantenimiento}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-medium text-slate-600">Solicitado por:</span>
                            <span>{m.solicitado_por}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-medium text-slate-600">Asignado a:</span>
                            <span>{m.asignado_a || 'Sin asignar'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-medium text-slate-600">Fecha req.:</span>
                            <span>{m.fecha_requerimiento}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-medium text-slate-600">Registrado:</span>
                            <span>{formatDate(m.created_at)}</span>
                          </div>
                          {m.completado_por && (
                            <div className="flex items-center gap-1.5">
                              <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="font-medium text-slate-600">Completado por:</span>
                              <span>{m.completado_por}</span>
                            </div>
                          )}
                          {m.recibido_por && (
                            <div className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="font-medium text-slate-600">Recibido por:</span>
                              <span>{m.recibido_por}</span>
                            </div>
                          )}
                          {m.fotos_url && m.fotos_url.length > 0 && (
                            <div className="col-span-full mt-1 flex flex-wrap gap-1.5">
                              {m.fotos_url.map((url) => (
                                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                  <img src={url} alt="Foto" className="h-14 w-14 rounded-md border border-slate-200 object-cover" />
                                </a>
                              ))}
                            </div>
                          )}
                          {m.documentos_url && m.documentos_url.length > 0 && (
                            <div className="col-span-full space-y-1">
                              {m.documentos_url.map((url) => {
                                const name = getNombreArchivo(url);
                                return (
                                  <a
                                    key={url}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={name}
                                    className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700"
                                  >
                                    <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="truncate max-w-xs">{name}</span>
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
