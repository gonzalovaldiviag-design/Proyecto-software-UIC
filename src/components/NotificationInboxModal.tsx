import { useEffect, useState, useMemo } from 'react';
import {
  Bell,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Check,
  Trash2,
  ShoppingBag,
  Loader2,
  RefreshCw,
  UserCheck,
  Building2,
  Wrench,
  FileText,
  User,
  CheckCheck,
  XCircle,
} from 'lucide-react';
import {
  supabase,
  type Notificacion,
  type Mantenimiento,
  type TipoExternalizacion,
  type TipoNotificacion,
} from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';
import { saveMantenimientoRecord, enrichMantenimiento } from '@/lib/mantenimientoStorage';
import { guardarExternalizacionParaMantenimiento } from '@/lib/externalizacionStorage';

function getNotificationBadgeConfig(tipo: TipoNotificacion) {
  switch (tipo) {
    case 'ot_asignada':
      return {
        label: 'OT Asignada',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
        iconContainerClass: 'bg-blue-100 text-blue-700',
        cardUnreadClass: 'border-blue-300 bg-blue-50/50 shadow-xs',
        Icon: Wrench,
      };
    case 'externalizacion_aprobada':
      return {
        label: 'Externalización Autorizada',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        iconContainerClass: 'bg-emerald-100 text-emerald-700',
        cardUnreadClass: 'border-emerald-300 bg-emerald-50/50 shadow-xs',
        Icon: CheckCircle2,
      };
    case 'externalizacion_finalizada':
      return {
        label: 'Insumo / Servicio Recibido',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        iconContainerClass: 'bg-emerald-100 text-emerald-700',
        cardUnreadClass: 'border-emerald-300 bg-emerald-50/50 shadow-xs',
        Icon: CheckCheck,
      };
    case 'externalizacion_rechazada':
      return {
        label: 'Externalización Desestimada',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
        iconContainerClass: 'bg-rose-100 text-rose-700',
        cardUnreadClass: 'border-rose-300 bg-rose-50/50 shadow-xs',
        Icon: XCircle,
      };
    case 'solicitud_externalizacion':
      return {
        label: 'Solicitud Externalización',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        iconContainerClass: 'bg-amber-100 text-amber-700',
        cardUnreadClass: 'border-amber-300 bg-amber-50/60 shadow-xs',
        Icon: ShoppingBag,
      };
    case 'alerta':
      return {
        label: 'Atención Requerida',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
        iconContainerClass: 'bg-rose-100 text-rose-700',
        cardUnreadClass: 'border-rose-300 bg-rose-50/50 shadow-xs',
        Icon: AlertTriangle,
      };
    case 'info':
    default:
      return {
        label: 'Aviso Informativo',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        iconContainerClass: 'bg-slate-100 text-slate-700',
        cardUnreadClass: 'border-slate-300 bg-slate-50/60 shadow-xs',
        Icon: Bell,
      };
  }
}

interface NotificationInboxModalProps {
  open: boolean;
  onClose: () => void;
  onOpenMantenimiento?: (codigoOMantenimientoId: string) => void;
}

export default function NotificationInboxModal({
  open,
  onClose,
  onOpenMantenimiento,
}: NotificationInboxModalProps) {
  const { usuarioActivo } = useAuth();
  const [solicitudesPendientes, setSolicitudesPendientes] = useState<Mantenimiento[]>([]);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState<'solicitudes' | 'historial'>('solicitudes');
  const [filtroHistorial, setFiltroHistorial] = useState<'todas' | 'no_leidas'>('todas');
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ tipo: 'ok' | 'err'; text: string } | null>(null);

  // Submodal de confirmación de rechazo con justificación técnica
  const [solicitudARechazar, setSolicitudARechazar] = useState<Mantenimiento | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  const esTecnico = usuarioActivo.rol === 'Ingeniero de Servicio / Técnico';
  const esSupervisorOAdmin =
    usuarioActivo.rol === 'Ingeniero Supervisor' ||
    usuarioActivo.rol === 'Administrador (Jefe de Unidad)' ||
    usuarioActivo.rol?.includes('Administrador');

  async function cargarDatos() {
    setLoading(true);
    try {
      // 1. Cargar órdenes con solicitud de externalización pendiente
      const { data: mants, error: errMants } = await supabase
        .from('mantenimientos')
        .select('*')
        .order('created_at', { ascending: false });

      if (errMants) {
        console.warn('Error cargando mantenimientos en inbox:', errMants);
      } else if (mants) {
        const enriched = (mants as Mantenimiento[]).map((m) => enrichMantenimiento(m));
        const pendientes = enriched.filter(
          (m) => m.estado_solicitud_externalizacion === 'Pendiente_Aprobacion'
        );
        setSolicitudesPendientes(pendientes);
      }

      // 2. Cargar notificaciones del sistema
      const { data: notifs, error: errNotifs } = await supabase
        .from('notificaciones')
        .select('*')
        .order('created_at', { ascending: false });

      if (errNotifs) {
        console.warn('Error cargando notificaciones en inbox:', errNotifs);
      } else if (notifs) {
        setNotificaciones(notifs as Notificacion[]);
      }
    } catch (err) {
      console.warn('Error general cargando datos de bandeja:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      if (esTecnico) {
        setPestanaActiva('historial');
      } else if (esSupervisorOAdmin) {
        setPestanaActiva('solicitudes');
      }
      cargarDatos();
    }
  }, [open, esTecnico, esSupervisorOAdmin]);

  useEffect(() => {
    function handleUpdate() {
      cargarDatos();
    }
    window.addEventListener('mantenimientos_updated', handleUpdate);
    window.addEventListener('notificaciones_updated', handleUpdate);
    return () => {
      window.removeEventListener('mantenimientos_updated', handleUpdate);
      window.removeEventListener('notificaciones_updated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 5000);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  // Filtrado de notificaciones del historial según el rol y usuario
  const notificacionesUsuario = useMemo(() => {
    return notificaciones.filter((n) => {
      // 1. Si el usuario activo es Técnico: solo recibe sus OTs y estados de externalización
      if (esTecnico) {
        if (n.destinatario_id && n.destinatario_id === usuarioActivo.id) return true;
        if (
          n.destinatario_nombre &&
          usuarioActivo.nombre &&
          n.destinatario_nombre.trim().toLowerCase() === usuarioActivo.nombre.trim().toLowerCase()
        ) {
          return true;
        }
        if (
          n.destinatario_rol === 'Ingeniero de Servicio / Técnico' &&
          !n.destinatario_id &&
          !n.destinatario_nombre
        ) {
          return true;
        }
        return false;
      }

      // 2. Si es Supervisor o Admin: solicitudes de externalización y alertas del sistema
      if (esSupervisorOAdmin) {
        if (n.destinatario_rol === 'Ingeniero Supervisor') return true;
        if (n.destinatario_id && n.destinatario_id === usuarioActivo.id) return true;
        if (
          n.destinatario_nombre &&
          usuarioActivo.nombre &&
          n.destinatario_nombre.trim().toLowerCase() === usuarioActivo.nombre.trim().toLowerCase()
        ) {
          return true;
        }
        if (
          usuarioActivo.rol === 'Administrador (Jefe de Unidad)' ||
          usuarioActivo.rol?.includes('Administrador')
        ) {
          return true;
        }
        if (!n.destinatario_rol && !n.destinatario_id) return true;
      }

      if (n.destinatario_id && n.destinatario_id === usuarioActivo.id) return true;
      if (
        n.destinatario_nombre &&
        usuarioActivo.nombre &&
        n.destinatario_nombre.trim().toLowerCase() === usuarioActivo.nombre.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    });
  }, [notificaciones, usuarioActivo, esSupervisorOAdmin, esTecnico]);

  const notificacionesHistorialFiltradas = useMemo(() => {
    return notificacionesUsuario.filter((n) => {
      if (filtroHistorial === 'no_leidas') return !n.leida;
      return true;
    });
  }, [notificacionesUsuario, filtroHistorial]);

  const conteoNoLeidas = useMemo(() => {
    return notificacionesUsuario.filter((n) => !n.leida).length;
  }, [notificacionesUsuario]);

  // ==========================================
  // ACCIÓN AUTORIZAR (BOTÓN VERDE)
  // ==========================================
  async function handleAutorizar(ot: Mantenimiento) {
    setProcesandoId(ot.id);
    try {
      const tecnicoSolicitante =
        ot.externalizacion_solicitada_por ||
        ot.solicitante_externalizacion ||
        ot.asignado_a ||
        'Técnico de Servicio';
      const modalidadSugerida =
        (ot.tipo_externalizacion as TipoExternalizacion) ||
        'Compra de repuesto por Informe de requerimiento';
      const justificacion =
        ot.motivo_externalizacion || ot.problema_reportado || 'Externalización autorizada por Supervisión';

      // 1. Actualiza la OT en mantenimientos: requiere_externalizacion = true y estado_solicitud_externalizacion = 'Aprobada'
      const updatedOT = {
        ...ot,
        requiere_externalizacion: true,
        estado_solicitud_externalizacion: 'Aprobada' as const,
        externalizacion_resuelta_por: usuarioActivo.nombre,
      };

      await saveMantenimientoRecord({
        id: ot.id,
        codigo: ot.codigo,
        isEdit: true,
        payload: updatedOT,
      });

      await supabase
        .from('mantenimientos')
        .update({
          requiere_externalizacion: true,
          estado_solicitud_externalizacion: 'Aprobada',
          externalizacion_resuelta_por: usuarioActivo.nombre,
        })
        .eq('id', ot.id);

      // 2. Crea automáticamente el registro en la tabla externalizaciones con los campos exactos requeridos
      await guardarExternalizacionParaMantenimiento({
        mantId: ot.id,
        mantCodigo: ot.codigo,
        tipo: modalidadSugerida,
        clasificacion: modalidadSugerida,
        descripcion: justificacion,
        descripcionRequerimiento: justificacion,
        equipoIdentificacion: ot.equipo_identificacion,
        equipoId: ot.equipo_id,
        solicitante: tecnicoSolicitante,
      });

      // Resolver ID del técnico destinatario
      let tecId: string | null = null;
      const { data: uData } = await supabase.from('perfiles').select('*');
      if (uData && Array.isArray(uData) && tecnicoSolicitante) {
        const u = uData.find(
          (usr) => usr.nombre?.toLowerCase() === tecnicoSolicitante.toLowerCase()
        );
        if (u) tecId = u.id;
      }

      // 3. Envía una notificación con tipo 'externalizacion_aprobada'
      await supabase.from('notificaciones').insert({
        destinatario_rol: 'Ingeniero de Servicio / Técnico',
        destinatario_id: tecId,
        destinatario_nombre: tecnicoSolicitante,
        titulo: `Externalización Autorizada: ${ot.codigo}`,
        mensaje: `El requerimiento de compra/servicio externo fue aprobado e ingresado a Compras.`,
        tipo: 'externalizacion_aprobada',
        leida: false,
        mantenimiento_id: ot.id,
        codigo_mantenimiento: ot.codigo,
        codigo_mantenimiento_ref: ot.codigo,
      });

      // 4. Marcar notificaciones previas de solicitud para esta OT como leídas
      await supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('codigo_mantenimiento', ot.codigo);

      setToastMsg({
        tipo: 'ok',
        text: `¡Externalización para ${ot.codigo} autorizada! Se generó el requerimiento en Compras y se notificó al técnico.`,
      });

      // 5. Actualiza la lista y descuenta el contador
      window.dispatchEvent(new CustomEvent('mantenimientos_updated'));
      window.dispatchEvent(new CustomEvent('notificaciones_updated'));
      window.dispatchEvent(new CustomEvent('externalizaciones_updated'));
      await cargarDatos();
    } catch (err) {
      console.error('Error al autorizar externalización:', err);
      setToastMsg({
        tipo: 'err',
        text: 'Ocurrió un error al procesar la autorización. Inténtalo nuevamente.',
      });
    } finally {
      setProcesandoId(null);
    }
  }

  // ==========================================
  // ACCIÓN RECHAZAR (BOTÓN ROJO CON CONFIRMACIÓN)
  // ==========================================
  function abrirConfirmacionRechazo(ot: Mantenimiento) {
    setSolicitudARechazar(ot);
    setMotivoRechazo('La orden de trabajo debe resolverse internamente con capacidades e insumos locales.');
  }

  async function handleConfirmarRechazo() {
    if (!solicitudARechazar) return;
    const ot = solicitudARechazar;
    setProcesandoId(ot.id);

    try {
      const justificacionRechazo =
        motivoRechazo.trim() || 'La orden de trabajo debe resolverse internamente con capacidades e insumos locales.';

      // 1. Actualiza la OT: requiere_externalizacion = false y estado_solicitud_externalizacion = 'Rechazada'
      const updatedOT = {
        ...ot,
        requiere_externalizacion: false,
        estado_solicitud_externalizacion: 'Rechazada' as const,
        externalizacion_resuelta_por: usuarioActivo.nombre,
        motivo_externalizacion: justificacionRechazo,
      };

      await saveMantenimientoRecord({
        id: ot.id,
        codigo: ot.codigo,
        isEdit: true,
        payload: updatedOT,
      });

      await supabase
        .from('mantenimientos')
        .update({
          requiere_externalizacion: false,
          estado_solicitud_externalizacion: 'Rechazada',
          externalizacion_resuelta_por: usuarioActivo.nombre,
          motivo_externalizacion: justificacionRechazo,
        })
        .eq('id', ot.id);

      const tecnicoSolicitante =
        ot.externalizacion_solicitada_por ||
        ot.solicitante_externalizacion ||
        ot.asignado_a ||
        'Técnico de Servicio';

      let tecId: string | null = null;
      const { data: uData } = await supabase.from('perfiles').select('*');
      if (uData && Array.isArray(uData) && tecnicoSolicitante) {
        const u = uData.find(
          (usr) => usr.nombre?.toLowerCase() === tecnicoSolicitante.toLowerCase()
        );
        if (u) tecId = u.id;
      }

      // 2. Notificación con tipo 'externalizacion_rechazada'
      await supabase.from('notificaciones').insert({
        destinatario_rol: 'Ingeniero de Servicio / Técnico',
        destinatario_id: tecId,
        destinatario_nombre: tecnicoSolicitante,
        titulo: `Externalización Desestimada: ${ot.codigo}`,
        mensaje: `La solicitud fue rechazada por supervisión. La OT debe resolverse por vía interna.`,
        tipo: 'externalizacion_rechazada',
        leida: false,
        mantenimiento_id: ot.id,
        codigo_mantenimiento: ot.codigo,
        codigo_mantenimiento_ref: ot.codigo,
      });

      // 3. Marcar notificaciones previas de solicitud para esta OT como leídas
      await supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('codigo_mantenimiento', ot.codigo);

      setToastMsg({
        tipo: 'ok',
        text: `Solicitud de externalización para ${ot.codigo} rechazada. Se instruyó al técnico para atención interna.`,
      });

      setSolicitudARechazar(null);

      // 4. Actualiza la lista y descuenta el contador
      window.dispatchEvent(new CustomEvent('mantenimientos_updated'));
      window.dispatchEvent(new CustomEvent('notificaciones_updated'));
      await cargarDatos();
    } catch (err) {
      console.error('Error al rechazar solicitud:', err);
      setToastMsg({
        tipo: 'err',
        text: 'Ocurrió un error al registrar el rechazo.',
      });
    } finally {
      setProcesandoId(null);
    }
  }

  // Marcar notificación individual como leída / no leída
  async function marcarLeida(id: string, leida: boolean = true) {
    try {
      await supabase.from('notificaciones').update({ leida }).eq('id', id);
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === id ? { ...n, leida } : n))
      );
      window.dispatchEvent(new CustomEvent('notificaciones_updated'));
    } catch (err) {
      console.warn('Error marcando notificación:', err);
    }
  }

  // Marcar todas como leídas
  async function marcarTodasLeidas() {
    try {
      for (const n of notificacionesUsuario) {
        if (!n.leida) {
          await supabase.from('notificaciones').update({ leida: true }).eq('id', n.id);
        }
      }
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
      window.dispatchEvent(new CustomEvent('notificaciones_updated'));
      setToastMsg({ tipo: 'ok', text: 'Todas las notificaciones fueron marcadas como leídas.' });
    } catch {
      // ignore
    }
  }

  // Eliminar notificación
  async function eliminarNotificacion(id: string) {
    try {
      await supabase.from('notificaciones').delete().eq('id', id);
      setNotificaciones((prev) => prev.filter((n) => n.id !== id));
      window.dispatchEvent(new CustomEvent('notificaciones_updated'));
    } catch (err) {
      console.warn('Error eliminando notificación:', err);
    }
  }

  if (!open) return null;

  return (
    <div
      id="modal-bandeja-notificaciones"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-bandeja-notificaciones"
    >
      <div className="flex flex-col w-full max-w-3xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm ring-4 ring-blue-50">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="titulo-bandeja-notificaciones" className="text-base font-bold text-slate-900">
                  {esTecnico
                    ? 'Bandeja de Avisos y Notificaciones'
                    : 'Bandeja de Entrada y Aprobación de Externalizaciones'}
                </h2>
                {esTecnico ? (
                  conteoNoLeidas > 0 ? (
                    <span
                      id="badge-modal-conteo-pendientes"
                      className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-black text-white shadow-xs"
                    >
                      {conteoNoLeidas} sin leer
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      Al día
                    </span>
                  )
                ) : solicitudesPendientes.length > 0 ? (
                  <span
                    id="badge-modal-conteo-pendientes"
                    className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-black text-white shadow-xs"
                  >
                    {solicitudesPendientes.length} por autorizar
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">
                {esTecnico
                  ? 'Órdenes de Trabajo Asignadas, Resoluciones de Compras y Recepción de Insumos'
                  : 'Supervisión Técnica UEM • Evaluación de Compras Externas y Notificaciones'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              id="btn-actualizar-inbox"
              type="button"
              onClick={cargarDatos}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
              title="Actualizar datos"
              aria-label="Actualizar datos"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              id="btn-cerrar-inbox"
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              title="Cerrar bandeja"
              aria-label="Cerrar bandeja"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert Toast */}
        {toastMsg && (
          <div
            id="toast-inbox-feedback"
            className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
              toastMsg.tipo === 'ok'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {toastMsg.tipo === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
              )}
              <span>{toastMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMsg(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Tabs de Navegación de la Bandeja */}
        {esSupervisorOAdmin ? (
          <div className="flex items-center justify-between px-6 py-2.5 bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <button
                id="tab-solicitudes-pendientes"
                type="button"
                onClick={() => setPestanaActiva('solicitudes')}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  pestanaActiva === 'solicitudes'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Solicitudes Pendientes</span>
                {solicitudesPendientes.length > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                      pestanaActiva === 'solicitudes'
                        ? 'bg-white text-red-700'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {solicitudesPendientes.length}
                  </span>
                )}
              </button>

              <button
                id="tab-historial-notificaciones"
                type="button"
                onClick={() => setPestanaActiva('historial')}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  pestanaActiva === 'historial'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Bell className="h-3.5 w-3.5" />
                <span>Historial de Avisos</span>
                {conteoNoLeidas > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                      pestanaActiva === 'historial'
                        ? 'bg-white text-slate-900'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {conteoNoLeidas}
                  </span>
                )}
              </button>
            </div>

            {pestanaActiva === 'historial' && (
              <button
                id="btn-marcar-todas-leidas-top"
                type="button"
                onClick={marcarTodasLeidas}
                disabled={conteoNoLeidas === 0}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-40 disabled:hover:text-blue-600 transition"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Marcar todas leídas</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <button
                id="filtro-tecnico-todas"
                type="button"
                onClick={() => setFiltroHistorial('todas')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filtroHistorial === 'todas'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>Todas</span>
                <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-bold">
                  {notificacionesUsuario.length}
                </span>
              </button>
              <button
                id="filtro-tecnico-no-leidas"
                type="button"
                onClick={() => setFiltroHistorial('no_leidas')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filtroHistorial === 'no_leidas'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>No leídas</span>
                {conteoNoLeidas > 0 && (
                  <span className="rounded-full bg-white text-blue-700 px-1.5 py-0.2 text-[10px] font-black">
                    {conteoNoLeidas}
                  </span>
                )}
              </button>
            </div>

            <button
              id="btn-marcar-todas-leidas-tecnico"
              type="button"
              onClick={marcarTodasLeidas}
              disabled={conteoNoLeidas === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCheck className="h-3.5 w-3.5 text-blue-600" />
              <span>Marcar todas como leídas</span>
            </button>
          </div>
        )}

        {/* CONTENIDO PRINCIPAL SEGÚN PESTAÑA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading && solicitudesPendientes.length === 0 && notificaciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
              <p className="text-sm font-medium text-slate-600">Consultando solicitudes y avisos...</p>
            </div>
          ) : pestanaActiva === 'solicitudes' ? (
            /* ========================================================= */
            /* LISTADO DE SOLICITUDES PENDIENTES DE EXTERNALIZACIÓN       */
            /* ========================================================= */
            solicitudesPendientes.length === 0 ? (
              <div
                id="empty-state-solicitudes"
                className="flex flex-col items-center justify-center py-16 text-center text-slate-400 rounded-2xl border-2 border-dashed border-slate-200 p-8"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  ¡No hay solicitudes pendientes de externalización!
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Todas las solicitudes de tercerización y compras externas han sido evaluadas por la supervisión técnica.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                  <span>
                    Se encontraron <strong>{solicitudesPendientes.length}</strong> solicitud(es) que requieren visto bueno del Ingeniero Supervisor:
                  </span>
                </div>

                {solicitudesPendientes.map((ot) => {
                  const estaProcesando = procesandoId === ot.id;
                  const tecnicoSolicitante =
                    ot.externalizacion_solicitada_por ||
                    ot.solicitante_externalizacion ||
                    ot.asignado_a ||
                    'Técnico de Servicio';
                  const modalidadSugerida =
                    ot.tipo_externalizacion || 'Compra de repuesto por Informe de requerimiento';
                  const motivo =
                    ot.motivo_externalizacion || ot.problema_reportado || 'Sin motivo ingresado';

                  return (
                    <div
                      key={ot.id}
                      id={`card-solicitud-ot-${ot.id}`}
                      className="rounded-2xl border-2 border-amber-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-amber-300"
                    >
                      {/* Cabecera de la Tarjeta */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-black text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                            OT {ot.codigo}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-300">
                            <Clock className="h-3 w-3" />
                            Pendiente de Autorización
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(ot.created_at || new Date()).toLocaleDateString('es-CL', {
                              dateStyle: 'medium',
                            })}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            if (onOpenMantenimiento) {
                              onOpenMantenimiento(ot.codigo);
                            }
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Abrir OT</span>
                        </button>
                      </div>

                      {/* Grilla de Datos Requeridos en la Solicitud */}
                      <div className="mt-3.5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="space-y-2">
                          <div className="flex items-start gap-2 text-slate-700">
                            <Wrench className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="text-slate-500 font-medium">Equipo Clínico:</span>
                              <p className="font-bold text-slate-900 mt-0.5">
                                {ot.equipo_identificacion || 'Equipo No Especificado'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-2 text-slate-700">
                            <Building2 className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="text-slate-500 font-medium">Servicio Solicitante:</span>
                              <p className="font-bold text-slate-900 mt-0.5">
                                {ot.solicitado_por || 'Servicio Clínico'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-start gap-2 text-slate-700">
                            <User className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="text-slate-500 font-medium">Técnico que solicitó la compra externa:</span>
                              <p className="font-bold text-slate-900 mt-0.5">
                                {tecnicoSolicitante}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-2 text-slate-700">
                            <ShoppingBag className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="text-slate-500 font-medium">Modalidad sugerida:</span>
                              <p className="font-bold text-amber-900 mt-0.5">
                                {modalidadSugerida}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Motivo / Justificación Ingresada por el Técnico */}
                      <div className="mt-4 rounded-xl border border-amber-200/90 bg-amber-50/70 p-3 text-xs text-amber-950">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                          <FileText className="h-3.5 w-3.5" />
                          <span>Motivo / Justificación Técnica:</span>
                        </div>
                        <p className="text-slate-800 leading-relaxed whitespace-pre-line pl-5">
                          {motivo}
                        </p>
                      </div>

                      {/* Barra de Acciones: Autorizar (Botón Verde) vs Rechazar (Botón Rojo) */}
                      {esSupervisorOAdmin ? (
                        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                          <span className="text-[11px] text-slate-500 font-medium">
                            Resolución de la solicitud para la OT {ot.codigo}:
                          </span>

                          <div className="flex items-center gap-2">
                            {/* Botón Rojo: Rechazar */}
                            <button
                              id={`btn-rechazar-ot-${ot.id}`}
                              type="button"
                              disabled={estaProcesando}
                              onClick={() => abrirConfirmacionRechazo(ot)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-xs font-bold text-rose-700 shadow-xs hover:bg-rose-50 active:scale-95 transition disabled:opacity-50"
                              title="Rechazar externalización y resolver internamente"
                            >
                              <X className="h-3.5 w-3.5" />
                              <span>Rechazar</span>
                            </button>

                            {/* Botón Verde: Autorizar */}
                            <button
                              id={`btn-autorizar-ot-${ot.id}`}
                              type="button"
                              disabled={estaProcesando}
                              onClick={() => handleAutorizar(ot)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50"
                              title="Autorizar externalización y derivar a Adquisiciones"
                            >
                              {estaProcesando ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              <span>Autorizar</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 italic">
                          Acción reservada para usuarios con rol de Ingeniero Supervisor o Administrador.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* ========================================================= */
            /* PESTAÑA HISTORIAL DE NOTIFICACIONES Y AVISOS TÉCNICOS      */
            /* ========================================================= */
            <div>
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFiltroHistorial('todas')}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                      filtroHistorial === 'todas'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Todas ({notificacionesUsuario.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroHistorial('no_leidas')}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                      filtroHistorial === 'no_leidas'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    No leídas ({conteoNoLeidas})
                  </button>
                </div>
              </div>

              {notificacionesHistorialFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                    <Bell className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Sin avisos en esta categoría</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {notificacionesHistorialFiltradas.map((n) => {
                    const estilo = getNotificationBadgeConfig(n.tipo);
                    const IconComp = estilo.Icon;
                    const codigoOT =
                      n.codigo_mantenimiento ||
                      n.codigo_mantenimiento_ref ||
                      (n.mantenimiento_id?.startsWith('MANT-') ? n.mantenimiento_id : null);

                    return (
                      <div
                        key={n.id}
                        className={`rounded-xl border p-3.5 sm:p-4 transition-all ${
                          !n.leida
                            ? estilo.cardUnreadClass
                            : 'border-slate-200 bg-white hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div
                              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm shadow-2xs ${estilo.iconContainerClass}`}
                            >
                              <IconComp className="h-4 w-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${estilo.badgeClass}`}
                                >
                                  {estilo.label}
                                </span>
                                {!n.leida && (
                                  <span className="inline-flex items-center rounded-full bg-blue-600 px-1.5 py-0.2 text-[9px] font-black text-white uppercase tracking-wider">
                                    Nueva
                                  </span>
                                )}
                              </div>

                              <h3 className="text-xs font-bold text-slate-900 leading-snug">
                                {n.titulo}
                              </h3>

                              <p className="mt-1 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                                {n.mensaje}
                              </p>

                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100/90">
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                  <Clock className="h-3 w-3 text-slate-400" />
                                  <span>
                                    {new Date(n.created_at).toLocaleString('es-CL', {
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    })}
                                  </span>
                                </div>

                                {codigoOT && (
                                  <button
                                    id={`btn-ver-ot-card-${n.id}`}
                                    type="button"
                                    onClick={async () => {
                                      if (!n.leida) {
                                        await marcarLeida(n.id, true);
                                      }
                                      onClose();
                                      if (onOpenMantenimiento) {
                                        onOpenMantenimiento(codigoOT);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-bold shadow-2xs transition active:scale-95"
                                    title={`Abrir orden de trabajo ${codigoOT} y marcar aviso como leído`}
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    <span>Ver OT {codigoOT}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => marcarLeida(n.id, !n.leida)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                              title={n.leida ? 'Marcar como no leída' : 'Marcar como leída'}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => eliminarNotificacion(n.id)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                              title="Eliminar aviso"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-slate-400" />
            <span>
              Usuario: <strong>{usuarioActivo.nombre}</strong> ({usuarioActivo.rol})
            </span>
          </div>
          <button
            id="btn-cerrar-footer-inbox"
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* DIÁLOGO DE CONFIRMACIÓN DE RECHAZO (BREVE CONFIRMACIÓN)    */}
      {/* ========================================================= */}
      {solicitudARechazar && (
        <div
          id="dialog-confirmacion-rechazo-inbox"
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                  <X className="h-4 w-4" />
                </div>
                <span>Confirmar Rechazo de Externalización</span>
              </div>
              <button
                type="button"
                onClick={() => setSolicitudARechazar(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3.5 space-y-2 text-xs text-slate-600">
              <p>
                ¿Deseas desestimar la externalización para la <strong>OT {solicitudARechazar.codigo}</strong>?
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
                <div><strong>Equipo:</strong> {solicitudARechazar.equipo_identificacion}</div>
                <div><strong>Técnico solicitante:</strong> {solicitudARechazar.externalizacion_solicitada_por || solicitudARechazar.asignado_a || 'Técnico'}</div>
                <div><strong>Modalidad solicitada:</strong> {solicitudARechazar.tipo_externalizacion}</div>
              </div>
            </div>

            <div className="mt-3.5">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Instrucción / Motivo para el técnico (se notificará en su bandeja):
              </label>
              <textarea
                rows={3}
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder="Indica la razón o directriz técnica para resolver internamente..."
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={Boolean(procesandoId)}
                onClick={() => setSolicitudARechazar(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                id="btn-confirmar-rechazo-definitivo"
                type="button"
                disabled={Boolean(procesandoId)}
                onClick={handleConfirmarRechazo}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 active:scale-95 transition disabled:opacity-50"
              >
                {procesandoId ? (
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
