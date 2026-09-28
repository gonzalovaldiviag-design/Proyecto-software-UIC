import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Building2,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Tag,
  Shield,
} from 'lucide-react';
import {
  type Convenio,
  type TipoConvenio,
  type EstadoConvenio,
  supabase,
} from '@/lib/supabase';

interface ConvenioModalProps {
  open: boolean;
  onClose: () => void;
  convenio: Convenio | null;
  onSuccess: (mensaje: string) => void;
}

const TIPOS_CONVENIO: TipoConvenio[] = [
  'Arriendo',
  'Comodato',
  'Garantía',
  'Mantenimiento',
  'Suministro',
];

const ESTADOS_CONVENIO: EstadoConvenio[] = [
  'Vigente',
  'Por Vencer',
  'Vencido',
  'Finalizado',
  'En Tramitación',
];

export default function ConvenioModal({
  open,
  onClose,
  convenio,
  onSuccess,
}: ConvenioModalProps) {
  const isEdit = Boolean(convenio);

  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [rutEmpresa, setRutEmpresa] = useState('');
  const [tipoConvenio, setTipoConvenio] = useState<TipoConvenio>('Arriendo');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaTermino, setFechaTermino] = useState('');
  const [montoTotalComprometido, setMontoTotalComprometido] = useState<number>(0);
  const [moneda, setMoneda] = useState<'CLP' | 'UF'>('CLP');
  const [valorUf, setValorUf] = useState<number | ''>('');
  const [ordenCompraMadre, setOrdenCompraMadre] = useState('');
  const [licitacionId, setLicitacionId] = useState('');
  const [estado, setEstado] = useState<EstadoConvenio>('Vigente');
  const [responsable, setResponsable] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (convenio) {
        setCodigo(convenio.codigo || '');
        setNombre(convenio.nombre || '');
        setEmpresa(convenio.empresa || '');
        setRutEmpresa(convenio.rut_empresa || '');
        setTipoConvenio(convenio.tipo_convenio || 'Arriendo');
        setFechaInicio(convenio.fecha_inicio || '');
        setFechaTermino(convenio.fecha_termino || '');
        setMontoTotalComprometido(convenio.monto_total_comprometido || 0);
        setMoneda(convenio.moneda || 'CLP');
        setValorUf(convenio.valor_uf ?? '');
        setOrdenCompraMadre(convenio.orden_compra_madre || '');
        setLicitacionId(convenio.licitacion_id || '');
        setEstado(convenio.estado || 'Vigente');
        setResponsable(convenio.responsable || '');
        setDescripcion(convenio.descripcion || '');
      } else {
        const currentYear = new Date().getFullYear();
        setCodigo(`CONV-${currentYear}-${Math.floor(100 + Math.random() * 900)}`);
        setNombre('');
        setEmpresa('');
        setRutEmpresa('');
        setTipoConvenio('Arriendo');
        setFechaInicio(new Date().toISOString().split('T')[0]);
        // Default 1 year duration
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        setFechaTermino(nextYear.toISOString().split('T')[0]);
        setMontoTotalComprometido(12000000);
        setMoneda('CLP');
        setValorUf('');
        setOrdenCompraMadre('');
        setLicitacionId('');
        setEstado('Vigente');
        setResponsable('');
        setDescripcion('');
      }
    }
  }, [open, convenio]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) {
      setError('Por favor ingresa el nombre o denominación del convenio.');
      return;
    }

    if (!empresa.trim()) {
      setError('Por favor indica la empresa proveedora adjudicataria.');
      return;
    }

    if (!fechaInicio || !fechaTermino) {
      setError('Por favor define la fecha de inicio y término de vigencia.');
      return;
    }

    if (new Date(fechaTermino) < new Date(fechaInicio)) {
      setError('La fecha de término no puede ser anterior a la fecha de inicio.');
      return;
    }

    setGuardando(true);
    try {
      const payload: Partial<Convenio> = {
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        empresa: empresa.trim(),
        rut_empresa: rutEmpresa.trim() || null,
        tipo_convenio: tipoConvenio,
        fecha_inicio: fechaInicio,
        fecha_termino: fechaTermino,
        monto_total_comprometido: Number(montoTotalComprometido) || 0,
        moneda,
        valor_uf: valorUf === '' ? null : Number(valorUf),
        orden_compra_madre: ordenCompraMadre.trim() || null,
        licitacion_id: licitacionId.trim() || null,
        estado,
        responsable: responsable.trim() || null,
        descripcion: descripcion.trim() || null,
      };

      if (isEdit && convenio) {
        const { error: err } = await supabase
          .from('convenios')
          .update(payload)
          .eq('id', convenio.id);

        if (err) throw err;
        onSuccess(`Convenio "${nombre}" actualizado correctamente.`);
      } else {
        const { error: err } = await supabase
          .from('convenios')
          .insert([payload]);

        if (err) throw err;
        onSuccess(`Nuevo convenio "${nombre}" creado exitosamente.`);
      }
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
      aria-labelledby="modal-convenio-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm ring-4 ring-blue-100">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 id="modal-convenio-title" className="text-base font-bold text-slate-900">
                {isEdit ? 'Editar Convenio / Contrato' : 'Registrar Nuevo Convenio / Comodato'}
              </h3>
              <p className="text-xs text-slate-500">
                Gestión contractual, presupuesto comprometido y vigencias hospitalarias
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
              <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Código y Nombre */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Código Convenio <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="CONV-2026-001"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-mono font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Denominación / Nombre del Convenio <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="ej. Arriendo Integral de Monitores Multiparamétricos"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Empresa y RUT */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Empresa Proveedora Adjudicada <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  placeholder="ej. Philips Chilena S.A."
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">RUT Empresa</label>
              <input
                type="text"
                value={rutEmpresa}
                onChange={(e) => setRutEmpresa(e.target.value)}
                placeholder="ej. 96.541.230-8"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Tipo de Convenio y Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Modalidad / Tipo de Convenio <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Tag className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600" />
                <select
                  value={tipoConvenio}
                  onChange={(e) => setTipoConvenio(e.target.value as TipoConvenio)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  {TIPOS_CONVENIO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Estado Contractual <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Shield className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as EstadoConvenio)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  {ESTADOS_CONVENIO.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Vigencias: Inicio y Término */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fecha Inicio Vigencia <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  required
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fecha Término Vigencia <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  required
                  value={fechaTermino}
                  onChange={(e) => setFechaTermino(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Presupuesto Comprometido y Moneda */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Total Presupuesto Comprometido ($ CLP) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                <input
                  type="number"
                  required
                  value={montoTotalComprometido}
                  onChange={(e) => setMontoTotalComprometido(parseInt(e.target.value, 10) || 0)}
                  placeholder="48000000"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs font-mono font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Equivalente UF (opcional)</label>
              <input
                type="number"
                value={valorUf}
                onChange={(e) => setValorUf(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="ej. 1250"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* OC Madre y Licitación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Orden de Compra Madre (OC)
              </label>
              <input
                type="text"
                value={ordenCompraMadre}
                onChange={(e) => setOrdenCompraMadre(e.target.value)}
                placeholder="ej. 2398-102-LR25"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ID Licitación Mercado Público
              </label>
              <input
                type="text"
                value={licitacionId}
                onChange={(e) => setLicitacionId(e.target.value)}
                placeholder="ej. 2398-45-LP24"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Responsable */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ingeniero o Responsable Institucional
            </label>
            <input
              type="text"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              placeholder="ej. Ing. Pamela Soto"
              className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Descripción y Alcance del Convenio
            </label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Condiciones de mantención preventiva, tiempos de respuesta técnica, coberturas..."
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              id="btn-guardar-convenio"
              type="submit"
              disabled={guardando}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {guardando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isEdit ? 'Actualizar Convenio' : 'Crear Convenio'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
