import { useEffect, useState } from 'react';
import { X, Upload, FileText, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Equipo, Mantenimiento, TipoMantenimiento, EstadoMantenimiento } from '@/lib/supabase';

export interface MantenimientoFormData {
  equipo_id: string | null;
  equipo_identificacion: string;
  problema_reportado: string;
  solicitado_por: string;
  asignado_a: string | null;
  fecha_requerimiento: string;
  tipo_mantenimiento: TipoMantenimiento;
  estado_mantenimiento: EstadoMantenimiento;
  descripcion_trabajo_realizado: string | null;
  fecha_cierre: string | null;
  horas_hombre: number | null;
  fotos_url: string[] | null;
  documentos_url: string[] | null;
  accesorios_adicionales: string | null;
  completado_por: string | null;
  recibido_por: string | null;
}

interface MantenimientoModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: MantenimientoFormData) => void;
  equipos: Equipo[];
  equipoPreseleccionado?: Equipo | null;
  mantenimientoEdicion?: Mantenimiento | null;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

export default function MantenimientoModal({
  open,
  onClose,
  onSave,
  equipos,
  equipoPreseleccionado,
  mantenimientoEdicion,
}: MantenimientoModalProps) {
  const esEdicion = mantenimientoEdicion != null;
  const [modoEquipo, setModoEquipo] = useState<'registrado' | 'manual'>('registrado');
  const [equipoId, setEquipoId] = useState('');
  const [equipoManual, setEquipoManual] = useState('');
  const [problema, setProblema] = useState('');
  const [solicitadoPor, setSolicitadoPor] = useState('');
  const [asignadoA, setAsignadoA] = useState('');
  const [fecha, setFecha] = useState('');
  const [tipo, setTipo] = useState<TipoMantenimiento>('Correctivo');
  const [estado, setEstado] = useState<EstadoMantenimiento>('Pendiente de Asignación');
  const [estadoError, setEstadoError] = useState('');
  const [descripcionTrabajo, setDescripcionTrabajo] = useState('');
  const [fechaCierre, setFechaCierre] = useState('');
  const [horasHombre, setHorasHombre] = useState('');
  const [fotosUrls, setFotosUrls] = useState<string[]>([]);
  const [documentosUrls, setDocumentosUrls] = useState<string[]>([]);
  const [accesoriosAdicionales, setAccesoriosAdicionales] = useState('');
  const [completadoPor, setCompletadoPor] = useState('');
  const [recibidoPor, setRecibidoPor] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setTouched(false);
      if (mantenimientoEdicion) {
        const eq = equipos.find((e) => e.id === mantenimientoEdicion.equipo_id);
        setModoEquipo(eq ? 'registrado' : 'manual');
        setEquipoId(eq ? eq.id : '');
        setEquipoManual(eq ? '' : mantenimientoEdicion.equipo_identificacion);
        setProblema(mantenimientoEdicion.problema_reportado);
        setSolicitadoPor(mantenimientoEdicion.solicitado_por);
        setAsignadoA(mantenimientoEdicion.asignado_a ?? '');
        setFecha(mantenimientoEdicion.fecha_requerimiento);
        setTipo(mantenimientoEdicion.tipo_mantenimiento);
        setEstado(mantenimientoEdicion.estado_mantenimiento);
        setDescripcionTrabajo(mantenimientoEdicion.descripcion_trabajo_realizado ?? '');
        setFechaCierre(mantenimientoEdicion.fecha_cierre ?? '');
        setHorasHombre(
          mantenimientoEdicion.horas_hombre != null
            ? String(mantenimientoEdicion.horas_hombre)
            : ''
        );
        setFotosUrls(mantenimientoEdicion.fotos_url ?? []);
        setDocumentosUrls(mantenimientoEdicion.documentos_url ?? []);
        setAccesoriosAdicionales(mantenimientoEdicion.accesorios_adicionales ?? '');
        setCompletadoPor(mantenimientoEdicion.completado_por ?? '');
        setRecibidoPor(mantenimientoEdicion.recibido_por ?? '');
      } else {
        setModoEquipo('registrado');
        setEquipoId(
          equipoPreseleccionado
            ? equipoPreseleccionado.id
            : equipos.length > 0
              ? equipos[0].id
              : ''
        );
        setEquipoManual('');
        setProblema('');
        setSolicitadoPor('');
        setAsignadoA('');
        setFecha(new Date().toISOString().slice(0, 10));
        setTipo('Correctivo');
        setEstado('Pendiente de Asignación');
        setDescripcionTrabajo('');
        setFechaCierre('');
        setHorasHombre('');
        setFotosUrls([]);
        setDocumentosUrls([]);
        setAccesoriosAdicionales('');
        setCompletadoPor('');
        setRecibidoPor('');
      }
    }
  }, [open, equipos, equipoPreseleccionado, mantenimientoEdicion]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const equipoSeleccionado = equipos.find((e) => e.id === equipoId);
  const identificacion =
    modoEquipo === 'registrado'
      ? equipoSeleccionado
        ? `${equipoSeleccionado.codigo} — ${equipoSeleccionado.nombre}`
        : ''
      : equipoManual.trim();

  const completadoRequerido = estado === 'Completado';

  const canTransitionTo = (target: EstadoMantenimiento): boolean => {
    if (target === 'En proceso') {
      return (
        (estado === 'Pendiente de Asignación' || estado === 'Completado') &&
        asignadoA.trim() !== ''
      );
    }
    if (target === 'Completado') {
      return (
        estado === 'En proceso' &&
        completadoPor.trim() !== '' &&
        recibidoPor.trim() !== ''
      );
    }
    return false;
  };

  const asignadoRequerido = estado !== 'Pendiente de Asignación';

  const valid =
    identificacion.trim() !== '' &&
    problema.trim() !== '' &&
    solicitadoPor.trim() !== '' &&
    (!asignadoRequerido || asignadoA.trim() !== '') &&
    (!completadoRequerido || (completadoPor.trim() !== '' && recibidoPor.trim() !== '')) &&
    fecha.trim() !== '' &&
    estadoError === '';

  async function handlePhotoUpload(files: FileList) {
    if (!mantenimientoEdicion) return;
    if (fotosUrls.length >= 10) {
      setEstadoError('No se pueden subir más de 10 fotografías');
      return;
    }
    setUploadingPhoto(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        if (fotosUrls.length + newUrls.length >= 10) break;
        const ext = file.name.split('.').pop() ?? 'jpg';
        const fileName = `${mantenimientoEdicion.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from('mantenimientos')
          .upload(fileName, file);
        if (error) throw error;
        const { data: pubData } = supabase.storage
          .from('mantenimientos')
          .getPublicUrl(fileName);
        newUrls.push(pubData.publicUrl);
      }
      setFotosUrls((prev) => [...prev, ...newUrls]);
    } catch (err) {
      setEstadoError('Error al subir la foto: ' + (err as Error).message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleDocumentosUpload(files: FileList) {
    if (!mantenimientoEdicion) return;
    if (documentosUrls.length >= 10) {
      setEstadoError('No se pueden subir más de 10 documentos');
      return;
    }
    setUploadingDoc(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        if (documentosUrls.length + newUrls.length >= 10) break;
        const ext = file.name.split('.').pop() ?? 'pdf';
        const fileName = `${mantenimientoEdicion.id}/doc-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from('mantenimientos')
          .upload(fileName, file);
        if (error) throw error;
        const { data: pubData } = supabase.storage
          .from('mantenimientos')
          .getPublicUrl(fileName);
        newUrls.push(pubData.publicUrl);
      }
      setDocumentosUrls((prev) => [...prev, ...newUrls]);
    } catch (err) {
      setEstadoError('Error al subir el documento: ' + (err as Error).message);
    } finally {
      setUploadingDoc(false);
    }
  }

  async function removeFoto(url: string) {
    const path = url.split('/mantenimientos/').pop();
    if (path) {
      await supabase.storage.from('mantenimientos').remove([path]);
    }
    setFotosUrls((prev) => prev.filter((u) => u !== url));
  }

  async function removeDocumento(url: string) {
    const path = url.split('/mantenimientos/').pop();
    if (path) {
      await supabase.storage.from('mantenimientos').remove([path]);
    }
    setDocumentosUrls((prev) => prev.filter((u) => u !== url));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (asignadoRequerido && asignadoA.trim() === '') {
      setEstadoError('Debes completar "Asignado a" para usar este estado');
      return;
    }
    if (completadoRequerido && (completadoPor.trim() === '' || recibidoPor.trim() === '')) {
      setEstadoError('Debes completar "Completado por" y "Recibido por" para marcar como Completado');
      return;
    }
    if (!valid) return;
    onSave({
      equipo_id: modoEquipo === 'registrado' ? equipoId || null : null,
      equipo_identificacion: identificacion.trim(),
      problema_reportado: problema.trim(),
      solicitado_por: solicitadoPor.trim(),
      asignado_a: asignadoA.trim() || null,
      fecha_requerimiento: fecha,
      tipo_mantenimiento: tipo,
      estado_mantenimiento: estado,
      descripcion_trabajo_realizado: descripcionTrabajo.trim() || null,
      fecha_cierre: fechaCierre || null,
      horas_hombre: horasHombre.trim() === '' ? null : Number(horasHombre),
      fotos_url: fotosUrls.length > 0 ? fotosUrls : null,
      documentos_url: documentosUrls.length > 0 ? documentosUrls : null,
      accesorios_adicionales: accesoriosAdicionales.trim() || null,
      completado_por: completadoPor.trim() || null,
      recibido_por: recibidoPor.trim() || null,
    });
  };

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
              {esEdicion ? 'Editar Mantenimiento' : 'Ingreso de Mantenimiento'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {esEdicion
                ? 'Modifica la información del requerimiento'
                : 'Registra un nuevo requerimiento de mantenimiento'}
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

        <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {/* Identificacion del equipo */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Identificación del equipo <span className="text-rose-500">*</span>
            </label>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => setModoEquipo('registrado')}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  modoEquipo === 'registrado'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Equipo registrado
              </button>
              <button
                type="button"
                onClick={() => setModoEquipo('manual')}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  modoEquipo === 'manual'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Ingresar manualmente
              </button>
            </div>
            {modoEquipo === 'registrado' ? (
              equipos.length === 0 ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  No hay equipos registrados. Selecciona "Ingresar manualmente".
                </p>
              ) : (
                <select
                  className={inputClass}
                  value={equipoId}
                  onChange={(e) => setEquipoId(e.target.value)}
                >
                  {equipos.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.codigo} — {e.nombre}
                    </option>
                  ))}
                </select>
              )
            ) : (
              <input
                className={inputClass}
                value={equipoManual}
                onChange={(e) => setEquipoManual(e.target.value)}
                placeholder="Ej: EQ-999 — Monitor portátil"
              />
            )}
            {touched && identificacion.trim() === '' && (
              <p className="mt-1 text-xs text-rose-500">
                La identificación del equipo es obligatoria
              </p>
            )}
          </div>

          {/* Tipo de mantenimiento */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Tipo de mantenimiento <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => !esEdicion && setTipo('Correctivo')}
                disabled={esEdicion}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                  tipo === 'Correctivo'
                    ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                } ${esEdicion ? 'cursor-not-allowed opacity-80' : ''}`}
              >
                Mantenimiento Correctivo
              </button>
              <button
                type="button"
                onClick={() => !esEdicion && setTipo('Preventivo')}
                disabled={esEdicion}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                  tipo === 'Preventivo'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                } ${esEdicion ? 'cursor-not-allowed opacity-80' : ''}`}
              >
                Mantenimiento Preventivo
              </button>
            </div>
          </div>

          {/* Problema reportado */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Problema reportado <span className="text-rose-500">*</span>
            </label>
            <textarea
              className={`${inputClass} min-h-[80px] resize-y`}
              value={problema}
              onChange={(e) => setProblema(e.target.value)}
              placeholder="Describe el problema reportado..."
            />
            {touched && !problema.trim() && (
              <p className="mt-1 text-xs text-rose-500">El problema reportado es obligatorio</p>
            )}
          </div>

          {/* Accesorios o adicionales */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Accesorios o adicionales
            </label>
            <textarea
              className={`${inputClass} min-h-[80px] resize-y`}
              value={accesoriosAdicionales}
              onChange={(e) => setAccesoriosAdicionales(e.target.value)}
              placeholder="Describe los accesorios o componentes adicionales..."
            />
          </div>

          {/* Solicitado por */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Solicitado por <span className="text-rose-500">*</span>
            </label>
            <input
              className={inputClass}
              value={solicitadoPor}
              onChange={(e) => setSolicitadoPor(e.target.value)}
              placeholder="Nombre de quien solicita"
            />
            {touched && !solicitadoPor.trim() && (
              <p className="mt-1 text-xs text-rose-500">Este campo es obligatorio</p>
            )}
          </div>

          {/* Asignado a (solo edición) */}
          {esEdicion && (
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Asignado a {asignadoRequerido && <span className="text-rose-500">*</span>}
              </label>
              <input
                className={inputClass}
                value={asignadoA}
                onChange={(e) => {
                  setAsignadoA(e.target.value);
                  setEstadoError('');
                }}
                placeholder="Nombre del responsable"
              />
              {touched && asignadoRequerido && !asignadoA.trim() && (
                <p className="mt-1 text-xs text-rose-500">Este campo es obligatorio</p>
              )}
              {estado === 'Pendiente de Asignación' && asignadoA.trim() === '' && (
                <p className="mt-1 text-xs text-slate-400">
                  Completa este campo para poder cambiar el estado a "En proceso"
                </p>
              )}
            </div>
          )}

          {/* Fecha */}
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Fecha de requerimiento <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              className={inputClass}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
            {touched && !fecha.trim() && (
              <p className="mt-1 text-xs text-rose-500">La fecha es obligatoria</p>
            )}
          </div>

          {/* Estado (solo edición) */}
          {esEdicion && (
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Estado de mantenimiento
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(['Pendiente de Asignación', 'En proceso', 'Completado'] as EstadoMantenimiento[]).map((est) => {
                  const disabled = estado !== est && !canTransitionTo(est);
                  return (
                    <button
                      key={est}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setEstado(est);
                        setEstadoError('');
                        if (est === 'Completado' && !fechaCierre) {
                          setFechaCierre(new Date().toISOString().slice(0, 10));
                        }
                      }}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                        estado === est
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                          : disabled
                            ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {est}
                    </button>
                  );
                })}
              </div>
              {estadoError && (
                <p className="mt-1.5 text-xs text-rose-500">{estadoError}</p>
              )}
              {estado === 'En proceso' && (completadoPor.trim() === '' || recibidoPor.trim() === '') && (
                <p className="mt-1.5 text-xs text-slate-400">
                  Completa "Completado por" y "Recibido por" para poder cambiar el estado a "Completado"
                </p>
              )}
            </div>
          )}

          {/* Campos de cierre (solo edición) */}
          {esEdicion && (
            <>
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Descripción del trabajo realizado
                </label>
                <textarea
                  className={`${inputClass} min-h-[80px] resize-y`}
                  value={descripcionTrabajo}
                  onChange={(e) => setDescripcionTrabajo(e.target.value)}
                  placeholder="Describe el trabajo realizado..."
                />
              </div>

              {/* Fotografías */}
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Fotografías
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    ({fotosUrls.length}/10)
                  </span>
                </label>
                {estado !== 'Completado' && fotosUrls.length < 10 && (
                  <label
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 transition-colors hover:border-blue-400 hover:bg-blue-50/30 ${
                      uploadingPhoto ? 'pointer-events-none opacity-60' : ''
                    }`}
                  >
                    {uploadingPhoto ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Subiendo...</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="h-4 w-4" />
                        <span>Click para subir fotografías</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && handlePhotoUpload(e.target.files)}
                    />
                  </label>
                )}
                {fotosUrls.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {fotosUrls.map((url) => (
                      <div key={url} className="group relative overflow-hidden rounded-lg border border-slate-200">
                        <img src={url} alt="Foto mantenimiento" className="h-20 w-full object-cover" />
                        {estado !== 'Completado' && (
                          <button
                            type="button"
                            onClick={() => removeFoto(url)}
                            className="absolute right-1 top-1 rounded-md bg-rose-500/80 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                            aria-label="Eliminar foto"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Documentos / informes externos */}
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Documentos o informes externos
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    ({documentosUrls.length}/10)
                  </span>
                </label>
                {estado !== 'Completado' && documentosUrls.length < 10 && (
                  <label
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 transition-colors hover:border-blue-400 hover:bg-blue-50/30 ${
                      uploadingDoc ? 'pointer-events-none opacity-60' : ''
                    }`}
                  >
                    {uploadingDoc ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Subiendo...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        <span>Click para subir documentos</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && handleDocumentosUpload(e.target.files)}
                    />
                  </label>
                )}
                {documentosUrls.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {documentosUrls.map((url) => {
                      const name = url.split('/').pop() ?? 'documento';
                      return (
                        <div
                          key={url}
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span className="truncate max-w-[200px]">{name}</span>
                          </div>
                          {estado !== 'Completado' && (
                            <button
                              type="button"
                              onClick={() => removeDocumento(url)}
                              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              aria-label="Eliminar documento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Completado por / Recibido por */}
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Completado por {completadoRequerido && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    className={inputClass}
                    value={completadoPor}
                    onChange={(e) => {
                      setCompletadoPor(e.target.value);
                      setEstadoError('');
                    }}
                    placeholder="Nombre de quien completa el trabajo"
                  />
                  {touched && completadoRequerido && !completadoPor.trim() && (
                    <p className="mt-1 text-xs text-rose-500">Este campo es obligatorio</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Recibido por {completadoRequerido && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    className={inputClass}
                    value={recibidoPor}
                    onChange={(e) => {
                      setRecibidoPor(e.target.value);
                      setEstadoError('');
                    }}
                    placeholder="Nombre de quien recibe el trabajo"
                  />
                  {touched && completadoRequerido && !recibidoPor.trim() && (
                    <p className="mt-1 text-xs text-rose-500">Este campo es obligatorio</p>
                  )}
                </div>
              </div>

              {/* Fecha de cierre / Horas hombre */}
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Fecha de cierre de trabajo
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    value={fechaCierre}
                    onChange={(e) => setFechaCierre(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Horas hombre utilizadas
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    className={inputClass}
                    value={horasHombre}
                    onChange={(e) => setHorasHombre(e.target.value)}
                    placeholder="Ej: 4.5"
                  />
                </div>
              </div>
            </>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow active:scale-[0.98]"
            >
              {esEdicion ? 'Guardar cambios' : 'Registrar mantenimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
