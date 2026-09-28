import React, { useState, useEffect } from 'react';
import {
  X,
  Receipt,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Hash,
} from 'lucide-react';
import {
  type Convenio,
  type ConvenioCuotaMensual,
  supabase,
} from '@/lib/supabase';

interface CuotaModalProps {
  open: boolean;
  onClose: () => void;
  cuota: ConvenioCuotaMensual | null;
  convenios: Convenio[];
  convenioPreseleccionadoId?: string;
  onSuccess: (mensaje: string) => void;
}

const ESTADOS_UIC = [
  'Facturado Conforme',
  'Pendiente de OC',
  'Sin presupuesto',
  'En Trámite',
  'Recepcionado Conforme',
  'Rechazado',
  'Pagado',
  'Observado',
];

const ESTADOS_MERCADO_PUBLICO = [
  'Recepcionado Conforme',
  'Envío a Pago',
  'Pendiente Proveedor',
  'Pendiente OC',
  'Aceptada',
  'Reclamo',
  'Observada / Sin Saldo',
  'Sin Información',
];

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export default function CuotaModal({
  open,
  onClose,
  cuota,
  convenios,
  convenioPreseleccionadoId,
  onSuccess,
}: CuotaModalProps) {
  const isEdit = Boolean(cuota);

  const [convenioId, setConvenioId] = useState('');
  const [estadoUic, setEstadoUic] = useState('Facturado Conforme');
  const [numeroGuia, setNumeroGuia] = useState('');
  const [fechaGuia, setFechaGuia] = useState('');
  const [codigoMiSsvq, setCodigoMiSsvq] = useState('');
  const [fechaEntregaAbastecimiento, setFechaEntregaAbastecimiento] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [equipoServicio, setEquipoServicio] = useState('');
  const [ordenCompra, setOrdenCompra] = useState('');
  const [fechaOc, setFechaOc] = useState('');
  const [mes, setMes] = useState('Septiembre');
  const [anio, setAnio] = useState(2026);
  const [cuotaText, setCuotaText] = useState('1/12');
  const [valorClp, setValorClp] = useState<number>(0);
  const [estadoMercadoPublico, setEstadoMercadoPublico] = useState('Recepcionado Conforme');
  const [numeroFactura, setNumeroFactura] = useState('');
  const [fechaFactura, setFechaFactura] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (cuota) {
        setConvenioId(cuota.convenio_id || '');
        setEstadoUic(cuota.estado_uic || 'Facturado Conforme');
        setNumeroGuia(cuota.numero_guia || '');
        setFechaGuia(cuota.fecha_guia || '');
        setCodigoMiSsvq(cuota.codigo_mi_ssvq || '');
        setFechaEntregaAbastecimiento(cuota.fecha_entrega_abastecimiento || '');
        setEmpresa(cuota.empresa || '');
        setEquipoServicio(cuota.equipo_servicio || '');
        setOrdenCompra(cuota.orden_compra || '');
        setFechaOc(cuota.fecha_oc || '');
        setMes(cuota.mes || 'Septiembre');
        setAnio(cuota.anio || 2026);
        setCuotaText(cuota.cuota || '1/12');
        setValorClp(cuota.valor_clp || 0);
        setEstadoMercadoPublico(cuota.estado_mercado_publico || 'Recepcionado Conforme');
        setNumeroFactura(cuota.numero_factura || '');
        setFechaFactura(cuota.fecha_factura || '');
        setObservaciones(cuota.observaciones || '');
      } else {
        const defaultConv = convenios.find((c) => c.id === convenioPreseleccionadoId) || convenios[0];
        setConvenioId(defaultConv ? defaultConv.id : '');
        setEstadoUic('Facturado Conforme');
        setNumeroGuia('');
        setFechaGuia(new Date().toISOString().split('T')[0]);
        setCodigoMiSsvq(`SSVQ-MI-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
        setFechaEntregaAbastecimiento('');
        setEmpresa(defaultConv ? defaultConv.empresa : '');
        setEquipoServicio(defaultConv ? defaultConv.nombre : '');
        setOrdenCompra(defaultConv?.orden_compra_madre || '');
        setFechaOc('');
        setMes('Septiembre');
        setAnio(new Date().getFullYear());
        setCuotaText('1/12');
        setValorClp(defaultConv ? Math.round(defaultConv.monto_total_comprometido / 12) : 1000000);
        setEstadoMercadoPublico('Recepcionado Conforme');
        setNumeroFactura('');
        setFechaFactura('');
        setObservaciones('');
      }
    }
  }, [open, cuota, convenios, convenioPreseleccionadoId]);

  if (!open) return null;

  const handleConvenioChange = (cid: string) => {
    setConvenioId(cid);
    const selected = convenios.find((c) => c.id === cid);
    if (selected) {
      setEmpresa(selected.empresa);
      setEquipoServicio(selected.nombre);
      if (selected.orden_compra_madre && !ordenCompra) {
        setOrdenCompra(selected.orden_compra_madre);
      }
      if (!isEdit && valorClp === 0) {
        setValorClp(Math.round(selected.monto_total_comprometido / 12));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!empresa.trim()) {
      setError('Por favor indica la empresa proveedora de la cuota.');
      return;
    }

    if (valorClp < 0) {
      setError('El valor en pesos no puede ser negativo.');
      return;
    }

    setGuardando(true);
    try {
      const payload: Partial<ConvenioCuotaMensual> = {
        convenio_id: convenioId || (convenios[0] ? convenios[0].id : ''),
        estado_uic: estadoUic,
        numero_guia: numeroGuia.trim(),
        fecha_guia: fechaGuia,
        codigo_mi_ssvq: codigoMiSsvq.trim(),
        fecha_entrega_abastecimiento: fechaEntregaAbastecimiento,
        empresa: empresa.trim(),
        equipo_servicio: equipoServicio.trim(),
        orden_compra: ordenCompra.trim(),
        fecha_oc: fechaOc,
        mes,
        anio: Number(anio) || new Date().getFullYear(),
        cuota: cuotaText.trim(),
        valor_clp: Number(valorClp) || 0,
        estado_mercado_publico: estadoMercadoPublico,
        numero_factura: numeroFactura.trim(),
        fecha_factura: fechaFactura,
        observaciones: observaciones.trim() || null,
      };

      if (isEdit && cuota) {
        const { error: err } = await supabase
          .from('convenio_cuotas_mensuales')
          .update(payload)
          .eq('id', cuota.id);

        if (err) throw err;
        onSuccess(`Cuota ${cuotaText} (${mes} ${anio}) actualizada con éxito.`);
      } else {
        const { error: err } = await supabase
          .from('convenio_cuotas_mensuales')
          .insert([payload]);

        if (err) throw err;
        onSuccess(`Nueva cuota mensual ${cuotaText} registrada para ${empresa}.`);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  };

  const esTrabaAdministrativa =
    Boolean(numeroGuia.trim()) &&
    (estadoUic === 'Pendiente de OC' || estadoUic === 'Sin presupuesto');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-cuota-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm ring-4 ring-blue-100">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h3 id="modal-cuota-title" className="text-base font-bold text-slate-900">
                {isEdit ? 'Editar Registro de Cuota Mensual UIC' : 'Registrar Nueva Cuota en Matriz UIC'}
              </h3>
              <p className="text-xs text-slate-500">
                Seguimiento mensual de pagos, guías de despacho, orden de compra y factura
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
              <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {esTrabaAdministrativa && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 animate-in fade-in">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block">Alerta de Traba Administrativa:</strong>
                <span>
                  Esta cuota posee guía de despacho emitida pero se encuentra en estado{' '}
                  <strong>&quot;{estadoUic}&quot;</strong>. Computará en el indicador de auditoría de deuda.
                </span>
              </div>
            </div>
          )}

          {/* Convenio Asociado */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Convenio / Contrato Asociado
            </label>
            <select
              value={convenioId}
              onChange={(e) => handleConvenioChange(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              {convenios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} — {c.nombre} ({c.empresa})
                </option>
              ))}
            </select>
          </div>

          {/* Fila 1: ESTADO UIC, MES, AÑO, CUOTA */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ESTADO UIC <span className="text-rose-500">*</span>
              </label>
              <select
                value={estadoUic}
                onChange={(e) => setEstadoUic(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                {ESTADOS_UIC.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">MES</label>
              <select
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                {MESES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">AÑO</label>
              <input
                type="number"
                value={anio}
                onChange={(e) => setAnio(parseInt(e.target.value, 10) || 2026)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">CUOTA</label>
              <input
                type="text"
                value={cuotaText}
                onChange={(e) => setCuotaText(e.target.value)}
                placeholder="ej. 1/12, Cuota 3"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Fila 2: EMPRESA, EQUIPO / SERVICIO, VALOR $ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                EMPRESA <span className="text-rose-500">*</span>
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
              <label className="block text-xs font-bold text-slate-700 mb-1">EQUIPO / SERVICIO</label>
              <input
                type="text"
                value={equipoServicio}
                onChange={(e) => setEquipoServicio(e.target.value)}
                placeholder="ej. Monitores UCI - Sala 3"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                VALOR $ (CLP) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                <input
                  type="number"
                  required
                  value={valorClp}
                  onChange={(e) => setValorClp(parseInt(e.target.value, 10) || 0)}
                  placeholder="4000000"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs font-mono font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Fila 3: N° GUIA, FECHA GUIA, CODIGO MI SSVQ, FECHA ENTREGA ABASTECIMIENTO */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">N° GUIA</label>
              <input
                type="text"
                value={numeroGuia}
                onChange={(e) => setNumeroGuia(e.target.value)}
                placeholder="ej. G-10221"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">FECHA GUIA</label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={fechaGuia}
                  onChange={(e) => setFechaGuia(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">CODIGO MI SSVQ</label>
              <div className="relative">
                <Hash className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={codigoMiSsvq}
                  onChange={(e) => setCodigoMiSsvq(e.target.value)}
                  placeholder="ej. SSVQ-MI-2026-001"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ENTREGA ABASTECIMIENTO
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={fechaEntregaAbastecimiento}
                  onChange={(e) => setFechaEntregaAbastecimiento(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Fila 4: OC, FECHA OC, ESTADO MERCADO PUBLICO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                OC (Orden de Compra)
              </label>
              <input
                type="text"
                value={ordenCompra}
                onChange={(e) => setOrdenCompra(e.target.value)}
                placeholder="ej. 2398-102-LR25"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">FECHA OC</label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={fechaOc}
                  onChange={(e) => setFechaOc(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ESTADO MERCADO PUBLICO
              </label>
              <select
                value={estadoMercadoPublico}
                onChange={(e) => setEstadoMercadoPublico(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                {ESTADOS_MERCADO_PUBLICO.map((emp) => (
                  <option key={emp} value={emp}>
                    {emp}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fila 5: N° FACTURA, FECHA FACTURA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">N° FACTURA</label>
              <div className="relative">
                <FileText className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={numeroFactura}
                  onChange={(e) => setNumeroFactura(e.target.value)}
                  placeholder="ej. F-91201"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">FECHA FACTURA</label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={fechaFactura}
                  onChange={(e) => setFechaFactura(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Observaciones / Notas UIC
            </label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Detalle administrativo, justificación o antecedentes de traba..."
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Action buttons */}
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
              id="btn-guardar-cuota"
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
                  <span>{isEdit ? 'Actualizar Cuota' : 'Registrar Cuota'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
