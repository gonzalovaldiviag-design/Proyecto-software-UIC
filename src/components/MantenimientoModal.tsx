import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Upload,
  FileText,
  Trash2,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Package,
  ExternalLink,
  Info,
  ShoppingBag,
  Lock,
} from 'lucide-react';
import {
  supabase,
  generarNumeroInforme,
  type Equipo,
  type Mantenimiento,
  type TipoMantenimiento,
  type EstadoMantenimiento,
  type TipoExternalizacion,
  type Externalizacion,
} from '@/lib/supabase';
import {
  findExternalizacionByMantenimiento,
  guardarExternalizacionParaMantenimiento,
  TIPOS_EXTERNALIZACION,
} from '@/lib/externalizacionStorage';
import {
  getNombreArchivo,
  compressImageToDataUrl,
  processDocumentFile,
} from '@/lib/fileUtils';
import { useAuth } from '@/lib/authContext';

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
  // Campos Informe Técnico
  numero_informe?: string | null;
  fecha_emision_informe?: string | null;
  diagnostico_final?: string | null;
  repuestos_utilizados?: string | null;
  costo?: number | null;
  requiere_externalizacion?: boolean;
  tipo_externalizacion?: TipoExternalizacion;
}

interface MantenimientoModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: MantenimientoFormData) => void;
  equipos: Equipo[];
  equipoPreseleccionado?: Equipo | null;
  mantenimientoEdicion?: Mantenimiento | null;
  onReabrir?: (mantenimiento: Mantenimiento) => void;
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
  const {
    usuarioActivo,
    puede,
    esAdmin,
    esSupervisor,
    esTecnico,
    esClinico,
  } = useAuth();

  const puedeCerrarOT = useMemo(() => {
    if (esAdmin || esSupervisor) return true;
    if (esTecnico) {
      if (!mantenimientoEdicion) return true;
      if (!mantenimientoEdicion.asignado_a) return true;
      const asig = mantenimientoEdicion.asignado_a.trim().toLowerCase();
      const yo = usuarioActivo.nombre.trim().toLowerCase();
      return asig === yo || asig.includes(yo) || yo.includes(asig);
    }
    return false;
  }, [esAdmin, esSupervisor, esTecnico, mantenimientoEdicion, usuarioActivo.nombre]);

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
  const [diagnosticoFinal, setDiagnosticoFinal] = useState('');
  const [repuestosUtilizados, setRepuestosUtilizados] = useState('');
  const [costo, setCosto] = useState('');
  const [fechaCierre, setFechaCierre] = useState('');
  const [horasHombre, setHorasHombre] = useState('');
  const [fotosUrls, setFotosUrls] = useState<string[]>([]);
  const [documentosUrls, setDocumentosUrls] = useState<string[]>([]);
  const [accesoriosAdicionales, setAccesoriosAdicionales] = useState('');
  const [completadoPor, setCompletadoPor] = useState('');
  const [recibidoPor, setRecibidoPor] = useState('');
  const [numeroInforme, setNumeroInforme] = useState<string | null>(null);
  const [fechaEmisionInforme, setFechaEmisionInforme] = useState<string | null>(null);
  const [reabiertoAviso, setReabiertoAviso] = useState<string | null>(null);

  // Estados Módulo Externalización / Adquisiciones (Línea A)
  const [requiereExternalizacion, setRequiereExternalizacion] = useState(false);
  const [tipoExternalizacion, setTipoExternalizacion] = useState<TipoExternalizacion>(
    'Compra de repuesto por Informe de requerimiento'
  );
  const [externalizacionVinculada, setExternalizacionVinculada] = useState<Externalizacion | null>(null);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const asignadoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTouched(false);
      setEstadoError('');
      setStorageNotice(null);
      setReabiertoAviso(null);
      if (mantenimientoEdicion) {
        const eq = equipos.find((e) => e.id === mantenimientoEdicion.equipo_id);
        setModoEquipo(eq ? 'registrado' : 'manual');
        setEquipoId(eq ? eq.id : '');
        setEquipoManual(eq ? '' : (mantenimientoEdicion.equipo_identificacion || ''));
        setProblema(mantenimientoEdicion.problema_reportado || '');
        setSolicitadoPor(mantenimientoEdicion.solicitado_por || '');
        setAsignadoA(mantenimientoEdicion.asignado_a ?? '');
        setFecha(mantenimientoEdicion.fecha_requerimiento || '');
        setTipo(mantenimientoEdicion.tipo_mantenimiento || 'Correctivo');
        setEstado(mantenimientoEdicion.estado_mantenimiento || 'Pendiente de Asignación');
        setDescripcionTrabajo(mantenimientoEdicion.descripcion_trabajo_realizado ?? '');
        setDiagnosticoFinal(mantenimientoEdicion.diagnostico_final ?? '');
        setRepuestosUtilizados(mantenimientoEdicion.repuestos_utilizados ?? '');
        setCosto(mantenimientoEdicion.costo != null ? String(mantenimientoEdicion.costo) : '');
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
        setNumeroInforme(mantenimientoEdicion.numero_informe ?? null);
        setFechaEmisionInforme(mantenimientoEdicion.fecha_emision_informe ?? null);

        // Cargar externalización vinculada
        findExternalizacionByMantenimiento(
          mantenimientoEdicion.id,
          mantenimientoEdicion.codigo
        )
          .then((ext) => {
            if (ext) {
              setRequiereExternalizacion(true);
              setTipoExternalizacion(ext.tipo);
              setExternalizacionVinculada(ext);
            } else {
              setRequiereExternalizacion(false);
              setTipoExternalizacion('Compra de repuesto por Informe de requerimiento');
              setExternalizacionVinculada(null);
            }
          })
          .catch(() => {
            setRequiereExternalizacion(false);
            setExternalizacionVinculada(null);
          });
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
        setSolicitadoPor(
          esClinico
            ? `${usuarioActivo.nombre}${usuarioActivo.servicio_clinico_asignado ? ` (${usuarioActivo.servicio_clinico_asignado})` : ''}`
            : ''
        );
        setAsignadoA('');
        setFecha(new Date().toISOString().slice(0, 10));
        setTipo('Correctivo');
        setEstado('Pendiente de Asignación');
        setDescripcionTrabajo('');
        setDiagnosticoFinal('');
        setRepuestosUtilizados('');
        setCosto('');
        setFechaCierre('');
        setHorasHombre('');
        setFotosUrls([]);
        setDocumentosUrls([]);
        setAccesoriosAdicionales('');
        setCompletadoPor('');
        setRecibidoPor('');
        setNumeroInforme(null);
        setFechaEmisionInforme(null);
        setRequiereExternalizacion(false);
        setTipoExternalizacion('Compra de repuesto por Informe de requerimiento');
        setExternalizacionVinculada(null);
      }
    }
  }, [open, equipos, equipoPreseleccionado, mantenimientoEdicion, esClinico, usuarioActivo.nombre, usuarioActivo.servicio_clinico_asignado]);

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
      : (equipoManual || '').trim();

  const completadoRequerido = estado === 'Completado';
  const asignadoRequerido = estado !== 'Pendiente de Asignación';

  // Validación rigurosa de campos requeridos para cierre con Informe Técnico
  const camposPendientesCierre: string[] = [];
  if (!(descripcionTrabajo || '').trim()) {
    camposPendientesCierre.push('Descripción del trabajo realizado');
  }
  if (!(diagnosticoFinal || '').trim()) {
    camposPendientesCierre.push('Diagnóstico final / Resultado de pruebas');
  }
  if (!(completadoPor || '').trim()) {
    camposPendientesCierre.push('Técnico responsable (Completado por)');
  }

  const cierreValido = camposPendientesCierre.length === 0;

  // Bloqueo de Integridad de Cierre si tiene externalización no finalizada
  const externalizacionBloqueaCierre =
    requiereExternalizacion &&
    (!externalizacionVinculada || externalizacionVinculada.etapa_actual !== 'Finalizada / Recibida');

  const valid =
    (identificacion || '').trim() !== '' &&
    (problema || '').trim() !== '' &&
    (solicitadoPor || '').trim() !== '' &&
    (!asignadoRequerido || (asignadoA || '').trim() !== '') &&
    (estado !== 'En proceso' || (asignadoA || '').trim() !== '') &&
    (!completadoRequerido || (cierreValido && !externalizacionBloqueaCierre)) &&
    (fecha || '').trim() !== '' &&
    estadoError === '';

  const correlativoProyectado =
    mantenimientoEdicion?.numero_informe ||
    numeroInforme ||
    generarNumeroInforme(mantenimientoEdicion?.codigo ?? 'MANT-001');

  function handleReabrirMantenimiento() {
    if (
      !confirm(
        '¿Confirmas la reapertura de esta orden de trabajo? Su estado cambiará a "En proceso" para permitirte modificar o corregir cualquier dato sin perder el historial previo.'
      )
    ) {
      return;
    }
    setEstado('En proceso');
    // Conservamos el correlativo asignado previamente
    setReabiertoAviso(
      'La orden de trabajo fue reabierta a "En proceso". Los campos ahora son editables para corregir datos. El correlativo técnico asignado se mantendrá al volver a completar la orden.'
    );
    setEstadoError('');
  }

  async function handlePhotoUpload(files: FileList) {
    if (fotosUrls.length >= 10) {
      setEstadoError('No se pueden subir más de 10 fotografías');
      return;
    }
    setUploadingPhoto(true);
    setEstadoError('');
    let usedLocalFallback = false;

    try {
      const newUrls: string[] = [];
      const prefix = mantenimientoEdicion?.id || `mant-${Date.now()}`;

      for (const file of Array.from(files)) {
        if (fotosUrls.length + newUrls.length >= 10) break;
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${prefix}/${Date.now()}-${cleanName}`;
        let finalUrl: string | null = null;

        // Intentar subir a Supabase Storage
        try {
          const { data, error } = await supabase.storage
            .from('mantenimientos')
            .upload(fileName, file, { upsert: true });

          if (!error && data) {
            const { data: pubData } = supabase.storage
              .from('mantenimientos')
              .getPublicUrl(fileName);
            if (pubData?.publicUrl) {
              finalUrl = pubData.publicUrl;
            }
          } else {
            console.warn('[Storage] Supabase bucket warning, fallback local:', error?.message);
          }
        } catch (storageErr) {
          console.warn('[Storage] Fallback local tras error de conexión a Supabase:', storageErr);
        }

        // Si el bucket no existe en Supabase o falló la subida remota, respaldo a DataURL comprimida
        if (!finalUrl) {
          usedLocalFallback = true;
          finalUrl = await compressImageToDataUrl(file);
        }

        newUrls.push(finalUrl);
      }

      setFotosUrls((prev) => [...prev, ...newUrls]);

      if (usedLocalFallback) {
        setStorageNotice(
          'Fotos adjuntadas y optimizadas localmente. (Nota: Si deseas guardarlas en Supabase Storage, crea el bucket público llamado "mantenimientos" en tu consola de Supabase).'
        );
      }
    } catch (err) {
      setEstadoError('Error al procesar fotografía: ' + (err as Error).message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleDocumentosUpload(files: FileList) {
    if (documentosUrls.length >= 10) {
      setEstadoError('No se pueden subir más de 10 documentos');
      return;
    }
    setUploadingDoc(true);
    setEstadoError('');
    let usedLocalFallback = false;

    try {
      const newUrls: string[] = [];
      const prefix = mantenimientoEdicion?.id || `mant-${Date.now()}`;

      for (const file of Array.from(files)) {
        if (documentosUrls.length + newUrls.length >= 10) break;
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${prefix}/doc-${Date.now()}-${cleanName}`;
        let finalUrl: string | null = null;

        // Intentar subir a Supabase Storage
        try {
          const { data, error } = await supabase.storage
            .from('mantenimientos')
            .upload(fileName, file, { upsert: true });

          if (!error && data) {
            const { data: pubData } = supabase.storage
              .from('mantenimientos')
              .getPublicUrl(fileName);
            if (pubData?.publicUrl) {
              finalUrl = pubData.publicUrl;
            }
          } else {
            console.warn('[Storage] Supabase bucket warning, fallback local:', error?.message);
          }
        } catch (storageErr) {
          console.warn('[Storage] Fallback local tras error de conexión a Supabase:', storageErr);
        }

        // Si el bucket no existe en Supabase o falló la subida remota, respaldo a DataURL
        if (!finalUrl) {
          usedLocalFallback = true;
          finalUrl = await processDocumentFile(file);
        }

        newUrls.push(finalUrl);
      }

      setDocumentosUrls((prev) => [...prev, ...newUrls]);

      if (usedLocalFallback) {
        setStorageNotice(
          'Documentos adjuntados correctamente de forma embebida. (Nota: Si deseas guardarlos en Supabase Storage, crea el bucket público llamado "mantenimientos" en tu consola de Supabase).'
        );
      }
    } catch (err) {
      setEstadoError('Error al procesar documento: ' + (err as Error).message);
    } finally {
      setUploadingDoc(false);
    }
  }

  async function removeFoto(url: string) {
    if (!url.startsWith('data:')) {
      const path = url.split('/mantenimientos/').pop();
      if (path) {
        try {
          await supabase.storage.from('mantenimientos').remove([path]);
        } catch {
          // ignore
        }
      }
    }
    setFotosUrls((prev) => prev.filter((u) => u !== url));
  }

  async function removeDocumento(url: string) {
    if (!url.startsWith('data:')) {
      const path = url.split('/mantenimientos/').pop();
      if (path) {
        try {
          await supabase.storage.from('mantenimientos').remove([path]);
        } catch {
          // ignore
        }
      }
    }
    setDocumentosUrls((prev) => prev.filter((u) => u !== url));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    if (!esEdicion && !puede('crear_solicitud_ot')) {
      setEstadoError('Tu perfil técnico no cuenta con facultades para registrar nuevos mantenimientos.');
      return;
    }

    if (estado === 'En proceso' && (asignadoA || '').trim() === '') {
      setEstadoError(
        'Para guardar en estado "En proceso" es obligatorio rellenar el campo "Asignado a (Técnico / Responsable)".'
      );
      asignadoInputRef.current?.focus();
      return;
    }

    if (asignadoRequerido && (asignadoA || '').trim() === '') {
      setEstadoError('Debes completar "Asignado a" para usar este estado');
      asignadoInputRef.current?.focus();
      return;
    }
    if (completadoRequerido && !cierreValido) {
      setEstadoError(
        `Para marcar como Completado es obligatorio completar: ${camposPendientesCierre.join(', ')}`
      );
      return;
    }
    if (completadoRequerido && externalizacionBloqueaCierre) {
      setEstadoError(
        `Bloqueo de Integridad: No es posible marcar como "Completado" ni emitir el Informe Técnico porque la adquisición externa (${externalizacionVinculada ? externalizacionVinculada.codigo + ' en etapa "' + externalizacionVinculada.etapa_actual + '"' : 'solicitud requerida'}) no está en estado "Finalizada / Recibida". Registra la Orden de Compra en el módulo de Externalización.`
      );
      return;
    }
    if (!valid) return;

    const finalEstado: EstadoMantenimiento =
      estado === 'Pendiente de Asignación' && (asignadoA || '').trim() !== ''
        ? 'En proceso'
        : estado;

    const codigoOT = mantenimientoEdicion?.codigo || 'MANT-001';
    const finalNumeroInforme =
      finalEstado === 'Completado'
        ? (mantenimientoEdicion?.numero_informe || numeroInforme || generarNumeroInforme(codigoOT))
        : (mantenimientoEdicion?.numero_informe || numeroInforme || null);

    const finalFechaEmisionInforme =
      finalEstado === 'Completado'
        ? (mantenimientoEdicion?.fecha_emision_informe || fechaEmisionInforme || new Date().toISOString())
        : (mantenimientoEdicion?.fecha_emision_informe || fechaEmisionInforme || null);

    const finalFechaCierre =
      finalEstado === 'Completado'
        ? ((fechaCierre || '').trim() || new Date().toISOString().slice(0, 10))
        : ((fechaCierre || '').trim() || null);

    onSave({
      equipo_id: modoEquipo === 'registrado' ? equipoId || null : null,
      equipo_identificacion: (identificacion || '').trim(),
      problema_reportado: (problema || '').trim(),
      solicitado_por: (solicitadoPor || '').trim(),
      asignado_a: (asignadoA || '').trim() || null,
      fecha_requerimiento: fecha,
      tipo_mantenimiento: tipo,
      estado_mantenimiento: finalEstado,
      descripcion_trabajo_realizado: (descripcionTrabajo || '').trim() || null,
      fecha_cierre: finalFechaCierre,
      horas_hombre: (horasHombre || '').trim() === '' ? null : Number(horasHombre),
      fotos_url: fotosUrls.length > 0 ? fotosUrls : null,
      documentos_url: documentosUrls.length > 0 ? documentosUrls : null,
      accesorios_adicionales: (accesoriosAdicionales || '').trim() || null,
      completado_por: (completadoPor || '').trim() || null,
      recibido_por: (recibidoPor || '').trim() || null,
      diagnostico_final: (diagnosticoFinal || '').trim() || null,
      repuestos_utilizados: (repuestosUtilizados || '').trim() || null,
      costo: (costo || '').trim() === '' ? null : Number(costo),
      numero_informe: finalNumeroInforme,
      fecha_emision_informe: finalFechaEmisionInforme,
      requiere_externalizacion: requiereExternalizacion,
      tipo_externalizacion: tipoExternalizacion,
    });

    if (requiereExternalizacion) {
      guardarExternalizacionParaMantenimiento({
        mantId: mantenimientoEdicion?.id || null,
        mantCodigo: mantenimientoEdicion?.codigo || null,
        tipo: tipoExternalizacion,
        descripcion: (problema || '').trim() || 'Compra de repuesto o servicio externo derivado de OT.',
        equipoIdentificacion: (identificacion || '').trim(),
        equipoId: modoEquipo === 'registrado' ? equipoId || null : null,
        solicitante: (solicitadoPor || '').trim(),
      }).catch((extErr) => {
        console.warn('Error sincronizando externalización vinculada:', extErr);
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {esEdicion ? `Mantenimiento ${mantenimientoEdicion.codigo}` : 'Ingreso de Mantenimiento'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {esEdicion
                ? 'Modifica la información y gestiona el cierre técnico'
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

        <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto px-6 py-5">
          {/* Banner si no tiene facultad para ingresar mantenimientos */}
          {!esEdicion && !puede('crear_solicitud_ot') && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
              <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-rose-900">Facultad de ingreso restringida</p>
                <p className="mt-1">
                  Tu rol ({usuarioActivo.rol}) no tiene autorización para generar o ingresar nuevos requerimientos de mantenimiento. Solo los servicios clínicos solicitantes o supervisores pueden originar nuevas solicitudes de OT.
                </p>
              </div>
            </div>
          )}

          {/* Banner si está completado con Informe Técnico */}
          {esEdicion && estado === 'Completado' && (
            <div className="mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-950 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">
                    Mantenimiento Cerrado con Informe Técnico
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Correlativo: <span className="font-mono font-bold text-blue-700">{correlativoProyectado}</span>
                  </div>
                </div>
              </div>
              {puede('reabrir_anular_ot') && (
                <button
                  type="button"
                  onClick={handleReabrirMantenimiento}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-amber-700 active:scale-95 whitespace-nowrap"
                  title="Reabrir esta orden de trabajo para corregir datos sin borrar el historial previo (Exclusivo Administrador)"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Reabrir Orden / Modificar Datos</span>
                </button>
              )}
            </div>
          )}

          {/* Notificación si acaba de ser reabierto */}
          {reabiertoAviso && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{reabiertoAviso}</div>
            </div>
          )}

          {/* Identificación del equipo */}
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
                Seleccionar del inventario
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
              <select
                className={inputClass}
                value={equipoId}
                onChange={(e) => setEquipoId(e.target.value)}
              >
                <option value="">Seleccione un equipo...</option>
                {equipos.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.codigo} — {eq.nombre} ({eq.serie})
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={inputClass}
                value={equipoManual}
                onChange={(e) => setEquipoManual(e.target.value)}
                placeholder="Ej: Desfibrilador Zoll R Series (SN-12345)"
              />
            )}
            {touched && !(identificacion || '').trim() && (
              <p className="mt-1 text-xs text-rose-500">Debes indicar el equipo</p>
            )}
          </div>

          {/* Problema */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Problema reportado o causa <span className="text-rose-500">*</span>
            </label>
            <textarea
              className={`${inputClass} min-h-[75px] resize-y`}
              value={problema}
              onChange={(e) => setProblema(e.target.value)}
              placeholder="Describe detalladamente la falla o motivo del requerimiento..."
            />
            {touched && !(problema || '').trim() && (
              <p className="mt-1 text-xs text-rose-500">El problema es obligatorio</p>
            )}
          </div>

          {/* Solicitado por / Asignado a */}
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Solicitado por <span className="text-rose-500">*</span>
              </label>
              <input
                className={inputClass}
                value={solicitadoPor}
                onChange={(e) => setSolicitadoPor(e.target.value)}
                placeholder="Nombre del solicitante o servicio"
              />
              {touched && !(solicitadoPor || '').trim() && (
                <p className="mt-1 text-xs text-rose-500">El solicitante es obligatorio</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Asignado a (Técnico / Responsable){' '}
                {asignadoRequerido && <span className="text-rose-500">*</span>}
              </label>
              <input
                ref={asignadoInputRef}
                className={`${inputClass} ${
                  ((touched && asignadoRequerido && !(asignadoA || '').trim()) || (estadoError && !(asignadoA || '').trim()))
                    ? '!border-rose-400 focus:!border-rose-500 focus:!ring-rose-200'
                    : ''
                }`}
                value={asignadoA}
                onChange={(e) => {
                  const val = e.target.value;
                  setAsignadoA(val);
                  setEstadoError('');
                  if ((val || '').trim() !== '') {
                    if (estado === 'Pendiente de Asignación') {
                      setEstado('En proceso');
                    }
                  } else {
                    if (estado === 'En proceso') {
                      setEstado('Pendiente de Asignación');
                    }
                  }
                }}
                placeholder="Técnico o empresa responsable"
              />
              {(asignadoA || '').trim() !== '' && estado === 'En proceso' ? (
                <p className="mt-1 flex items-center gap-1 text-xs font-medium text-blue-600">
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-blue-600" />
                  <span>Estado cambiado automáticamente a "En proceso"</span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  Requerido para pasar al estado "En proceso". Se actualiza automáticamente al escribir.
                </p>
              )}
              {touched && asignadoRequerido && !(asignadoA || '').trim() && (
                <p className="mt-1 text-xs font-medium text-rose-500">
                  Debe asignarse para avanzar al estado "{estado}"
                </p>
              )}
            </div>
          </div>

          {/* Tipo y Fecha Requerimiento */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Tipo de mantenimiento
              </label>
              <div className="flex gap-2">
                {(['Correctivo', 'Preventivo'] as TipoMantenimiento[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-all ${
                      tipo === t
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Fecha de requerimiento <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                className={inputClass}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          {/* SECCIÓN EXTERNALIZACIÓN / COMPRA EXTERNA (LÍNEA A) */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 flex-shrink-0">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span>Requiere Externalización / Compra Externa</span>
                    {requiereExternalizacion && externalizacionBloqueaCierre && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        <Lock className="h-3 w-3" /> Bloquea Cierre
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    Activar si esta OT requiere compra de repuestos clínicos o contratación de servicio tercerizado
                  </div>
                </div>
              </div>

              {/* Conmutador Switch */}
              <label className="relative inline-flex cursor-pointer items-center flex-shrink-0">
                <input
                  type="checkbox"
                  checked={requiereExternalizacion}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRequiereExternalizacion(checked);
                    setEstadoError('');
                  }}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-blue-500/20" />
                <span className="ml-2 text-xs font-semibold text-slate-700 min-w-[50px]">
                  {requiereExternalizacion ? 'Sí' : 'No'}
                </span>
              </label>
            </div>

            {requiereExternalizacion && (
              <div className="mt-4 space-y-3 pt-3 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Modalidad de compra / contratación externa <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {TIPOS_EXTERNALIZACION.map((t) => {
                      const selected = tipoExternalizacion === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTipoExternalizacion(t)}
                          className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                            selected
                              ? 'border-blue-600 bg-blue-50/90 text-blue-950 font-semibold ring-1 ring-blue-500/30 shadow-xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className="leading-snug block">{t}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Banner de Estado de Integridad */}
                {externalizacionVinculada ? (
                  externalizacionVinculada.etapa_actual === 'Finalizada / Recibida' ? (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 p-3 text-xs text-emerald-950">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        <span>Adquisición Externa Finalizada ({externalizacionVinculada.codigo})</span>
                      </div>
                      <p className="mt-1 text-emerald-800 leading-relaxed">
                        N° OC Mercado Público:{' '}
                        <strong className="font-mono font-bold text-emerald-900 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                          {externalizacionVinculada.numero_oc}
                        </strong>. La compra fue recibida conforme y la orden de trabajo está autorizada para completarse e imprimir su Informe Técnico.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-xs text-amber-950">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <Lock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                          <span>Bloqueo de Integridad de Cierre Activo</span>
                        </div>
                        <span className="font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-[11px]">
                          {externalizacionVinculada.codigo} • {externalizacionVinculada.etapa_actual}
                        </span>
                      </div>
                      <p className="mt-1.5 text-amber-900 leading-relaxed">
                        Esta orden tiene un proceso de adquisición en curso en etapa <strong>"{externalizacionVinculada.etapa_actual}"</strong>.
                        El sistema <strong>no permite marcarla como "Completado" ni generar el Informe Técnico</strong> hasta que la compra alcance el estado <strong>Finalizada / Recibida</strong> (con su N° de OC asignada).
                      </p>
                    </div>
                  )
                ) : (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-950">
                    <div className="flex items-center gap-1.5 font-semibold text-blue-800">
                      <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <span>Sincronización Automática con Módulo de Seguimiento</span>
                    </div>
                    <p className="mt-0.5 text-blue-700 leading-relaxed">
                      Al guardar esta OT, se generará de inmediato el registro en el módulo <strong>Externalización y Compras</strong> vinculado a este equipo y solicitante. El cierre técnico quedará condicionado a la recepción conforme de la compra.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Estado de la Orden de Trabajo */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Estado de la Orden de Trabajo
              </label>
              {estado === 'Completado' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Requiere Informe Técnico
                </span>
              )}
              {estado === 'En proceso' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  En proceso
                </span>
              )}
              {estado === 'Pendiente de Asignación' && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  Pendiente de Asignación
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(['Pendiente de Asignación', 'En proceso', 'Completado'] as EstadoMantenimiento[]).map(
                (est) => {
                  const completadoBloqueado =
                    est === 'Completado' &&
                    (externalizacionBloqueaCierre || !puedeCerrarOT || !puede('cerrar_emitir_informe_ot'));

                  return (
                    <button
                      key={est}
                      type="button"
                      disabled={completadoBloqueado}
                      title={
                        est === 'Completado' && !puede('cerrar_emitir_informe_ot')
                          ? 'El cierre y emisión de informe técnico está reservado al personal técnico y supervisor.'
                          : est === 'Completado' && !puedeCerrarOT
                            ? `Solo el técnico asignado (${mantenimientoEdicion?.asignado_a || 'responsable'}) o un supervisor pueden cerrar esta OT.`
                            : completadoBloqueado
                              ? `Bloqueado por integridad: La adquisición externa (${externalizacionVinculada ? externalizacionVinculada.codigo : 'asociada'}) está en etapa "${externalizacionVinculada ? externalizacionVinculada.etapa_actual : 'Cotización'}" y requiere OC.`
                              : undefined
                      }
                      onClick={() => {
                        if (est === 'En proceso' && !(asignadoA || '').trim()) {
                          setEstadoError(
                            'Para cambiar manualmente al estado "En proceso" es obligatorio rellenar el campo "Asignado a (Técnico / Responsable)".'
                          );
                          setTouched(true);
                          asignadoInputRef.current?.focus();
                          return;
                        }
                        if (est === 'Completado') {
                          if (externalizacionBloqueaCierre) {
                            setEstadoError(
                              `Bloqueo de Integridad: No puedes cambiar a "Completado". La orden tiene activa la adquisición externa vinculada en etapa "${externalizacionVinculada ? externalizacionVinculada.etapa_actual : 'Cotización / Evaluación'}". Debe completarse la Etapa 4 con su N° de OC de Mercado Público en el módulo de Externalización.`
                            );
                            setTouched(true);
                            return;
                          }
                          if (!(asignadoA || '').trim()) {
                            setEstadoError(
                              'Para cambiar al estado "Completado" es obligatorio rellenar el campo "Asignado a (Técnico / Responsable)".'
                            );
                            setTouched(true);
                            asignadoInputRef.current?.focus();
                            return;
                          }
                        }
                        setEstado(est);
                        setEstadoError('');
                        if (est === 'Completado') {
                          if (!fechaCierre) {
                            setFechaCierre(new Date().toISOString().slice(0, 10));
                          }
                          if (!completadoPor && asignadoA) {
                            setCompletadoPor(asignadoA);
                          }
                        }
                      }}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                        completadoBloqueado
                          ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                          : estado === est
                            ? est === 'Completado'
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold shadow-sm'
                              : est === 'En proceso'
                                ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold shadow-sm'
                                : 'border-amber-500 bg-amber-50 text-amber-700 font-semibold shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <span>{est}</span>
                        {completadoBloqueado && (
                          <Lock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                        )}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
            {estadoError && (
              <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-rose-600 mt-0.5" />
                <span>{estadoError}</span>
              </div>
            )}
          </div>

          {/* Sección de Cierre e Informe Técnico (cuando está en Completado o En proceso) */}
          {esEdicion && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Detalles de Cierre e Informe Técnico
                </h3>
                {estado === 'Completado' && (
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                    {correlativoProyectado}
                  </span>
                )}
              </div>

              {/* Descripción del Trabajo Realizado */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Descripción del trabajo realizado{' '}
                  {completadoRequerido && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  className={`${inputClass} min-h-[75px] resize-y`}
                  value={descripcionTrabajo}
                  onChange={(e) => {
                    setDescripcionTrabajo(e.target.value);
                    setEstadoError('');
                  }}
                  placeholder="Detalla las acciones de mantenimiento, pruebas y mediciones realizadas..."
                />
                {touched && completadoRequerido && !(descripcionTrabajo || '').trim() && (
                  <p className="mt-1 text-xs text-rose-500">
                    Obligatorio para emitir el informe técnico
                  </p>
                )}
              </div>

              {/* Diagnóstico Final y Resultado Técnico */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Resultado / Diagnóstico técnico final{' '}
                  {completadoRequerido && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  className={`${inputClass} min-h-[65px] resize-y`}
                  value={diagnosticoFinal}
                  onChange={(e) => {
                    setDiagnosticoFinal(e.target.value);
                    setEstadoError('');
                  }}
                  placeholder="Ej: Equipo verificado y calibrado según pauta. Aprobado y apto para uso clínico."
                />
                {touched && completadoRequerido && !(diagnosticoFinal || '').trim() && (
                  <p className="mt-1 text-xs text-rose-500">
                    Obligatorio para emitir el informe técnico
                  </p>
                )}
              </div>

              {/* Repuestos e Insumos / Costo */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 flex items-center gap-1">
                    <Package className="h-3.5 w-3.5 text-slate-400" />
                    Repuestos / Materiales utilizados (si aplica)
                  </label>
                  <input
                    className={inputClass}
                    value={repuestosUtilizados}
                    onChange={(e) => setRepuestosUtilizados(e.target.value)}
                    placeholder="Ej: Batería 12V, kit filtros, sellos"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                    Costo total del servicio / repuestos ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className={inputClass}
                    value={costo}
                    onChange={(e) => setCosto(e.target.value)}
                    placeholder="Ej: 120000"
                  />
                </div>
              </div>

              {/* Responsables de Cierre */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Técnico responsable (Completado por){' '}
                    {completadoRequerido && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    className={inputClass}
                    value={completadoPor}
                    onChange={(e) => {
                      setCompletadoPor(e.target.value);
                      setEstadoError('');
                    }}
                    placeholder="Nombre y apellido del técnico"
                  />
                  {touched && completadoRequerido && !(completadoPor || '').trim() && (
                    <p className="mt-1 text-xs text-rose-500">Obligatorio para la firma del informe</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Recibido por (Conformidad){' '}
                    {completadoRequerido && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    className={inputClass}
                    value={recibidoPor}
                    onChange={(e) => {
                      setRecibidoPor(e.target.value);
                      setEstadoError('');
                    }}
                    placeholder="Nombre de quien recibe conforme"
                  />
                  {touched && completadoRequerido && !(recibidoPor || '').trim() && (
                    <p className="mt-1 text-xs text-rose-500">Obligatorio para la firma de recepción</p>
                  )}
                </div>
              </div>

              {/* Fecha de realización / Horas hombre */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Fecha de realización{' '}
                    {completadoRequerido && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    value={fechaCierre}
                    onChange={(e) => {
                      setFechaCierre(e.target.value);
                      setEstadoError('');
                    }}
                  />
                  {touched && completadoRequerido && !(fechaCierre || '').trim() && (
                    <p className="mt-1 text-xs text-rose-500">Obligatorio para el informe</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Horas hombre empleadas
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    className={inputClass}
                    value={horasHombre}
                    onChange={(e) => setHorasHombre(e.target.value)}
                    placeholder="Ej: 3.5"
                  />
                </div>
              </div>

              {/* Accesorios adicionales */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Accesorios adicionales entregados
                </label>
                <input
                  className={inputClass}
                  value={accesoriosAdicionales}
                  onChange={(e) => setAccesoriosAdicionales(e.target.value)}
                  placeholder="Ej: Cable de poder, electrodos, manual de usuario"
                />
              </div>

              {/* Fotografías */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Fotografías de evidencia{' '}
                  <span className="text-xs font-normal text-slate-400">
                    ({fotosUrls.length}/10)
                  </span>
                </label>
                {fotosUrls.length < 10 && (
                  <label
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-4 text-xs text-slate-500 transition-colors hover:border-blue-400 hover:bg-blue-50/30 ${
                      uploadingPhoto ? 'pointer-events-none opacity-60' : ''
                    }`}
                  >
                    {uploadingPhoto ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <span>Subiendo fotografías...</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="h-4 w-4 text-slate-400" />
                        <span>Click para adjuntar fotos</span>
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
                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    {fotosUrls.map((url) => (
                      <div
                        key={url}
                        className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                      >
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block h-16 w-full cursor-zoom-in"
                          title="Click para ver en tamaño completo"
                        >
                          <img
                            src={url}
                            alt="Evidencia fotográfica"
                            className="h-16 w-full object-cover transition-transform group-hover:scale-105"
                          />
                        </a>
                        <button
                          type="button"
                          onClick={() => removeFoto(url)}
                          className="absolute right-1 top-1 rounded-md bg-rose-600/90 p-1 text-white opacity-0 transition group-hover:opacity-100 shadow"
                          aria-label="Eliminar foto"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Documentos adjuntos */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Documentos externos adjuntos{' '}
                  <span className="text-xs font-normal text-slate-400">
                    ({documentosUrls.length}/10)
                  </span>
                </label>
                {documentosUrls.length < 10 && (
                  <label
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-4 text-xs text-slate-500 transition-colors hover:border-blue-400 hover:bg-blue-50/30 ${
                      uploadingDoc ? 'pointer-events-none opacity-60' : ''
                    }`}
                  >
                    {uploadingDoc ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <span>Subiendo documentos...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 text-slate-400" />
                        <span>Click para adjuntar archivos (PDF, DOC, XLS)</span>
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
                  <div className="mt-2.5 space-y-2">
                    {documentosUrls.map((url) => {
                      const name = getNombreArchivo(url);
                      return (
                        <div
                          key={url}
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs hover:border-slate-300 transition-colors"
                        >
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={name}
                            className="flex items-center gap-2 text-slate-700 hover:text-blue-600 truncate font-medium group"
                            title="Click para ver o descargar"
                          >
                            <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            <span className="truncate max-w-[280px] sm:max-w-md">{name}</span>
                            <ExternalLink className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </a>
                          <button
                            type="button"
                            onClick={() => removeDocumento(url)}
                            className="rounded p-1 text-slate-400 hover:text-rose-600 transition-colors flex-shrink-0"
                            aria-label="Eliminar documento"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Aviso informativo de almacenamiento local / Supabase */}
                {storageNotice && (
                  <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50/80 p-2.5 text-xs text-blue-900 shadow-sm">
                    <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 text-[11px] leading-relaxed">
                      <span>{storageNotice}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStorageNotice(null)}
                      className="text-blue-400 hover:text-blue-700 p-0.5"
                      aria-label="Cerrar aviso"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Callout de Validación para Cerrar con Informe */}
              {estado === 'Completado' && (
                <div
                  className={`rounded-xl border p-3.5 text-xs transition-all ${
                    cierreValido
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : 'border-amber-300 bg-amber-50 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {cierreValido ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    )}
                    <span>
                      {cierreValido
                        ? 'Listo para emitir Informe Técnico'
                        : 'Campos obligatorios pendientes para emitir Informe Técnico:'}
                    </span>
                  </div>
                  {cierreValido ? (
                    <p className="mt-1 text-emerald-700">
                      Al guardar se generará y certificará el informe{' '}
                      <strong className="font-mono">{correlativoProyectado}</strong> con fecha/hora oficial de emisión y firmas.
                    </p>
                  ) : (
                    <ul className="mt-1.5 list-disc list-inside space-y-0.5 text-amber-800">
                      {camposPendientesCierre.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
            {esEdicion && estado === 'Completado' && (
              <button
                type="button"
                onClick={handleReabrirMantenimiento}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-800 shadow-sm transition hover:bg-amber-100 active:scale-95 mr-auto"
                title="Reabrir orden de trabajo y pasar a 'En proceso' para corregir datos"
              >
                <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
                <span>Reabrir Orden / Modificar Datos</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                (estado === 'Completado' && !cierreValido) ||
                (!esEdicion && !puede('crear_solicitud_ot'))
              }
              className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm transition-all active:scale-[0.98] ${
                (!esEdicion && !puede('crear_solicitud_ot'))
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : estado === 'Completado'
                    ? cierreValido
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {estado === 'Completado' ? (
                <>
                  <FileText className="h-4 w-4" />
                  <span>
                    {mantenimientoEdicion?.estado_mantenimiento === 'Completado'
                      ? 'Actualizar Informe Técnico'
                      : 'Generar y Cerrar con Informe Técnico'}
                  </span>
                </>
              ) : esEdicion ? (
                'Guardar cambios'
              ) : (
                'Registrar mantenimiento'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
