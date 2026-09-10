import { useState } from 'react';
import {
  X,
  Plus,
  ShoppingBag,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import {
  type Equipo,
  type TipoExternalizacion,
  type Externalizacion,
} from '@/lib/supabase';
import {
  TIPOS_EXTERNALIZACION,
  crearExternalizacionDirecta,
} from '@/lib/externalizacionStorage';

interface ExternalizacionModalProps {
  open: boolean;
  onClose: () => void;
  equipos: Equipo[];
  onCreated: (nueva: Externalizacion) => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

export default function ExternalizacionModal({
  open,
  onClose,
  equipos,
  onCreated,
}: ExternalizacionModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tipo, setTipo] = useState<TipoExternalizacion>(
    'Compra de repuesto por Informe de requerimiento'
  );
  const [descripcion, setDescripcion] = useState('');
  const [equipoOArea, setEquipoOArea] = useState('');
  const [selectedEquipoId, setSelectedEquipoId] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [montoEstimado, setMontoEstimado] = useState('');
  const [notas, setNotas] = useState('');

  const handleEquipoSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const eqId = e.target.value;
    setSelectedEquipoId(eqId);
    if (eqId) {
      const eq = equipos.find((item) => item.id === eqId);
      if (eq) {
        setEquipoOArea(`${eq.codigo} — ${eq.nombre} (${eq.servicio})`);
      }
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!(descripcion || '').trim()) {
      setError('Debes ingresar una descripción detallada del requerimiento o repuesto.');
      return;
    }
    if (!(solicitante || '').trim()) {
      setError('Debes ingresar el nombre del solicitante o responsable.');
      return;
    }

    setSaving(true);

    try {
      const res = await crearExternalizacionDirecta({
        tipo,
        descripcion: (descripcion || '').trim(),
        equipoIdentificacion: (equipoOArea || '').trim() || 'Insumos Clínicos Generales / Stock',
        equipoId: selectedEquipoId || null,
        solicitante: (solicitante || '').trim(),
        montoEstimado: (montoEstimado || '').trim() ? Number(montoEstimado) : null,
        notas: (notas || '').trim() || null,
      });

      setSaving(false);

      if (!res) {
        setError('Ocurrió un error al registrar la solicitud. Verifica los datos e intenta nuevamente.');
        return;
      }

      onCreated(res);
      onClose();
    } catch (err) {
      setSaving(false);
      setError((err as Error).message || 'Ocurrió un error inesperado al registrar la solicitud.');
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Nueva Solicitud Externa Directa (Línea B)
              </h2>
              <p className="text-xs text-slate-500">
                Compras clínicas o servicios tercerizados no asociados a una OT existente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Modalidad de Externalización / Compra <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {TIPOS_EXTERNALIZACION.map((t) => {
                const active = tipo === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all text-xs ${
                      active
                        ? 'border-blue-600 bg-blue-50/70 text-blue-950 ring-2 ring-blue-500/20 font-semibold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{t}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Descripción Detallada del Requerimiento o Repuesto{' '}
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              className={`${inputClass} resize-y`}
              placeholder="Especificaciones técnicas del repuesto, marca requerida, insumos de stock o alcance del servicio técnico..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Vincular a un Equipo Clínico (Opcional)
              </label>
              <select
                className={inputClass}
                value={selectedEquipoId}
                onChange={handleEquipoSelect}
              >
                <option value="">-- No vincular a un equipo específico --</option>
                {equipos.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.codigo} — {eq.nombre} ({eq.servicio})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Destino / Servicio Clínico o Stock
              </label>
              <input
                className={inputClass}
                placeholder="Ej: Stock Insumos UCI, Pabellón Quirúrgico, etc."
                value={equipoOArea}
                onChange={(e) => setEquipoOArea(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Solicitante / Responsable <span className="text-rose-500">*</span>
              </label>
              <input
                required
                className={inputClass}
                placeholder="Nombre y cargo del solicitante"
                value={solicitante}
                onChange={(e) => setSolicitante(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Monto Estimado Inicial (CLP $)
              </label>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={`${inputClass} pl-9`}
                  placeholder="Ej: 350000"
                  value={montoEstimado}
                  onChange={(e) => setMontoEstimado(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Observaciones Iniciales
            </label>
            <textarea
              rows={2}
              className={`${inputClass} resize-y`}
              placeholder="Justificación de compra, proveedor recomendado, urgencia clínica..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>{saving ? 'Registrando...' : 'Crear Solicitud'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
