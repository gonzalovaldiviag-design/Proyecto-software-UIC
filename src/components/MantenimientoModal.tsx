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
  Search,
  ChevronDown,
  Check,
  Clock,
  Send,
  Bell,
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
  saveMantenimientoRecord,
} from '@/lib/mantenimientoStorage';
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
  estado_solicitud_externalizacion?: 'Ninguna' | 'Pendiente_Aprobacion' | 'Aprobada' | 'Rechazada' | null;
  motivo_externalizacion?: string | null;
  externalizacion_solicitada_por?: string | null;
  solicitante_externalizacion?: string | null;
  externalizacion_resuelta_por?: string | null;
}

interface MantenimientoModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: MantenimientoFormData) => void | Promise<unknown>;
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
    usuarios,
    puede,
    esAdmin,
    esSupervisor,
  } = useAuth();

  const usuarioActual = usuarioActivo;
  const esTecnico = usuarioActual?.rol === 'Ingeniero de Servicio / Técnico';
  const esRolTecnico = esTecnico;

  const usuariosAsignables = useMemo(() => {
    return (usuarios || []).filter((u) => {
      if (u.activo === false) return false;
      const rolLower = (u.rol || '').toLowerCase();
      const cargoLower = (u.cargo || '').toLowerCase();
      return (
        u.rol === 'Ingeniero Supervisor' ||
        u.rol === 'Ingeniero de Servicio / Técnico' ||
        rolLower.includes('supervisor') ||
        rolLower.includes('técnico') ||
        rolLower.includes('tecnico') ||
        cargoLower.includes('supervisor') ||
        cargoLower.includes('técnico') ||
        cargoLower.includes('tecnico')
      );
    });
  }, [usuarios]);

  const puedeCerrarOT = useMemo(() => {
    if (esAdmin || esSupervisor) return true;
    if (esTecnico) {
      if (!mantenimientoEdicion) return true;
      const asignadoVal = (mantenimientoEdicion.asignado_a || '').trim().toLowerCase();
      if (!asignadoVal) return true;
      const yo = (usuarioActivo?.nombre || '').trim().toLowerCase();
      return asignadoVal === yo || asignadoVal.includes(yo) || yo.includes(asignadoVal);
    }
    return false;
  }, [esAdmin, esSupervisor, esTecnico, mantenimientoEdicion, usuarioActivo?.nombre]);

  const esEdicion = mantenimientoEdicion != null;

  const solicitanteSesionActiva = useMemo(() => {
    if (!usuarioActivo?.nombre) return '';
    return usuarioActivo.servicio_clinico_asignado
      ? `${usuarioActivo.nombre} (${usuarioActivo.servicio_clinico_asignado})`
      : usuarioActivo.nombre;
  }, [usuarioActivo]);

  const [modoEquipo, setModoEquipo] = useState<'registrado' | 'manual'>('registrado');
  const [equipoId, setEquipoId] = useState('');
  const [equipoManual, setEquipoManual] = useState('');
  const [problema, setProblema] = useState('');
  const [solicitadoPor, setSolicitadoPor] = useState(solicitanteSesionActiva);
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
  const [estadoSolicitudExternalizacion, setEstadoSolicitudExternalizacion] = useState<
    'Ninguna' | 'Pendiente_Aprobacion' | 'Aprobada' | 'Rechazada' | null
  >(null);
  const [motivoExternalizacion, setMotivoExternalizacion] = useState('');
  const [externalizacionSolicitadaPor, setExternalizacionSolicitadaPor] = useState('');
  const [externalizacionResueltaPor, setExternalizacionResueltaPor] = useState('');

  // Modal de Justificación Técnica
  const [modalJustificacionOpen, setModalJustificacionOpen] = useState(false);
  const [motivoInput, setMotivoInput] = useState('');
  const [tipoExtInput, setTipoExtInput] = useState<TipoExternalizacion>(
    'Compra de repuesto por Informe de requerimiento'
  );
  const [justificacionError, setJustificacionError] = useState('');
  const [solicitudEnviadaAviso, setSolicitudEnviadaAviso] = useState<string | null>(null);

  // Modal y estado de Resolución de Supervisor (Aprobación / Rechazo)
  const [modalRechazoOpen, setModalRechazoOpen] = useState(false);
  const [motivoRechazoInput, setMotivoRechazoInput] = useState('');
  const [procesandoAccionSupervisor, setProcesandoAccionSupervisor] = useState(false);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const asignadoInputRef = useRef<HTMLButtonElement>(null);
  const [asignadoDropdownOpen, setAsignadoDropdownOpen] = useState(false);
  const [asignadoBusqueda, setAsignadoBusqueda] = useState('');
  const asignadoContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filtrado reactivo de técnicos y supervisores por término de búsqueda
  const usuariosAsignablesFiltrados = useMemo(() => {
    const q = (asignadoBusqueda || '').trim().toLowerCase();
    if (!q) return usuariosAsignables;
    return usuariosAsignables.filter((u) => {
      const nombre = (u.nombre || '').toLowerCase();
      const rol = (u.rol || '').toLowerCase();
      const cargo = (u.cargo || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return nombre.includes(q) || rol.includes(q) || cargo.includes(q) || email.includes(q);
    });
  }, [usuariosAsignables, asignadoBusqueda]);

  const seleccionarAsignado = (val: string) => {
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
    setAsignadoDropdownOpen(false);
    setAsignadoBusqueda('');
  };

  // Cerrar dropdown al hacer clic fuera del componente
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        asignadoContainerRef.current &&
        !asignadoContainerRef.current.contains(event.target as Node)
      ) {
        setAsignadoDropdownOpen(false);
      }
    }
    if (asignadoDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [asignadoDropdownOpen]);

  // Autofoco al abrir el buscador interno
  useEffect(() => {
    if (asignadoDropdownOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setAsignadoBusqueda('');
    }
  }, [asignadoDropdownOpen]);

  useEffect(() => {
    if (open) {
      setTouched(false);
      setEstadoError('');
      setStorageNotice(null);
      setReabiertoAviso(null);
      setAsignadoDropdownOpen(false);
      setAsignadoBusqueda('');
      if (mantenimientoEdicion) {
        const eq = equipos.find((e) => e.id === mantenimientoEdicion.equipo_id);
        setModoEquipo(eq ? 'registrado' : 'manual');
        setEquipoId(eq ? eq.id : '');
        setEquipoManual(eq ? '' : (mantenimientoEdicion.equipo_identificacion || ''));
        setProblema(mantenimientoEdicion.problema_reportado || '');
        setSolicitadoPor(mantenimientoEdicion.solicitado_por || solicitanteSesionActiva);
        const asignadoOriginal = mantenimientoEdicion.asignado_a ?? '';
        setAsignadoA(
          esRolTecnico && !asignadoOriginal ? (usuarioActivo?.nombre || '') : asignadoOriginal
        );
        setFecha(mantenimientoEdicion.fecha_requerimiento || '');
        setTipo(mantenimientoEdicion.tipo_mantenimiento || 'Correctivo');
        const estOriginal = mantenimientoEdicion.estado_mantenimiento || 'Pendiente de Asignación';
        setEstado(esRolTecnico && estOriginal === 'Pendiente de Asignación' ? 'En proceso' : estOriginal);
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
        setCompletadoPor(
          mantenimientoEdicion.completado_por ||
            (esRolTecnico ? (asignadoOriginal || usuarioActivo?.nombre || '') : '')
        );
        setRecibidoPor(mantenimientoEdicion.recibido_por ?? '');
        setNumeroInforme(mantenimientoEdicion.numero_informe ?? null);
        setFechaEmisionInforme(mantenimientoEdicion.fecha_emision_informe ?? null);
        setEstadoSolicitudExternalizacion(mantenimientoEdicion.estado_solicitud_externalizacion ?? null);
        setMotivoExternalizacion(mantenimientoEdicion.motivo_externalizacion ?? '');
        setExternalizacionSolicitadaPor(mantenimientoEdicion.externalizacion_solicitada_por ?? '');
        setExternalizacionResueltaPor(mantenimientoEdicion.externalizacion_resuelta_por ?? '');
        setSolicitudEnviadaAviso(null);
        setJustificacionError('');

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
              const req = Boolean(mantenimientoEdicion.requiere_externalizacion);
              setRequiereExternalizacion(req);
              if (mantenimientoEdicion.tipo_externalizacion) {
                setTipoExternalizacion(mantenimientoEdicion.tipo_externalizacion);
              }
              setExternalizacionVinculada(null);
            }
          })
          .catch(() => {
            setRequiereExternalizacion(Boolean(mantenimientoEdicion.requiere_externalizacion));
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
        setSolicitadoPor(solicitanteSesionActiva);
        setAsignadoA(esRolTecnico ? (usuarioActivo?.nombre || '') : '');
        setFecha(new Date().toISOString().slice(0, 10));
        setTipo('Correctivo');
        setEstado(esRolTecnico ? 'En proceso' : 'Pendiente de Asignación');
        setDescripcionTrabajo('');
        setDiagnosticoFinal('');
        setRepuestosUtilizados('');
        setCosto('');
        setFechaCierre('');
        setHorasHombre('');
        setFotosUrls([]);
        setDocumentosUrls([]);
        setAccesoriosAdicionales('');
        setCompletadoPor(esRolTecnico ? (usuarioActivo?.nombre || '') : '');
        setRecibidoPor('');
        setNumeroInforme(null);
        setFechaEmisionInforme(null);
        setRequiereExternalizacion(false);
        setTipoExternalizacion('Compra de repuesto por Informe de requerimiento');
        setExternalizacionVinculada(null);
        setEstadoSolicitudExternalizacion(null);
        setMotivoExternalizacion('');
        setExternalizacionSolicitadaPor('');
        setExternalizacionResueltaPor('');
        setSolicitudEnviadaAviso(null);
        setJustificacionError('');
      }
    }
  }, [open, equipos, equipoPreseleccionado, mantenimientoEdicion, solicitanteSesionActiva, esRolTecnico, usuarioActivo]);

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

  const handleSubmit = async (e: React.FormEvent) => {
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

    let finalEstado: EstadoMantenimiento =
      estado === 'Pendiente de Asignación' && (asignadoA || '').trim() !== ''
        ? 'En proceso'
        : estado;

    if (esRolTecnico && finalEstado === 'Pendiente de Asignación') {
      finalEstado = 'En proceso';
    }

    const finalEquipoId =
      esRolTecnico && mantenimientoEdicion
        ? (mantenimientoEdicion.equipo_id ?? null)
        : modoEquipo === 'registrado'
          ? equipoId || null
          : null;

    const finalEquipoIdentificacion =
      esRolTecnico && mantenimientoEdicion
        ? (mantenimientoEdicion.equipo_identificacion || '').trim()
        : (identificacion || '').trim();

    const finalProblema =
      esRolTecnico && mantenimientoEdicion
        ? (mantenimientoEdicion.problema_reportado || '').trim()
        : (problema || '').trim();

    const finalAsignadoA =
      esRolTecnico && mantenimientoEdicion
        ? (mantenimientoEdicion.asignado_a || asignadoA || '').trim() || null
        : (asignadoA || '').trim() || null;

    const finalTipo =
      esRolTecnico && mantenimientoEdicion
        ? (mantenimientoEdicion.tipo_mantenimiento || 'Correctivo')
        : tipo;

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

    try {
      setGuardando(true);
      await onSave({
        equipo_id: finalEquipoId,
        equipo_identificacion: finalEquipoIdentificacion,
        problema_reportado: finalProblema,
        solicitado_por: (solicitadoPor || '').trim(),
        asignado_a: finalAsignadoA,
        fecha_requerimiento: fecha,
        tipo_mantenimiento: finalTipo,
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
        estado_solicitud_externalizacion: estadoSolicitudExternalizacion,
        motivo_externalizacion: (motivoExternalizacion || '').trim() || null,
        externalizacion_solicitada_por: (externalizacionSolicitadaPor || '').trim() || null,
        solicitante_externalizacion: (externalizacionSolicitadaPor || usuarioActual?.nombre || '').trim() || null,
        externalizacion_resuelta_por: (externalizacionResueltaPor || '').trim() || null,
      });

      if (requiereExternalizacion && estadoSolicitudExternalizacion !== 'Rechazada') {
        await guardarExternalizacionParaMantenimiento({
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

      // Si se envió una solicitud de externalización pendiente, crear notificación para supervisores
      if (estadoSolicitudExternalizacion === 'Pendiente_Aprobacion') {
        try {
          await supabase.from('notificaciones').insert({
            destinatario_rol: 'Ingeniero Supervisor',
            destinatario_id: null,
            destinatario_nombre: null,
            titulo: `Solicitud de Externalización — ${mantenimientoEdicion?.codigo || 'Nueva OT'}`,
            mensaje: `El técnico ${externalizacionSolicitadaPor || usuarioActivo?.nombre || 'Técnico'} solicita externalización para la OT ${mantenimientoEdicion?.codigo || ''} (${finalEquipoIdentificacion}).\nModalidad: ${tipoExternalizacion}.\nMotivo: ${(motivoExternalizacion || '').trim() || finalProblema}`,
            tipo: 'solicitud_externalizacion',
            leida: false,
            mantenimiento_id: mantenimientoEdicion?.id || null,
            codigo_mantenimiento: mantenimientoEdicion?.codigo || null,
            codigo_mantenimiento_ref: mantenimientoEdicion?.codigo || null,
          });
          window.dispatchEvent(new CustomEvent('notificaciones_updated'));
        } catch (notifErr) {
          console.warn('Error creando notificación de externalización:', notifErr);
        }
      }

      // Notificación de Asignación / Reasignación de OT para el técnico (tipo 'ot_asignada')
      const asignadoPreviamente = mantenimientoEdicion?.asignado_a?.trim() || null;
      const nuevoAsignado = finalAsignadoA?.trim() || null;

      if (nuevoAsignado && nuevoAsignado !== asignadoPreviamente) {
        try {
          let tecnicoId: string | null = null;
          const { data: uData } = await supabase.from('perfiles').select('*');
          if (uData && Array.isArray(uData)) {
            const u = uData.find(
              (usr) => usr.nombre?.toLowerCase() === nuevoAsignado.toLowerCase()
            );
            if (u) tecnicoId = u.id;
          }

          const codOT = mantenimientoEdicion?.codigo || 'Nueva OT';
          const servClinico = (solicitadoPor || mantenimientoEdicion?.solicitado_por || 'Servicio Clínico').trim();

          await supabase.from('notificaciones').insert({
            destinatario_rol: 'Ingeniero de Servicio / Técnico',
            destinatario_id: tecnicoId,
            destinatario_nombre: nuevoAsignado,
            titulo: `Nueva OT Asignada: ${codOT}`,
            mensaje: `Se te ha asignado la orden para el equipo ${finalEquipoIdentificacion} del servicio ${servClinico}.`,
            tipo: 'ot_asignada',
            leida: false,
            mantenimiento_id: mantenimientoEdicion?.id || null,
            codigo_mantenimiento: codOT,
            codigo_mantenimiento_ref: codOT,
          });
          window.dispatchEvent(new CustomEvent('notificaciones_updated'));
        } catch (asigErr) {
          console.warn('Error notificando asignación de OT:', asigErr);
        }
      }

      // Si el supervisor aprobó o rechazó una solicitud previa del técnico
      if (
        mantenimientoEdicion &&
        mantenimientoEdicion.estado_solicitud_externalizacion === 'Pendiente_Aprobacion' &&
        (estadoSolicitudExternalizacion === 'Aprobada' || estadoSolicitudExternalizacion === 'Rechazada')
      ) {
        try {
          const tecName = mantenimientoEdicion.externalizacion_solicitada_por || mantenimientoEdicion.asignado_a || null;
          let tecId: string | null = null;
          if (tecName) {
            const { data: uData } = await supabase.from('perfiles').select('*');
            if (uData && Array.isArray(uData)) {
              const u = uData.find((usr) => usr.nombre?.toLowerCase() === tecName.toLowerCase());
              if (u) tecId = u.id;
            }
          }

          const esAprobada = estadoSolicitudExternalizacion === 'Aprobada';
          await supabase.from('notificaciones').insert({
            destinatario_rol: 'Ingeniero de Servicio / Técnico',
            destinatario_id: tecId,
            destinatario_nombre: tecName,
            titulo: esAprobada
              ? `Externalización Autorizada: ${mantenimientoEdicion.codigo}`
              : `Externalización Desestimada: ${mantenimientoEdicion.codigo}`,
            mensaje: esAprobada
              ? 'El requerimiento de compra/servicio externo fue aprobado e ingresado a Compras.'
              : 'La solicitud fue rechazada por supervisión. La OT debe resolverse por vía interna.',
            tipo: esAprobada ? 'externalizacion_aprobada' : 'externalizacion_rechazada',
            leida: false,
            mantenimiento_id: mantenimientoEdicion.id,
            codigo_mantenimiento: mantenimientoEdicion.codigo,
            codigo_mantenimiento_ref: mantenimientoEdicion.codigo,
          });
          window.dispatchEvent(new CustomEvent('notificaciones_updated'));
        } catch (notifErr) {
          console.warn('Error notificando resolución al técnico:', notifErr);
        }
      }
    } catch (saveErr) {
      console.error('Error al procesar guardado en modal:', saveErr);
    } finally {
      setGuardando(false);
    }
  };

  const currentEquipoIdentificacion =
    mantenimientoEdicion?.equipo_identificacion ||
    (modoEquipo === 'registrado' && equipoSeleccionado
      ? `${equipoSeleccionado.nombre} (${equipoSeleccionado.codigo_institucional})`
      : equipoManual.trim() || 'Equipo Clínico');

  async function handleConfirmarRechazoSupervisor() {
    setProcesandoAccionSupervisor(true);
    try {
      const motivoRechazoFinal =
        motivoRechazoInput.trim() ||
        'La orden debe ser atendida con insumos y capacidades locales de la unidad técnica.';

      setEstadoSolicitudExternalizacion('Rechazada');
      setRequiereExternalizacion(false);
      setExternalizacionResueltaPor(usuarioActivo?.nombre || 'Supervisor');
      setMotivoExternalizacion(motivoRechazoFinal);

      if (mantenimientoEdicion?.id) {
        await saveMantenimientoRecord({
          id: mantenimientoEdicion.id,
          codigo: mantenimientoEdicion.codigo,
          isEdit: true,
          payload: {
            ...mantenimientoEdicion,
            requiere_externalizacion: false,
            estado_solicitud_externalizacion: 'Rechazada',
            externalizacion_resuelta_por: usuarioActivo?.nombre || 'Supervisor',
            motivo_externalizacion: motivoRechazoFinal,
          },
        });

        await supabase.from('notificaciones').insert({
          destinatario_rol: 'Ingeniero de Servicio / Técnico',
          destinatario_id: null,
          titulo: `Externalización Rechazada — ${mantenimientoEdicion.codigo}`,
          mensaje: `El Supervisor ${usuarioActivo?.nombre || 'Supervisor'} ha RECHAZADO la solicitud de externalización para la OT ${mantenimientoEdicion.codigo} (${currentEquipoIdentificacion}). Motivo: ${motivoRechazoFinal}`,
          tipo: 'alerta',
          leida: false,
          mantenimiento_id: mantenimientoEdicion.id,
          codigo_mantenimiento: mantenimientoEdicion.codigo,
        });

        window.dispatchEvent(new CustomEvent('notificaciones_updated'));
        window.dispatchEvent(new CustomEvent('mantenimientos_updated'));
      }

      setSolicitudEnviadaAviso(
        'Solicitud de externalización rechazada. Se informó la resolución al técnico de servicio.'
      );
      setModalRechazoOpen(false);
    } catch (err) {
      console.error('Error al rechazar solicitud:', err);
    } finally {
      setProcesandoAccionSupervisor(false);
    }
  }

  async function handleAutorizarSupervisor() {
    setProcesandoAccionSupervisor(true);
    try {
      setEstadoSolicitudExternalizacion('Aprobada');
      setRequiereExternalizacion(true);
      setExternalizacionResueltaPor(usuarioActivo?.nombre || 'Supervisor');

      if (mantenimientoEdicion?.id) {
        await saveMantenimientoRecord({
          id: mantenimientoEdicion.id,
          codigo: mantenimientoEdicion.codigo,
          isEdit: true,
          payload: {
            ...mantenimientoEdicion,
            requiere_externalizacion: true,
            tipo_externalizacion: tipoExternalizacion,
            estado_solicitud_externalizacion: 'Aprobada',
            externalizacion_resuelta_por: usuarioActivo?.nombre || 'Supervisor',
          },
        });

        await guardarExternalizacionParaMantenimiento({
          mantId: mantenimientoEdicion.id,
          mantCodigo: mantenimientoEdicion.codigo,
          tipo: tipoExternalizacion,
          descripcion: `Externalización Aprobada por ${usuarioActivo?.nombre || 'Supervisor'}. Justificación: ${motivoExternalizacion || mantenimientoEdicion.problema_reportado}`,
          equipoIdentificacion: currentEquipoIdentificacion,
          equipoId: mantenimientoEdicion.equipo_id || null,
          solicitante: externalizacionSolicitadaPor || mantenimientoEdicion.solicitado_por || usuarioActivo?.nombre,
        });

        await supabase.from('notificaciones').insert({
          destinatario_rol: 'Ingeniero de Servicio / Técnico',
          destinatario_id: null,
          titulo: `Externalización Aprobada — ${mantenimientoEdicion.codigo}`,
          mensaje: `El Supervisor ${usuarioActivo?.nombre || 'Supervisor'} ha APROBADO la externalización para la OT ${mantenimientoEdicion.codigo} (${currentEquipoIdentificacion}). Se derivó a Adquisiciones para gestión de compra.`,
          tipo: 'info',
          leida: false,
          mantenimiento_id: mantenimientoEdicion.id,
          codigo_mantenimiento: mantenimientoEdicion.codigo,
        });

        window.dispatchEvent(new CustomEvent('notificaciones_updated'));
        window.dispatchEvent(new CustomEvent('mantenimientos_updated'));
      }

      setSolicitudEnviadaAviso(
        '¡Solicitud autorizada exitosamente! Se habilitó la compra externa y se notificó al técnico.'
      );
    } catch (err) {
      console.error('Error al autorizar externalización:', err);
    } finally {
      setProcesandoAccionSupervisor(false);
    }
  }

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
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">
                Identificación del equipo <span className="text-rose-500">*</span>
              </label>
              {esRolTecnico && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <Lock className="h-3 w-3 text-slate-400" />
                  <span>Equipo bloqueado para técnicos</span>
                </span>
              )}
            </div>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                disabled={esRolTecnico}
                onClick={() => setModoEquipo('registrado')}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  modoEquipo === 'registrado'
                    ? esRolTecnico
                      ? 'bg-slate-200 text-slate-700 cursor-not-allowed border border-slate-300'
                      : 'bg-blue-600 text-white shadow-sm'
                    : esRolTecnico
                      ? 'bg-gray-100 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Seleccionar del inventario
              </button>
              <button
                type="button"
                disabled={esRolTecnico}
                onClick={() => setModoEquipo('manual')}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  modoEquipo === 'manual'
                    ? esRolTecnico
                      ? 'bg-slate-200 text-slate-700 cursor-not-allowed border border-slate-300'
                      : 'bg-blue-600 text-white shadow-sm'
                    : esRolTecnico
                      ? 'bg-gray-100 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Ingresar manualmente
              </button>
            </div>
            {modoEquipo === 'registrado' ? (
              <select
                id="equipo_id"
                disabled={esTecnico}
                className={`${inputClass} ${
                  esTecnico
                    ? 'bg-gray-100 cursor-not-allowed text-slate-700 border-slate-200 select-none focus:ring-0 focus:border-slate-200'
                    : ''
                }`}
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
                id="equipo_id"
                disabled={esTecnico}
                readOnly={esTecnico}
                className={`${inputClass} ${
                  esTecnico
                    ? 'bg-gray-100 cursor-not-allowed text-slate-700 border-slate-200 select-none focus:ring-0 focus:border-slate-200'
                    : ''
                }`}
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
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="problema_reportado" className="block text-sm font-medium text-slate-700">
                Problema reportado o causa <span className="text-rose-500">*</span>
              </label>
              {esTecnico && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <Lock className="h-3 w-3 text-slate-400" />
                  <span>Reporte clínico original (Solo lectura)</span>
                </span>
              )}
            </div>
            <textarea
              id="problema_reportado"
              readOnly={esTecnico}
              className={`${inputClass} min-h-[75px] resize-y ${
                esTecnico
                  ? 'bg-gray-100 cursor-not-allowed text-slate-700 border-slate-200 select-none focus:ring-0 focus:border-slate-200 resize-none'
                  : ''
              }`}
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
                className={`${inputClass} !bg-slate-100 !text-slate-700 !border-slate-200 cursor-not-allowed focus:!ring-0 focus:!border-slate-200 select-none`}
                value={solicitadoPor}
                readOnly
                title="Usuario activo en sesión (este campo no puede ser modificado manualmente)"
                placeholder="Nombre del solicitante o servicio"
              />
              {touched && !(solicitadoPor || '').trim() && (
                <p className="mt-1 text-xs text-rose-500">El solicitante es obligatorio</p>
              )}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  Asignado a (Técnico / Responsable){' '}
                  {asignadoRequerido && <span className="text-rose-500">*</span>}
                </label>
                {esTecnico && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <Lock className="h-3 w-3 text-slate-400" />
                    <span>No reasignable</span>
                  </span>
                )}
              </div>
              <div ref={asignadoContainerRef} className="relative">
                <button
                  id="asignado_a"
                  ref={asignadoInputRef}
                  type="button"
                  disabled={esTecnico}
                  onClick={() => {
                    if (esTecnico) return;
                    setAsignadoDropdownOpen((prev) => !prev);
                  }}
                  onKeyDown={(e) => {
                    if (esTecnico) return;
                    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setAsignadoDropdownOpen(true);
                    }
                  }}
                  className={`${inputClass} flex items-center justify-between text-left transition ${
                    esTecnico
                      ? 'bg-gray-100 cursor-not-allowed text-slate-700 border-slate-200 select-none focus:ring-0 focus:border-slate-200'
                      : 'cursor-pointer'
                  } ${
                    !esTecnico &&
                    (((touched && asignadoRequerido && !(asignadoA || '').trim()) ||
                      (estadoError && !(asignadoA || '').trim())))
                      ? '!border-rose-400 focus:!border-rose-500 focus:!ring-rose-200'
                      : ''
                  }`}
                  aria-haspopup="listbox"
                  aria-expanded={asignadoDropdownOpen}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    {asignadoA ? (
                      <>
                        <span
                          className={`inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            esRolTecnico
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {asignadoA.charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate font-medium text-slate-900">{asignadoA}</span>
                      </>
                    ) : (
                      <span className="text-slate-400 truncate">
                        {esRolTecnico
                          ? 'Sin técnico asignado'
                          : 'Seleccionar o buscar técnico o supervisor...'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 flex-shrink-0">
                    {asignadoA && !esRolTecnico && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          seleccionarAsignado('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            seleccionarAsignado('');
                          }
                        }}
                        className="rounded p-0.5 hover:bg-slate-200 hover:text-slate-600 transition"
                        title="Limpiar asignación"
                      >
                        <X className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {!esRolTecnico ? (
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          asignadoDropdownOpen ? 'rotate-180 text-blue-600' : ''
                        }`}
                      />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Dropdown flotante con buscador integrado */}
                {!esRolTecnico && asignadoDropdownOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1.5 w-full rounded-xl border border-slate-200 bg-white shadow-xl animate-in fade-in zoom-in-95 duration-100">
                    {/* Input de búsqueda en tiempo real */}
                    <div className="p-2 border-b border-slate-100">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Buscar por nombre, cargo o rol..."
                          value={asignadoBusqueda}
                          onChange={(e) => setAsignadoBusqueda(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setAsignadoDropdownOpen(false);
                            }
                          }}
                        />
                        {asignadoBusqueda && (
                          <button
                            type="button"
                            onClick={() => setAsignadoBusqueda('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Lista de resultados filtrados */}
                    <div className="max-h-56 overflow-y-auto p-1 text-xs divide-y divide-slate-50">
                      {/* Opción para desasignar si hay un usuario seleccionado */}
                      {asignadoA && (
                        <button
                          type="button"
                          onClick={() => seleccionarAsignado('')}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-slate-500 hover:bg-slate-100 transition"
                        >
                          <span className="italic">Sin asignar (Dejar pendiente de asignación)</span>
                        </button>
                      )}

                      {/* Opción preexistente si no figura en usuarios activos actuales */}
                      {asignadoA &&
                        !usuariosAsignables.some((u) => u.nombre === asignadoA) &&
                        (!asignadoBusqueda || asignadoA.toLowerCase().includes(asignadoBusqueda.toLowerCase())) && (
                          <button
                            type="button"
                            onClick={() => seleccionarAsignado(asignadoA)}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left bg-blue-50/50 hover:bg-blue-100/70 transition"
                          >
                            <div>
                              <p className="font-semibold text-slate-800">{asignadoA}</p>
                              <p className="text-[11px] text-slate-500">Registrado previamente</p>
                            </div>
                            <Check className="h-4 w-4 text-blue-600" />
                          </button>
                        )}

                      {usuariosAsignablesFiltrados.length === 0 ? (
                        <div className="p-4 text-center text-slate-400">
                          <p className="font-medium text-slate-600">No se encontraron resultados</p>
                          <p className="mt-0.5 text-[11px]">
                            Ningún técnico o supervisor coincide con "{asignadoBusqueda}"
                          </p>
                        </div>
                      ) : (
                        usuariosAsignablesFiltrados.map((u) => {
                          const isSelected = asignadoA === u.nombre;
                          const esSupervisorUser = (u.rol || '').toLowerCase().includes('supervisor');
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => seleccionarAsignado(u.nombre)}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition ${
                                isSelected
                                  ? 'bg-blue-50 text-blue-900 font-medium'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <div
                                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                    esSupervisorUser
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-sky-100 text-sky-700'
                                  }`}
                                >
                                  {u.nombre.charAt(0).toUpperCase()}
                                </div>
                                <div className="truncate">
                                  <p className="truncate font-semibold text-slate-900">{u.nombre}</p>
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                                    <span
                                      className={`inline-block rounded px-1.5 py-0.2 font-medium ${
                                        esSupervisorUser
                                          ? 'bg-purple-50 text-purple-700 border border-purple-200/50'
                                          : 'bg-sky-50 text-sky-700 border border-sky-200/50'
                                      }`}
                                    >
                                      {u.rol}
                                    </span>
                                    {u.cargo && <span className="truncate">· {u.cargo}</span>}
                                  </div>
                                </div>
                              </div>
                              {isSelected && <Check className="h-4 w-4 text-blue-600 flex-shrink-0 ml-2" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                    <div className="border-t border-slate-100 bg-slate-50/80 px-3 py-1.5 text-[11px] text-slate-500 flex items-center justify-between rounded-b-xl">
                      <span>{usuariosAsignablesFiltrados.length} disponibles</span>
                      <span className="font-medium text-slate-400">Supervisores y Técnicos</span>
                    </div>
                  </div>
                )}
              </div>
              {esRolTecnico ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <Lock className="h-3 w-3 text-slate-400" />
                  <span>Asignación fija. Solo supervisores o administradores pueden reasignar.</span>
                </p>
              ) : (asignadoA || '').trim() !== '' && estado === 'En proceso' ? (
                <p className="mt-1 flex items-center gap-1 text-xs font-medium text-blue-600">
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-blue-600" />
                  <span>Estado cambiado automáticamente a "En proceso"</span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  Solo se listan técnicos y supervisores autorizados en el sistema.
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
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="tipo_mantenimiento" className="block text-sm font-medium text-slate-700">
                  Tipo de mantenimiento
                </label>
                {esTecnico && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <Lock className="h-3 w-3 text-slate-400" />
                    <span>Fijo</span>
                  </span>
                )}
              </div>
              <div id="tipo_mantenimiento" className="flex gap-2">
                {(['Correctivo', 'Preventivo'] as TipoMantenimiento[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={esTecnico}
                    onClick={() => setTipo(t)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-all ${
                      tipo === t
                        ? esTecnico
                          ? 'border-slate-300 bg-gray-100 text-slate-700 cursor-not-allowed shadow-none'
                          : 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                        : esTecnico
                          ? 'border-slate-200 bg-gray-100 text-slate-400 cursor-not-allowed opacity-60'
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

          {/* SECCIÓN EXTERNALIZACIÓN / COMPRA EXTERNA (FLUJO DE APROBACIÓN TÉCNICO - SUPERVISOR) */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-all">
            {/* Banner informativo color ámbar cuando la solicitud está enviada / pendiente de revisión */}
            {estadoSolicitudExternalizacion === 'Pendiente_Aprobacion' && (
              <div className="mb-3.5 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 shadow-xs">
                <Clock className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1 font-semibold leading-relaxed">
                  Solicitud de externalización enviada. Pendiente de revisión por el Ingeniero Supervisor.
                </div>
              </div>
            )}

            {solicitudEnviadaAviso && estadoSolicitudExternalizacion !== 'Pendiente_Aprobacion' && (
              <div className="mb-3 flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>{solicitudEnviadaAviso}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSolicitudEnviadaAviso(null)}
                  className="text-emerald-700 hover:text-emerald-950 text-sm font-bold"
                >
                  ×
                </button>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 flex-shrink-0">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                    <span>Requiere Externalización / Compra Externa</span>
                    {requiereExternalizacion && externalizacionBloqueaCierre && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        <Lock className="h-3 w-3" /> Bloquea Cierre
                      </span>
                    )}
                    {estadoSolicitudExternalizacion === 'Pendiente_Aprobacion' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                        <Clock className="h-3 w-3 text-amber-600 animate-pulse" />
                        <span>Pendiente V°B° Supervisor</span>
                      </span>
                    )}
                    {estadoSolicitudExternalizacion === 'Aprobada' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900 border border-emerald-300">
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span>V°B° Aprobado</span>
                      </span>
                    )}
                    {estadoSolicitudExternalizacion === 'Rechazada' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-900 border border-rose-300">
                        <X className="h-3 w-3 text-rose-600" />
                        <span>Rechazada</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {esTecnico
                      ? 'Los técnicos deben justificar y solicitar autorización al Ingeniero Supervisor para compras o derivaciones.'
                      : 'Activar si esta OT requiere compra de repuestos clínicos o contratación de servicio tercerizado.'}
                  </div>
                </div>
              </div>

              {/* Botón o Conmutador dependiente del perfil */}
              {esTecnico ? (
                <div>
                  {estadoSolicitudExternalizacion === 'Aprobada' ? (
                    <label className="relative inline-flex cursor-pointer items-center flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={requiereExternalizacion}
                        onChange={(e) => {
                          setRequiereExternalizacion(e.target.checked);
                          setEstadoError('');
                        }}
                        className="peer sr-only"
                      />
                      <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-emerald-500/20" />
                      <span className="ml-2 text-xs font-semibold text-slate-700 min-w-[30px]">
                        {requiereExternalizacion ? 'Sí' : 'No'}
                      </span>
                    </label>
                  ) : (
                    <div className="flex items-center gap-2">
                      <label
                        className="relative inline-flex cursor-pointer items-center flex-shrink-0"
                        title="Solicitar externalización a supervisión"
                      >
                        <input
                          type="checkbox"
                          checked={estadoSolicitudExternalizacion === 'Pendiente_Aprobacion'}
                          onChange={() => {
                            setMotivoInput(motivoExternalizacion || '');
                            setTipoExtInput(tipoExternalizacion || 'Compra de repuesto por Informe de requerimiento');
                            setModalJustificacionOpen(true);
                          }}
                          className="peer sr-only"
                        />
                        <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-amber-500 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-amber-500/20" />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMotivoInput(motivoExternalizacion || '');
                          setTipoExtInput(tipoExternalizacion || 'Compra de repuesto por Informe de requerimiento');
                          setModalJustificacionOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition shadow-2xs active:scale-95"
                      >
                        <Send className="h-3.5 w-3.5 text-amber-600" />
                        <span>
                          {estadoSolicitudExternalizacion === 'Pendiente_Aprobacion'
                            ? 'Ver / Editar Solicitud'
                            : 'Solicitar Externalización a Supervisión'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Para Supervisor o Administrador: Conmutador directo */
                <label className="relative inline-flex cursor-pointer items-center flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={requiereExternalizacion}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setRequiereExternalizacion(checked);
                      setEstadoError('');
                      if (checked && estadoSolicitudExternalizacion !== 'Aprobada') {
                        setEstadoSolicitudExternalizacion('Aprobada');
                        setExternalizacionResueltaPor(usuarioActivo?.nombre || 'Supervisor');
                      }
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-blue-500/20" />
                  <span className="ml-2 text-xs font-semibold text-slate-700 min-w-[30px]">
                    {requiereExternalizacion ? 'Sí' : 'No'}
                  </span>
                </label>
              )}
            </div>

            {/* Tarjeta de Aprobación para Supervisor cuando la solicitud está pendiente */}
            {(esSupervisor || esAdmin) && estadoSolicitudExternalizacion === 'Pendiente_Aprobacion' && (
              <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50/90 p-4 text-xs shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <Bell className="h-4 w-4 text-amber-600 animate-bounce flex-shrink-0" />
                    <span>Solicitud de Externalización del Técnico ({externalizacionSolicitadaPor || 'Técnico'})</span>
                  </div>
                  <span className="rounded-md bg-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-900 uppercase">
                    Visto Bueno Requerido
                  </span>
                </div>
                <div className="mt-2.5 rounded-lg border border-amber-200/80 bg-white/90 p-3 space-y-1.5 text-amber-950">
                  <p>
                    <strong>Modalidad sugerida:</strong> {tipoExternalizacion}
                  </p>
                  <p>
                    <strong>Justificación Técnica del Técnico:</strong>
                  </p>
                  <p className="rounded bg-amber-50/60 p-2 italic text-slate-800 border border-amber-200/60">
                    "{motivoExternalizacion || 'Sin justificación detallada'}"
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Solicitada por <strong>{externalizacionSolicitadaPor || 'Técnico'}</strong>
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-200">
                  <span className="text-[11px] font-medium text-amber-900">
                    Acción de Jefatura / Supervisión:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      id="btn-rechazar-solicitud-ext"
                      type="button"
                      disabled={procesandoAccionSupervisor}
                      onClick={() => {
                        setMotivoRechazoInput(
                          'La orden debe ser atendida con insumos y capacidades locales de la unidad técnica.'
                        );
                        setModalRechazoOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 transition active:scale-95 shadow-2xs disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Rechazar Solicitud</span>
                    </button>
                    <button
                      id="btn-autorizar-solicitud-ext"
                      type="button"
                      disabled={procesandoAccionSupervisor}
                      onClick={handleAutorizarSupervisor}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50"
                    >
                      {procesandoAccionSupervisor ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      <span>Autorizar Externalización</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tarjeta Informativa para el Técnico en estado Pendiente */}
            {esRolTecnico && estadoSolicitudExternalizacion === 'Pendiente_Aprobacion' && (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50/80 p-3 text-xs text-amber-950">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <Clock className="h-4 w-4 text-amber-600 animate-pulse flex-shrink-0" />
                    <span>Externalización: Solicitud Pendiente de Aprobación</span>
                  </div>
                  <span className="font-semibold text-amber-800 text-[11px]">
                    En bandeja de supervisor
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-slate-700">
                  <p><strong>Modalidad solicitada:</strong> {tipoExternalizacion}</p>
                  <p><strong>Justificación ingresada:</strong> "{motivoExternalizacion}"</p>
                  <p className="text-[11px] text-amber-800 mt-1">
                    La compra externa y la sincronización con adquisiciones se habilitarán una vez que el Ingeniero Supervisor apruebe tu requerimiento.
                  </p>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMotivoInput(motivoExternalizacion || '');
                      setTipoExtInput(tipoExternalizacion);
                      setModalJustificacionOpen(true);
                    }}
                    className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    Editar Justificación
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEstadoSolicitudExternalizacion(null);
                      setMotivoExternalizacion('');
                      setRequiereExternalizacion(false);
                      setSolicitudEnviadaAviso('Solicitud de externalización desestimada.');
                    }}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                  >
                    Cancelar Solicitud
                  </button>
                </div>
              </div>
            )}

            {/* Tarjeta de Aprobación Existente */}
            {estadoSolicitudExternalizacion === 'Aprobada' && (
              <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50/80 p-3 text-xs text-emerald-950">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span>Externalización Autorizada por {externalizacionResueltaPor || 'Supervisión'}</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded text-[10px]">
                    Visto Bueno Concedido
                  </span>
                </div>
                {motivoExternalizacion && (
                  <p className="mt-1 text-emerald-800">
                    <strong>Justificación técnica:</strong> {motivoExternalizacion}
                  </p>
                )}
              </div>
            )}

            {/* Tarjeta de Rechazo Existente */}
            {estadoSolicitudExternalizacion === 'Rechazada' && (
              <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50/80 p-3 text-xs text-rose-950">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-rose-900">
                    <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                    <span>Solicitud de Externalización Rechazada ({externalizacionResueltaPor || 'Supervisión'})</span>
                  </div>
                  <span className="font-mono font-bold text-rose-800 bg-rose-200/80 px-2 py-0.5 rounded text-[10px]">
                    No Autorizada
                  </span>
                </div>
                {motivoExternalizacion && (
                  <p className="mt-1 text-rose-800">
                    <strong>Motivo evaluado:</strong> {motivoExternalizacion}
                  </p>
                )}
                {esRolTecnico && (
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setMotivoInput(motivoExternalizacion || '');
                        setTipoExtInput(tipoExternalizacion);
                        setModalJustificacionOpen(true);
                      }}
                      className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-100/60 shadow-2xs transition"
                    >
                      Reingresar Solicitud con Nueva Justificación
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Campos de configuración cuando requiereExternalizacion es TRUE */}
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
                      Al guardar esta OT con externalización activa, se generará de inmediato el registro en el módulo <strong>Externalización y Compras</strong> vinculado a este equipo y solicitante. El cierre técnico quedará condicionado a la recepción conforme de la compra.
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
              {estado === 'Pendiente de Asignación' && !esTecnico && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  Pendiente de Asignación
                </span>
              )}
            </div>
            <div
              id="selector_estado"
              className={`grid grid-cols-1 gap-2 ${
                esTecnico ? 'sm:grid-cols-2' : 'sm:grid-cols-3'
              }`}
            >
              {(
                (esTecnico
                  ? ['En proceso', 'Completado']
                  : ['Pendiente de Asignación', 'En proceso', 'Completado']) as EstadoMantenimiento[]
              ).map((est) => {
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
                guardando ||
                (estado === 'Completado' && !cierreValido) ||
                (!esEdicion && !puede('crear_solicitud_ot'))
              }
              className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm transition-all active:scale-[0.98] ${
                guardando || (!esEdicion && !puede('crear_solicitud_ot'))
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : estado === 'Completado'
                    ? cierreValido
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {guardando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : estado === 'Completado' ? (
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

      {/* DIÁLOGO / SUBMODAL DE SOLICITUD DE EXTERNALIZACIÓN A SUPERVISIÓN */}
      {modalJustificacionOpen && (
        <div
          id="submodal-solicitar-externalizacion"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <Send className="h-4 w-4" />
                </div>
                <span>Solicitar Externalización a Supervisión</span>
              </div>
              <button
                type="button"
                onClick={() => setModalJustificacionOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-500 leading-relaxed">
              Como Técnico de Servicio, el requerimiento de compras o servicio técnico externo debe ser justificado técnicamente para su evaluación y aprobación por parte del Ingeniero Supervisor.
            </p>

            {justificacionError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 font-medium">
                {justificacionError}
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="modalidad_sugerida" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Modalidad sugerida <span className="text-rose-500">*</span>
                </label>
                <select
                  id="modalidad_sugerida"
                  name="modalidad_sugerida"
                  value={tipoExtInput}
                  onChange={(e) => setTipoExtInput(e.target.value as TipoExternalizacion)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="Compra de repuesto por fondo fijo">
                    Compra de repuesto por fondo fijo
                  </option>
                  <option value="Compra de repuesto por Informe de requerimiento">
                    Compra de repuesto por Informe de requerimiento
                  </option>
                  <option value="Compra de servicio de mantenimiento o reparación externa">
                    Compra de servicio de mantenimiento o reparación externa
                  </option>
                </select>
              </div>

              <div>
                <label htmlFor="motivo_externalizacion" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Motivo de externalización <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="motivo_externalizacion"
                  name="motivo_externalizacion"
                  rows={4}
                  required
                  value={motivoInput}
                  onChange={(e) => {
                    setMotivoInput(e.target.value);
                    if (justificacionError) setJustificacionError('');
                  }}
                  placeholder="Justificación técnica de por qué se requiere compra o servicio externo..."
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Justificación técnica de por qué se requiere compra o servicio externo (obligatorio).
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalJustificacionOpen(false)}
                className="rounded-lg px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                id="btn-confirmar-submodal-externalizacion"
                type="button"
                onClick={async () => {
                  if (!motivoInput.trim()) {
                    setJustificacionError('El motivo de externalización es obligatorio. Por favor ingresa la justificación técnica.');
                    return;
                  }
                  const motivoLimpio = motivoInput.trim();
                  const tecnicoSolicitante = usuarioActual?.nombre || 'Técnico de Servicio';
                  const modalidad = tipoExtInput;

                  setEstadoSolicitudExternalizacion('Pendiente_Aprobacion');
                  setMotivoExternalizacion(motivoLimpio);
                  setTipoExternalizacion(modalidad);
                  setExternalizacionSolicitadaPor(tecnicoSolicitante);
                  setRequiereExternalizacion(false);
                  setModalJustificacionOpen(false);

                  // Si se está editando una OT existente, persistir inmediatamente la solicitud y la notificación para el Ingeniero Supervisor
                  if (mantenimientoEdicion?.id) {
                    try {
                      await supabase.from('mantenimientos').update({
                        estado_solicitud_externalizacion: 'Pendiente_Aprobacion',
                        motivo_externalizacion: motivoLimpio,
                        tipo_externalizacion: modalidad,
                        externalizacion_solicitada_por: tecnicoSolicitante,
                        solicitante_externalizacion: tecnicoSolicitante,
                        requiere_externalizacion: false,
                      }).eq('id', mantenimientoEdicion.id);

                      await supabase.from('notificaciones').insert({
                        destinatario_rol: 'Ingeniero Supervisor',
                        destinatario_id: null,
                        titulo: `Solicitud de Externalización — ${mantenimientoEdicion.codigo}`,
                        mensaje: `El técnico ${tecnicoSolicitante} solicita externalización para la OT ${mantenimientoEdicion.codigo} (${mantenimientoEdicion.equipo_identificacion}).\nModalidad sugerida: ${modalidad}.\nMotivo: ${motivoLimpio}`,
                        tipo: 'solicitud_externalizacion',
                        leida: false,
                        mantenimiento_id: mantenimientoEdicion.id,
                        codigo_mantenimiento: mantenimientoEdicion.codigo,
                      });

                      window.dispatchEvent(new CustomEvent('mantenimientos_updated'));
                      window.dispatchEvent(new CustomEvent('notificaciones_updated'));
                    } catch (err) {
                      console.warn('Error al persistir solicitud de externalización:', err);
                    }
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-95 transition"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Enviar Solicitud a Supervisión</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* DIÁLOGO / MODAL DE RECHAZO DE EXTERNALIZACIÓN POR SUPERVISOR */}
      {modalRechazoOpen && (
        <div
          id="modal-rechazo-externalizacion"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                  <X className="h-4 w-4" />
                </div>
                <span>Rechazar Solicitud de Externalización</span>
              </div>
              <button
                type="button"
                onClick={() => setModalRechazoOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Indica la justificación o instrucción técnica por la cual se desestima la compra o servicio externo para esta orden. Esta respuesta será notificada directamente al técnico de servicio.
            </p>

            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950 space-y-1">
              <div><strong>Orden de Trabajo:</strong> {mantenimientoEdicion?.codigo || 'Nueva OT'}</div>
              <div><strong>Solicitado por:</strong> {externalizacionSolicitadaPor || 'Técnico'}</div>
              <div><strong>Modalidad sugerida:</strong> {tipoExternalizacion}</div>
              {motivoExternalizacion && (
                <div className="text-[11px] text-slate-600 italic mt-1">
                  Justificación previa del técnico: "{motivoExternalizacion}"
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Motivo / Observación del Rechazo <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={motivoRechazoInput}
                onChange={(e) => setMotivoRechazoInput(e.target.value)}
                placeholder="Indica la razón del rechazo o directriz técnica para resolver el requerimiento internamente..."
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={procesandoAccionSupervisor}
                onClick={() => setModalRechazoOpen(false)}
                className="rounded-lg px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                id="btn-confirmar-rechazo-supervisor"
                type="button"
                disabled={procesandoAccionSupervisor}
                onClick={handleConfirmarRechazoSupervisor}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 active:scale-95 transition disabled:opacity-50"
              >
                {procesandoAccionSupervisor ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                <span>Confirmar Rechazo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
