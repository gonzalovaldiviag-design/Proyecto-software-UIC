import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Calendar,
  Loader2,
  Unlink,
} from 'lucide-react';
import {
  type ConvenioEquipo,
  type Equipo,
  type Convenio,
  supabase,
} from '@/lib/supabase';

interface DesvincularEquipoModalProps {
  open: boolean;
  onClose: () => void;
  vinculo: ConvenioEquipo;
  equipo?: Equipo;
  convenio?: Convenio;
  onSuccess: (mensaje: string) => void;
}

const MOTIVOS_SUGERIDOS = [
  'Término de comodato',
  'Traspaso a nueva licitación',
  'Devolución a proveedor',
  'Reemplazo por renovación tecnológica',
  'Baja técnica del equipo',
  'Término de garantía de fábrica',
  'Fin de contrato de arriendo',
];

export default function DesvincularEquipoModal({
  open,
  onClose,
  vinculo,
  equipo,
  convenio,
  onSuccess,
}: DesvincularEquipoModalProps) {
  const [fechaSalida, setFechaSalida] = useState(new Date().toISOString().split('T')[0]);
  const [motivoSalida, setMotivoSalida] = useState('Término de comodato');
  const [otroMotivo, setOtroMotivo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const motivoFinal = motivoSalida === 'Otro' ? otroMotivo.trim() : motivoSalida;
    if (!motivoFinal) {
      setError('Por favor especifica el motivo de salida o desvinculación.');
      return;
    }

    if (!fechaSalida) {
      setError('Por favor indica la fecha de salida.');
      return;
    }

    setGuardando(true);
    try {
      const { error: err } = await supabase
        .from('convenio_equipos')
        .update({
          estado_vinculo: 'Desvinculado',
          fecha_salida: fechaSalida,
          motivo_salida: motivoFinal,
          observaciones: observaciones.trim() || vinculo.observaciones || null,
        })
        .eq('id', vinculo.id);

      if (err) throw err;

      onSuccess(
        `Equipo ${equipo?.codigo || 'seleccionado'} desvinculado del convenio. El registro histórico se preservó con motivo "${motivoFinal}".`
      );
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-desvincular-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-800 ring-4 ring-amber-50">
              <Unlink className="h-5 w-5" />
            </div>
            <div>
              <h3 id="modal-desvincular-title" className="text-base font-bold text-slate-900">
                Desvincular Equipo Amparado
              </h3>
              <p className="text-xs text-slate-500">
                Se actualizará el estado del vínculo a &quot;Desvinculado&quot; preservando el historial
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Ficha Resumen del Equipo y Convenio */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-700 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900">{equipo?.codigo} — {equipo?.nombre}</span>
            <span className="font-mono text-[11px] text-slate-500">{equipo?.serie ? `SN: ${equipo.serie}` : ''}</span>
          </div>
          <p className="text-slate-500 text-[11px]">
            Convenio: <strong className="text-slate-800">{convenio?.codigo}</strong> ({convenio?.nombre})
          </p>
          <p className="text-[11px] text-slate-500">
            Fecha de Incorporación original: <span className="font-medium text-slate-700">{vinculo.fecha_incorporacion}</span>
          </p>
        </div>

        <form onSubmit={handleConfirmar} className="space-y-3.5">
          {/* Fecha de Salida */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Fecha de Salida / Desvinculación <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="date"
                required
                value={fechaSalida}
                onChange={(e) => setFechaSalida(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Motivo de Salida */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Motivo de Desvinculación <span className="text-rose-500">*</span>
            </label>
            <select
              value={motivoSalida}
              onChange={(e) => setMotivoSalida(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-medium text-slate-900 focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              {MOTIVOS_SUGERIDOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value="Otro">Otro motivo personalizado...</option>
            </select>
          </div>

          {motivoSalida === 'Otro' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Especifica el motivo:
              </label>
              <input
                type="text"
                required
                value={otroMotivo}
                onChange={(e) => setOtroMotivo(e.target.value)}
                placeholder="Indica el motivo detallado de salida..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
              />
            </div>
          )}

          {/* Observaciones complementarias */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Observaciones / Antecedentes
            </label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Número de acta de devolución, memorándum de traspaso, etc..."
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {guardando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Unlink className="h-4 w-4" />
                  <span>Confirmar Desvinculación</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
