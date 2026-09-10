import { useState, useEffect } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  FileCheck,
  ExternalLink,
  Check,
  Trash2,
  Layers,
  HelpCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import {
  supabase,
  type Externalizacion,
  type EtapaExternalizacion,
} from '@/lib/supabase';
import {
  ETAPAS_ORDEN,
  getEtapaIndex,
  actualizarEtapaExternalizacion,
} from '@/lib/externalizacionStorage';
import { processDocumentFile } from '@/lib/fileUtils';

interface ActualizarEtapaCompraModalProps {
  open: boolean;
  onClose: () => void;
  externalizacion: Externalizacion | null;
  onUpdated: (actualizada: Externalizacion) => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

export default function ActualizarEtapaCompraModal({
  open,
  onClose,
  externalizacion,
  onUpdated,
}: ActualizarEtapaCompraModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<'cotizacion' | 'informe' | 'oc' | null>(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  // Etapa seleccionada manualmente o por avance
  const [etapaSeleccionada, setEtapaSeleccionada] = useState<EtapaExternalizacion>(
    'Cotización / Evaluación Técnica'
  );

  // Etapa 1 fields
  const [cotizacionUrl, setCotizacionUrl] = useState('');
  const [cotizacionNombre, setCotizacionNombre] = useState('');
  const [montoEstimado, setMontoEstimado] = useState('');
  const [fechaCotizacion, setFechaCotizacion] = useState('');

  // Etapa 2 fields
  const [informeReqUrl, setInformeReqUrl] = useState('');
  const [informeReqNombre, setInformeReqNombre] = useState('');
  const [informeReqFolio, setInformeReqFolio] = useState('');
  const [fechaInformeReq, setFechaInformeReq] = useState('');

  // Etapa 3 fields
  const [solicitudCompraFolio, setSolicitudCompraFolio] = useState('');
  const [solicitudCompraUrl, setSolicitudCompraUrl] = useState('');
  const [fechaSolicitudCompra, setFechaSolicitudCompra] = useState('');

  // Etapa 4 fields
  const [numeroOc, setNumeroOc] = useState('');
  const [ocUrl, setOcUrl] = useState('');
  const [ocNombre, setOcNombre] = useState('');
  const [fechaOc, setFechaOc] = useState('');
  const [fechaRecepcion, setFechaRecepcion] = useState('');

  // General notes
  const [notas, setNotas] = useState('');

  useEffect(() => {
    if (externalizacion) {
      setError(null);

      const hasOc = Boolean(externalizacion.numero_oc?.trim());
      // Si el registro figura como Finalizada pero no tiene OC, lo posicionamos en Etapa 4 para ingresar la OC
      if (externalizacion.etapa_actual === 'Finalizada / Recibida' && !hasOc) {
        setEtapaSeleccionada('En Espera de Orden de Compra');
      } else {
        setEtapaSeleccionada(externalizacion.etapa_actual);
      }

      setCotizacionUrl(externalizacion.cotizacion_url || '');
      setCotizacionNombre(externalizacion.cotizacion_nombre || '');
      setMontoEstimado(
        externalizacion.monto_estimado != null ? String(externalizacion.monto_estimado) : ''
      );
      setFechaCotizacion(externalizacion.fecha_cotizacion || '');

      setInformeReqUrl(externalizacion.informe_req_url || '');
      setInformeReqNombre(externalizacion.informe_req_nombre || '');
      setInformeReqFolio(externalizacion.informe_req_folio || '');
      setFechaInformeReq(externalizacion.fecha_informe_req || '');

      setSolicitudCompraFolio(externalizacion.solicitud_compra_folio || '');
      setSolicitudCompraUrl(externalizacion.solicitud_compra_url || '');
      setFechaSolicitudCompra(externalizacion.fecha_solicitud_compra || '');

      setNumeroOc(externalizacion.numero_oc || '');
      setOcUrl(externalizacion.oc_url || '');
      setOcNombre(externalizacion.oc_nombre || '');
      setFechaOc(externalizacion.fecha_oc || '');
      setFechaRecepcion(externalizacion.fecha_recepcion || '');

      setNotas(externalizacion.notas || '');
    }
  }, [externalizacion]);

  const currentStageIndex = getEtapaIndex(etapaSeleccionada);
  const esFinalizada = etapaSeleccionada === 'Finalizada / Recibida';

  // Reglas del ciclo de adquisición:
  // Etapa 1: Cotización / Evaluación técnica
  const isEtapa1Completa = Boolean(
    (montoEstimado || '').trim() ||
    (cotizacionUrl || '').trim() ||
    (cotizacionNombre || '').trim() ||
    fechaCotizacion ||
    (solicitudCompraFolio || '').trim() ||
    (numeroOc || '').trim()
  );

  // Etapa 2: Informe de Requerimiento Creado
  const isEtapa2Completa = Boolean(
    (informeReqFolio || '').trim() ||
    (informeReqUrl || '').trim() ||
    (informeReqNombre || '').trim() ||
    (solicitudCompraFolio || '').trim() ||
    (numeroOc || '').trim()
  );

  // Etapa 3: "la etapa 3 se completa cuando se rellenan los datos de la etapa 3 solicitud de compra tramitada"
  const isEtapa3Completa = Boolean((solicitudCompraFolio || '').trim());

  // Etapa 4: "Etapa 4 se completa cuando se rellena los datos en la etapa 4 orden de compra de mercado publico"
  const isEtapa4Completa = Boolean((numeroOc || '').trim());

  // Etapa 5: Finalizada / Recibida
  const isEtapa5Completa = etapaSeleccionada === 'Finalizada / Recibida' && isEtapa4Completa;

  const isStepCompleted = (idx: number): boolean => {
    if (idx === 0) return isEtapa1Completa;
    if (idx === 1) return isEtapa2Completa;
    if (idx === 2) return isEtapa3Completa;
    if (idx === 3) return isEtapa4Completa;
    if (idx === 4) return isEtapa5Completa;
    return false;
  };

  async function handleFileUpload(file: File, type: 'cotizacion' | 'informe' | 'oc') {
    if (!externalizacion) return;
    setError(null);
    setUploadSuccessMessage(null);
    setUploadingType(type);

    try {
      const fileName = file.name;
      let finalUrl: string | null = null;

      // Intentar subir a Supabase Storage si está configurado y accesible
      try {
        const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `externalizaciones/${externalizacion.id}/${Date.now()}-${cleanName}`;
        const { data, error: uploadErr } = await supabase.storage
          .from('mantenimientos')
          .upload(filePath, file, { upsert: true });

        if (!uploadErr && data) {
          const { data: pubData } = supabase.storage
            .from('mantenimientos')
            .getPublicUrl(filePath);
          if (pubData?.publicUrl && !pubData.publicUrl.includes('images.unsplash.com')) {
            finalUrl = pubData.publicUrl;
          }
        }
      } catch (storageErr) {
        console.warn('Storage remoto no disponible, usando almacenamiento embebido:', storageErr);
      }

      // Si no hubo storage remoto o falló, procesar localmente con fallback dataUrl
      if (!finalUrl) {
        finalUrl = await processDocumentFile(file);
      }

      // Actualizar los estados del formulario
      const fechaActual = new Date().toISOString().slice(0, 10);
      if (type === 'cotizacion') {
        setCotizacionUrl(finalUrl);
        setCotizacionNombre(fileName);
        if (!fechaCotizacion) setFechaCotizacion(fechaActual);
      } else if (type === 'informe') {
        setInformeReqUrl(finalUrl);
        setInformeReqNombre(fileName);
        if (!fechaInformeReq) setFechaInformeReq(fechaActual);
      } else if (type === 'oc') {
        setOcUrl(finalUrl);
        setOcNombre(fileName);
        if (!fechaOc) setFechaOc(fechaActual);
      }

      // Guardar de inmediato en el registro de la base de datos / storage para asegurar persistencia
      const dataToSave: Partial<Externalizacion> = {};
      if (type === 'cotizacion') {
        dataToSave.cotizacion_url = finalUrl;
        dataToSave.cotizacion_nombre = fileName;
        if (!fechaCotizacion) dataToSave.fecha_cotizacion = fechaActual;
      } else if (type === 'informe') {
        dataToSave.informe_req_url = finalUrl;
        dataToSave.informe_req_nombre = fileName;
        if (!fechaInformeReq) dataToSave.fecha_informe_req = fechaActual;
      } else if (type === 'oc') {
        dataToSave.oc_url = finalUrl;
        dataToSave.oc_nombre = fileName;
        if (!fechaOc) dataToSave.fecha_oc = fechaActual;
      }

      const res = await actualizarEtapaExternalizacion(externalizacion.id, dataToSave, false);
      if (res.success && res.externalizacion) {
        onUpdated(res.externalizacion);
      }

      setUploadSuccessMessage(`Archivo "${fileName}" cargado y vinculado al registro exitosamente.`);
      setTimeout(() => {
        setUploadSuccessMessage(null);
      }, 4500);
    } catch (err) {
      setError('Error al cargar archivo: ' + (err as Error).message);
    } finally {
      setUploadingType(null);
    }
  }

  async function handleSubmit(avanzar: boolean) {
    if (!externalizacion) return;
    setError(null);

    let targetEtapa = etapaSeleccionada;
    if (avanzar) {
      if (etapaSeleccionada === 'Cotización / Evaluación Técnica') {
        targetEtapa = 'Informe de Requerimiento Creado';
      } else if (etapaSeleccionada === 'Informe de Requerimiento Creado') {
        targetEtapa = 'Solicitud de Compra Asignada';
      } else if (etapaSeleccionada === 'Solicitud de Compra Asignada') {
        if (!solicitudCompraFolio.trim()) {
          setError('Para completar la Etapa 3 y avanzar en el ciclo, debes ingresar el N° de Folio de la Solicitud de Compra Tramitada.');
          return;
        }
        targetEtapa = 'En Espera de Orden de Compra';
      } else if (etapaSeleccionada === 'En Espera de Orden de Compra') {
        if (!numeroOc.trim()) {
          setError('Para completar la Etapa 4 y finalizar la adquisición, debes ingresar el N° de Orden de Compra de Mercado Público.');
          return;
        }
        targetEtapa = 'Finalizada / Recibida';
      } else if (etapaSeleccionada === 'Finalizada / Recibida') {
        if (!numeroOc.trim()) {
          setError('Para completar la Etapa 4 y cerrar la adquisición, debes ingresar el N° de Orden de Compra de Mercado Público.');
          return;
        }
        targetEtapa = 'Finalizada / Recibida';
      }
    } else {
      // Guardar cambios manuales en la etapa seleccionada
      if (targetEtapa === 'Finalizada / Recibida' && !numeroOc.trim()) {
        setError('No se puede guardar como "Finalizada / Recibida": la Etapa 4 requiere registrar el N° de Orden de Compra de Mercado Público.');
        return;
      }
      if (
        (targetEtapa === 'En Espera de Orden de Compra' || targetEtapa === 'Finalizada / Recibida') &&
        !solicitudCompraFolio.trim()
      ) {
        setError('Para avanzar a las etapas posteriores, debes completar primero la Etapa 3 ingresando el N° de Folio de la Solicitud de Compra.');
        return;
      }
    }

    setSaving(true);

    const dataToSave: Partial<Externalizacion> = {
      etapa_actual: targetEtapa,
      cotizacion_url: (cotizacionUrl || '').trim() || null,
      cotizacion_nombre: (cotizacionNombre || '').trim() || null,
      monto_estimado: (montoEstimado || '').trim() ? Number(montoEstimado) : null,
      fecha_cotizacion: fechaCotizacion || null,

      informe_req_url: (informeReqUrl || '').trim() || null,
      informe_req_nombre: (informeReqNombre || '').trim() || null,
      informe_req_folio: (informeReqFolio || '').trim() || null,
      fecha_informe_req: fechaInformeReq || null,

      solicitud_compra_folio: (solicitudCompraFolio || '').trim() || null,
      solicitud_compra_url: (solicitudCompraUrl || '').trim() || null,
      fecha_solicitud_compra: fechaSolicitudCompra || null,

      numero_oc: (numeroOc || '').trim() || null,
      oc_url: (ocUrl || '').trim() || null,
      oc_nombre: (ocNombre || '').trim() || null,
      fecha_oc: fechaOc || null,
      fecha_recepcion: fechaRecepcion || (targetEtapa === 'Finalizada / Recibida' ? new Date().toISOString().slice(0, 10) : null),

      notas: (notas || '').trim() || null,
    };

    const res = await actualizarEtapaExternalizacion(
      externalizacion.id,
      dataToSave,
      false
    );

    setSaving(false);

    if (!res.success) {
      setError(res.error || 'Error al actualizar etapa');
      return;
    }

    if (res.externalizacion) {
      onUpdated(res.externalizacion);
      onClose();
    }
  }

  if (!open || !externalizacion) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                {externalizacion.codigo}
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {externalizacion.tipo}
              </span>
              {externalizacion.codigo_mantenimiento && (
                <span className="font-mono text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  OT: {externalizacion.codigo_mantenimiento}
                </span>
              )}
            </div>
            <h2 className="mt-1.5 text-base font-bold text-slate-900 sm:text-lg">
              Seguimiento y Control de Adquisición
            </h2>
            <p className="text-xs text-slate-500">
              {externalizacion.equipo_identificacion || 'Solicitud Directa'} • Solicitado por:{' '}
              <span className="font-medium text-slate-700">{externalizacion.solicitante}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper interactivo de 5 etapas */}
        <div className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Progreso del Ciclo de Adquisición</span>
            <span className={esFinalizada && isEtapa4Completa ? 'font-bold text-emerald-600' : 'text-blue-600'}>
              Etapa Activa: {etapaSeleccionada}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {ETAPAS_ORDEN.map((etapa, idx) => {
              const isCompleted = isStepCompleted(idx);
              const isCurrent = etapaSeleccionada === etapa;
              const etapaLabel =
                idx === 2
                  ? 'Solicitud de Compra Tramitada'
                  : idx === 3
                    ? 'Orden de Compra Mercado Público'
                    : etapa;

              return (
                <button
                  type="button"
                  key={etapa}
                  onClick={() => {
                    if (idx === 4 && !isEtapa4Completa) {
                      setError('Para pasar a la Etapa 5 (Finalizada), primero debes completar la Etapa 4 registrando el N° de Orden de Compra de Mercado Público.');
                      return;
                    }
                    if (idx >= 3 && !isEtapa3Completa) {
                      setError('Para avanzar a esta etapa, primero debes completar la Etapa 3 ingresando el N° de Folio de la Solicitud de Compra.');
                      return;
                    }
                    setError(null);
                    setEtapaSeleccionada(etapa);
                  }}
                  className={`relative flex flex-col rounded-xl border p-2 text-left transition-all cursor-pointer ${
                    isCurrent
                      ? isCompleted
                        ? 'border-emerald-500 bg-emerald-50/90 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-blue-500 bg-blue-50 text-blue-950 ring-2 ring-blue-500/20 shadow-xs'
                      : isCompleted
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100/70'
                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        isCompleted
                          ? 'bg-emerald-600 text-white'
                          : isCurrent
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isCompleted ? <Check className="h-3 w-3" /> : idx + 1}
                    </span>
                    {isCurrent && (
                      <span
                        className={`flex h-2 w-2 rounded-full ${
                          isCompleted ? 'bg-emerald-600' : 'bg-blue-600'
                        } animate-pulse`}
                      />
                    )}
                  </div>
                  <span className="mt-1 text-[11px] font-bold leading-tight line-clamp-2">
                    {etapaLabel}
                  </span>
                  <span
                    className={`mt-1 text-[9px] font-bold uppercase tracking-wider ${
                      isCompleted
                        ? 'text-emerald-700'
                        : isCurrent
                          ? 'text-blue-700'
                          : 'text-slate-400'
                    }`}
                  >
                    {isCompleted ? 'Completada' : isCurrent ? 'En Curso' : 'Pendiente'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selector directo de Etapa */}
        <div className="border-b border-slate-200 bg-slate-50/60 px-6 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Layers className="h-4 w-4 text-blue-600" />
              <span>Etapa Activa en el Ciclo:</span>
            </div>
            <select
              value={etapaSeleccionada}
              onChange={(e) => {
                const target = e.target.value as EtapaExternalizacion;
                if (target === 'Finalizada / Recibida' && !isEtapa4Completa) {
                  setError('Para pasar a "Finalizada / Recibida", la Etapa 4 debe completarse registrando el N° de Orden de Compra.');
                  return;
                }
                if (
                  (target === 'En Espera de Orden de Compra' || target === 'Finalizada / Recibida') &&
                  !isEtapa3Completa
                ) {
                  setError('Para avanzar en el ciclo, primero debes completar la Etapa 3 ingresando el N° de Folio de la Solicitud de Compra.');
                  return;
                }
                setError(null);
                setEtapaSeleccionada(target);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {ETAPAS_ORDEN.map((etapa, idx) => {
                const label =
                  idx === 2
                    ? '3. Solicitud de Compra Tramitada'
                    : idx === 3
                      ? '4. Orden de Compra Mercado Público'
                      : `${idx + 1}. ${etapa}`;

                return (
                  <option key={etapa} value={etapa}>
                    {label} {isStepCompleted(idx) ? '✓ (Completada)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Formulario de las etapas */}
        <div className="max-h-[55vh] overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {uploadSuccessMessage && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 animate-in fade-in duration-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{uploadSuccessMessage}</div>
            </div>
          )}

          {/* Banner explicativo del ciclo */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-900 flex items-start gap-2.5">
            <HelpCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Ciclo de Adquisición y Cumplimiento:</span>
              <p className="mt-0.5 text-blue-800 leading-relaxed">
                • <strong>Etapa 3</strong> se completa cuando se rellenan los datos de la <strong>Solicitud de Compra Tramitada</strong> (N° de Folio).<br />
                • <strong>Etapa 4</strong> se completa cuando se rellenan los datos de la <strong>Orden de Compra de Mercado Público</strong> (N° de OC), habilitando el cierre final de la adquisición.
              </p>
            </div>
          </div>

          {esFinalizada && isEtapa4Completa && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span>Adquisición en Etapa Finalizada / Recibida Conforme</span>
              </div>
              <p className="mt-1 text-xs text-emerald-700">
                Con esta etapa completada, la orden de trabajo vinculada queda autorizada para emisión del informe técnico de cierre.
              </p>
            </div>
          )}

          {esFinalizada && !isEtapa4Completa && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span>Pendiente de Orden de Compra para Finalizar</span>
              </div>
              <p className="mt-1 text-xs text-amber-700">
                Para completar la Etapa 4 y consolidar el estado &quot;Finalizada / Recibida&quot;, debes registrar el N° de Orden de Compra de Mercado Público en el Bloque 4.
              </p>
            </div>
          )}

          {/* Bloque Etapa 1: Cotización / Evaluación Técnica */}
          <div className={`rounded-xl border p-4 transition-all ${
            etapaSeleccionada === 'Cotización / Evaluación Técnica'
              ? 'border-blue-300 bg-blue-50/20 ring-1 ring-blue-400/20'
              : 'border-slate-200 bg-slate-50/40'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                  1
                </span>
                <h3 className="text-sm font-bold text-slate-800">
                  Cotización / Evaluación Técnica
                </h3>
              </div>
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Opcional / Referencial
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Monto Estimado / Presupuesto Referencial (CLP $)
                </label>
                <div className="relative">
                  <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className={`${inputClass} pl-9`}
                    placeholder="Ej: 1450000 (estimado o cotizado)"
                    value={montoEstimado}
                    onChange={(e) => setMontoEstimado(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Fecha Cotización / Estimación
                </label>
                <input
                  type="date"
                  className={inputClass}
                  value={fechaCotizacion}
                  onChange={(e) => setFechaCotizacion(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Documento de Cotización Técnica del Proveedor (Opcional)
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <label
                    id="btn-subir-cotizacion"
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 cursor-pointer shadow-xs transition-all active:scale-[0.99] ${
                      uploadingType === 'cotizacion' ? 'opacity-70 pointer-events-none cursor-wait bg-slate-50' : ''
                    }`}
                  >
                    {uploadingType === 'cotizacion' ? (
                      <>
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                        <span>Subiendo archivo...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 text-blue-600" />
                        <span>Subir Cotización (PDF / Imagen)</span>
                      </>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      disabled={uploadingType !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f, 'cotizacion');
                        e.target.value = '';
                      }}
                    />
                  </label>

                  {cotizacionNombre ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900 border border-emerald-200 flex-1 min-w-0 shadow-xs">
                      <FileText className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span className="truncate flex-1 font-medium">{cotizacionNombre}</span>
                      <span className="rounded bg-emerald-200/70 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                        Guardado
                      </span>
                      {cotizacionUrl && (
                        <a
                          href={cotizacionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={cotizacionNombre}
                          className="text-emerald-700 hover:text-emerald-900 p-1"
                          title="Abrir o descargar cotización"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          setCotizacionUrl('');
                          setCotizacionNombre('');
                          if (externalizacion) {
                            const res = await actualizarEtapaExternalizacion(externalizacion.id, {
                              cotizacion_url: null,
                              cotizacion_nombre: null,
                            });
                            if (res.success && res.externalizacion) onUpdated(res.externalizacion);
                          }
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                        title="Quitar cotización del registro"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-2 rounded-lg">
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      <span>Sin cotización adjunta (en trámite o pendiente de respuesta del proveedor)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bloque Etapa 2: Informe de Requerimiento Creado */}
          <div className={`rounded-xl border p-4 transition-all ${
            etapaSeleccionada === 'Informe de Requerimiento Creado'
              ? 'border-blue-300 bg-blue-50/20 ring-1 ring-blue-400/20'
              : 'border-slate-200 bg-slate-50/40'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                2
              </span>
              <h3 className="text-sm font-bold text-slate-800">
                Informe de Requerimiento Institucional
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  N° Folio Documental / Memorándum
                </label>
                <input
                  className={inputClass}
                  placeholder="Ej: REQ-2026-0941"
                  value={informeReqFolio}
                  onChange={(e) => setInformeReqFolio(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Fecha Emisión Informe
                </label>
                <input
                  type="date"
                  className={inputClass}
                  value={fechaInformeReq}
                  onChange={(e) => setFechaInformeReq(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Adjuntar PDF del Requerimiento o Enlace Documental
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <label
                    id="btn-subir-informe-req"
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 cursor-pointer shadow-xs transition-all active:scale-[0.99] ${
                      uploadingType === 'informe' ? 'opacity-70 pointer-events-none cursor-wait bg-slate-50' : ''
                    }`}
                  >
                    {uploadingType === 'informe' ? (
                      <>
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                        <span>Subiendo archivo...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 text-blue-600" />
                        <span>Subir PDF Requerimiento</span>
                      </>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf"
                      disabled={uploadingType !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f, 'informe');
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {informeReqNombre ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900 border border-emerald-200 flex-1 min-w-0 shadow-xs">
                      <FileCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span className="truncate flex-1 font-medium">{informeReqNombre}</span>
                      <span className="rounded bg-emerald-200/70 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                        Guardado
                      </span>
                      {informeReqUrl && (
                        <a
                          href={informeReqUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={informeReqNombre}
                          className="text-emerald-700 hover:text-emerald-900 p-1"
                          title="Abrir o descargar informe PDF"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          setInformeReqUrl('');
                          setInformeReqNombre('');
                          if (externalizacion) {
                            const res = await actualizarEtapaExternalizacion(externalizacion.id, {
                              informe_req_url: null,
                              informe_req_nombre: null,
                            });
                            if (res.success && res.externalizacion) onUpdated(res.externalizacion);
                          }
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                        title="Quitar informe del registro"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">No hay PDF cargado</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bloque Etapa 3: Solicitud de Compra Asignada */}
          <div className={`rounded-xl border p-4 transition-all ${
            isEtapa3Completa
              ? 'border-emerald-300 bg-emerald-50/20'
              : etapaSeleccionada === 'Solicitud de Compra Asignada'
                ? 'border-blue-300 bg-blue-50/20 ring-1 ring-blue-400/20'
                : 'border-slate-200 bg-slate-50/40'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  isEtapa3Completa
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {isEtapa3Completa ? <Check className="h-3.5 w-3.5" /> : '3'}
                </span>
                <h3 className="text-sm font-bold text-slate-800">
                  Solicitud de Compra Tramitada
                </h3>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                isEtapa3Completa
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                {isEtapa3Completa ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    <span>Etapa 3 Completada</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-3 w-3 text-amber-600" />
                    <span>Pendiente de Folio SC (Completa Etapa 3)</span>
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  N° de Solicitud de Compra (Folio) <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  className={`${inputClass} ${isEtapa3Completa ? 'border-emerald-300 font-semibold' : ''}`}
                  placeholder="Ej: SC-2026-0881 o 4568"
                  value={solicitudCompraFolio}
                  onChange={(e) => setSolicitudCompraFolio(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  {isEtapa3Completa ? (
                    <span className="text-emerald-700 font-medium">✓ Folio ingresado. La Etapa 3 está completada y permite el avance.</span>
                  ) : (
                    <span>Al rellenar el N° de Solicitud de Compra se completa la Etapa 3.</span>
                  )}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Fecha Asignación
                </label>
                <input
                  type="date"
                  className={inputClass}
                  value={fechaSolicitudCompra}
                  onChange={(e) => setFechaSolicitudCompra(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Enlace al Gestor Documental / ERP
                </label>
                <input
                  type="url"
                  className={inputClass}
                  placeholder="https://gestiondocumental.hospital.cl/sc/12345"
                  value={solicitudCompraUrl}
                  onChange={(e) => setSolicitudCompraUrl(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Bloque Etapa 4: Orden de Compra Mercado Público */}
          <div className={`rounded-xl border p-4 transition-all ${
            isEtapa4Completa
              ? 'border-emerald-300 bg-emerald-50/20'
              : etapaSeleccionada === 'En Espera de Orden de Compra' || esFinalizada
                ? 'border-amber-300 bg-amber-50/30 ring-1 ring-amber-400/20'
                : 'border-slate-200 bg-slate-50/40'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  isEtapa4Completa
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {isEtapa4Completa ? <Check className="h-3.5 w-3.5" /> : '4'}
                </span>
                <h3 className="text-sm font-bold text-slate-800">
                  Orden de Compra Mercado Público
                </h3>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                isEtapa4Completa
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-100/80 text-amber-800 border border-amber-200'
              }`}>
                {isEtapa4Completa ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    <span>Etapa 4 Completada (OC Registrada)</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-3 w-3 text-amber-600" />
                    <span>Pendiente de N° OC (Completa Etapa 4)</span>
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  N° de Orden de Compra (OC Mercado Público) <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  className={`${inputClass} font-mono font-semibold uppercase ${
                    isEtapa4Completa ? 'text-emerald-800 border-emerald-300' : 'text-blue-700'
                  }`}
                  placeholder="Ej: 2398-105-CM26"
                  value={numeroOc}
                  onChange={(e) => setNumeroOc(e.target.value.toUpperCase())}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  {isEtapa4Completa ? (
                    <span className="text-emerald-700 font-medium">✓ N° de OC validado. La Etapa 4 está completada.</span>
                  ) : (
                    <span>Al rellenar el N° de OC se completa la Etapa 4 y se habilita la finalización.</span>
                  )}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Fecha Emisión OC
                </label>
                <input
                  type="date"
                  className={inputClass}
                  value={fechaOc}
                  onChange={(e) => setFechaOc(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Fecha de Recepción Conforme
                </label>
                <input
                  type="date"
                  className={inputClass}
                  value={fechaRecepcion}
                  onChange={(e) => setFechaRecepcion(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Documento OC Mercado Público
                </label>
                <div className="flex items-center gap-2">
                  <label
                    id="btn-subir-oc"
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:border-amber-400 hover:text-amber-800 cursor-pointer shadow-xs transition-all active:scale-[0.99] ${
                      uploadingType === 'oc' ? 'opacity-70 pointer-events-none cursor-wait bg-slate-50' : ''
                    }`}
                  >
                    {uploadingType === 'oc' ? (
                      <>
                        <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />
                        <span>Subiendo OC...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 text-amber-600" />
                        <span>Subir OC</span>
                      </>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg"
                      disabled={uploadingType !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f, 'oc');
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {ocNombre ? (
                    <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs text-emerald-900 border border-emerald-200 shadow-xs">
                      <FileCheck className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                      <span className="truncate max-w-[150px] font-medium">{ocNombre}</span>
                      <span className="rounded bg-emerald-200/70 px-1 py-0.2 text-[9px] font-bold text-emerald-800 uppercase">
                        Guardado
                      </span>
                      {ocUrl && (
                        <a
                          href={ocUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={ocNombre}
                          className="text-emerald-700 hover:text-emerald-900 p-0.5"
                          title="Abrir o descargar OC"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          setOcUrl('');
                          setOcNombre('');
                          if (externalizacion) {
                            const res = await actualizarEtapaExternalizacion(externalizacion.id, {
                              oc_url: null,
                              oc_nombre: null,
                            });
                            if (res.success && res.externalizacion) onUpdated(res.externalizacion);
                          }
                        }}
                        className="text-slate-400 hover:text-rose-600 ml-1 transition-colors"
                        title="Quitar OC del registro"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Observaciones generales */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Observaciones / Bitácora de Adquisición
            </label>
            <textarea
              className={`${inputClass} min-h-[60px] resize-y`}
              placeholder="Anota detalles relevantes de proveedores, plazos de entrega, estado de la cotización..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100 transition disabled:opacity-50"
            >
              Guardar Cambios
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit(true)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-xs transition disabled:opacity-50 ${
                (currentStageIndex === 3 && isEtapa4Completa) || (currentStageIndex === 4 && isEtapa4Completa)
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : currentStageIndex === 2 && isEtapa3Completa
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <span>
                {currentStageIndex === 2
                  ? isEtapa3Completa
                    ? 'Guardar y Avanzar a Etapa 4 (En Espera de OC)'
                    : 'Completar Etapa 3 y Avanzar a Etapa 4'
                  : currentStageIndex === 3
                    ? isEtapa4Completa
                      ? 'Guardar y Finalizar Adquisición (Etapa 5)'
                      : 'Guardar Avance en Etapa 4 (En Espera de OC)'
                    : currentStageIndex === 4
                      ? 'Guardar Adquisición Finalizada'
                      : 'Guardar y Avanzar a Siguiente Etapa'}
              </span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
