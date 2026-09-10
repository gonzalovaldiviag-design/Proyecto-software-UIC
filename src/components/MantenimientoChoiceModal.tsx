import { useEffect, useState } from 'react';
import { X, Wrench, PlusCircle, Loader2, AlertCircle, ChevronRight, User } from 'lucide-react';
import { supabase, type Equipo, type Mantenimiento } from '@/lib/supabase';

interface MantenimientoChoiceModalProps {
  open: boolean;
  equipo: Equipo | null;
  onClose: () => void;
  onNuevo: () => void;
}

export default function MantenimientoChoiceModal({
  open,
  equipo,
  onClose,
  onNuevo,
}: MantenimientoChoiceModalProps) {
  const [paso, setPaso] = useState<'eleccion' | 'falla'>('eleccion');
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mantSeleccionado, setMantSeleccionado] = useState('');
  const [nuevaFalla, setNuevaFalla] = useState('');
  const [registradoPor, setRegistradoPor] = useState('');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setPaso('eleccion');
      setMantenimientos([]);
      setError(null);
      setMantSeleccionado('');
      setNuevaFalla('');
      setRegistradoPor('');
      setTouched(false);
      setSaving(false);
    }
  }, [open, equipo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  async function cargarMantenimientos() {
    if (!equipo) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('mantenimientos')
      .select('*')
      .eq('equipo_id', equipo.id)
      .neq('estado_mantenimiento', 'Completado')
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      const lista = (data as Mantenimiento[]) ?? [];
      setMantenimientos(lista);
      if (lista.length > 0) setMantSeleccionado(lista[0].id);
    }
    setLoading(false);
  }

  function elegirAgregarFalla() {
    setPaso('falla');
    cargarMantenimientos();
  }

  async function handleGuardarFalla() {
    setTouched(true);
    if (!mantSeleccionado || !(nuevaFalla || '').trim() || !(registradoPor || '').trim()) return;
    const mant = mantenimientos.find((m) => m.id === mantSeleccionado);
    if (!mant) return;
    setSaving(true);
    setError(null);
    const textoActualizado = `${mant.problema_reportado}\n\n--- Nueva falla agregada por ${(registradoPor || '').trim()} el ${new Date().toLocaleDateString('es-ES')} ---\n${(nuevaFalla || '').trim()}`;
    const { error: updateError } = await supabase
      .from('mantenimientos')
      .update({ problema_reportado: textoActualizado })
      .eq('id', mant.id);
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    const { error: insertError } = await supabase
      .from('fallas_mantenimiento')
      .insert({
        mantenimiento_id: mant.id,
        descripcion_falla: (nuevaFalla || '').trim(),
        registrado_por: (registradoPor || '').trim(),
      });
    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/60">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Ingresar Mantenimiento
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {equipo && (
                <>
                  {equipo.codigo} — {equipo.nombre}{' '}
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    En Mantenimiento
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {paso === 'eleccion' && (
            <div className="space-y-3">
              <p className="mb-2 text-sm text-slate-600">
                Este equipo ya se encuentra en mantenimiento. ¿Qué deseas hacer?
              </p>
              <button
                onClick={elegirAgregarFalla}
                className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-amber-300 hover:bg-amber-50/50 hover:shadow-sm"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <Wrench className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    Agregar falla a mantenimiento existente
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Añade una nueva falla a un mantenimiento que aún no ha sido completado
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400" />
              </button>
              <button
                onClick={onNuevo}
                className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    Generar nuevo mantenimiento
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Crea un requerimiento de mantenimiento independiente
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400" />
              </button>
            </div>
          )}

          {paso === 'falla' && (
            <div>
              {loading && (
                <div className="flex items-center justify-center gap-2 py-8 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Cargando mantenimientos...</span>
                </div>
              )}

              {error && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="flex-1">{error}</div>
                </div>
              )}

              {!loading && !error && mantenimientos.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-slate-400">
                  <Wrench className="h-10 w-10" />
                  <p className="text-sm font-medium text-slate-500">
                    No hay mantenimientos abiertos para este equipo
                  </p>
                  <p className="text-xs text-slate-400">
                    Genera un nuevo mantenimiento en su lugar
                  </p>
                  <button
                    onClick={onNuevo}
                    className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    Generar nuevo mantenimiento
                  </button>
                </div>
              )}

              {!loading && !error && mantenimientos.length > 0 && (
                <>
                  <div className="mb-4">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Mantenimiento existente <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={mantSeleccionado}
                      onChange={(e) => setMantSeleccionado(e.target.value)}
                    >
                      {mantenimientos.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.codigo} — {m.estado_mantenimiento} ({m.fecha_requerimiento})
                        </option>
                      ))}
                    </select>
                    {mantSeleccionado && (
                      <div className="mt-2 rounded-lg bg-slate-50 p-3">
                        <p className="text-xs font-medium text-slate-500">
                          Problema actual:
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                          {mantenimientos.find((m) => m.id === mantSeleccionado)?.problema_reportado}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Nueva falla a agregar <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      className="min-h-[80px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={nuevaFalla}
                      onChange={(e) => setNuevaFalla(e.target.value)}
                      placeholder="Describe la nueva falla a agregar al mantenimiento..."
                    />
                    {touched && !(nuevaFalla || '').trim() && (
                      <p className="mt-1 text-xs text-rose-500">
                        La descripción de la falla es obligatoria
                      </p>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Registrado por <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        value={registradoPor}
                        onChange={(e) => setRegistradoPor(e.target.value)}
                        placeholder="Nombre de quien registra la falla"
                      />
                    </div>
                    {touched && !(registradoPor || '').trim() && (
                      <p className="mt-1 text-xs text-rose-500">
                        El nombre de quien registra es obligatorio
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-slate-400">
                      La fecha del registro se guardará automáticamente
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setPaso('eleccion')}
                      className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                    >
                      Atrás
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleGuardarFalla}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Agregar falla
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
