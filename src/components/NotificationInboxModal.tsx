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
} from 'lucide-react';
import {
  supabase,
  type Notificacion,
  type Mantenimiento,
} from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';
import { saveMantenimientoRecord, enrichMantenimiento } from '@/lib/mantenimientoStorage';
import { guardarExternalizacionParaMantenimiento } from '@/lib/externalizacionStorage';

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
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<'todas' | 'pendientes' | 'no_leidas'>('todas');
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ tipo: 'ok' | 'err'; text: string } | null>(null);

  // In-app modal para rechazo con motivo sin window.prompt
  const [solicitudARechazar, setSolicitudARechazar] = useState<Notificacion | null>(null);
  const [motivoRechazoInbox, setMotivoRechazoInbox] = useState('');

  const esSupervisorOAdmin =
    usuarioActivo.rol === 'Ingeniero Supervisor' ||
    usuarioActivo.rol === 'Administrador (Jefe de Unidad)';

  async function cargarNotificaciones() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notificaciones')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error cargando notificaciones:', error);
      } else {
        setNotificaciones((data as Notificacion[]) || []);
      }
    } catch (err) {
      console.warn('Error en fetch notificaciones:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      cargarNotificaciones();
    }
  }, [open]);

  useEffect(() => {
    function handleUpdate() {
      cargarNotificaciones();
    }
    window.addEventListener('notificaciones_updated', handleUpdate);
    return () => window.removeEventListener('notificaciones_updated', handleUpdate);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 5000);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  // Filtrar las notificaciones pertinentes al rol y usuario actual
  const notificacionesUsuario = useMemo(() => {
    return notificaciones.filter((n) => {
      // Si tiene destinatario específico por ID
      if (n.destinatario_id && n.destinatario_id === usuarioActivo.id) return true;

      // Si tiene rol de destinatario
      if (n.destinatario_rol) {
        if (esSupervisorOAdmin && n.destinatario_rol === 'Ingeniero Supervisor') return true;
        if (
          usuarioActivo.rol === 'Ingeniero de Servicio / Técnico' &&
          n.destinatario_rol === 'Ingeniero de Servicio / Técnico'
        ) {
          return true;
        }
      }

      // Si no tiene restricciones, visible para todos o supervisores
      if (!n.destinatario_rol && !n.destinatario_id) return true;

      // Si es Admin, tiene visibilidad de auditoría global
      if (usuarioActivo.rol === 'Administrador (Jefe de Unidad)') return true;

      return false;
    });
  }, [notificaciones, usuarioActivo, esSupervisorOAdmin]);

  const notificacionesFiltradas = useMemo(() => {
    return notificacionesUsuario.filter((n) => {
      if (filtroTipo === 'pendientes') {
        return n.tipo === 'solicitud_externalizacion' && !n.leida;
      }
      if (filtroTipo === 'no_leidas') {
        return !n.leida;
      }
      return true;
    });
  }, [notificacionesUsuario, filtroTipo]);

  const conteoNoLeidas = useMemo(() => {
    return notificacionesUsuario.filter((n) => !n.leida).length;
  }, [notificacionesUsuario]);

  const conteoPendientesAprobacion = useMemo(() => {
    return notificacionesUsuario.filter(
      (n) => n.tipo === 'solicitud_externalizacion' && !n.leida
    ).length;
  }, [notificacionesUsuario]);

  async function marcarLeida(id: string, leida: boolean = true) {
    try {
      await supabase.from('notificaciones').update({ leida }).eq('id', id);
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === id ? { ...n, leida } : n))
      );
      window.dispatchEvent(new CustomEvent('notificaciones_updated'));
    } catch (err) {
      console.warn('Error marcando leída:', err);
    }
  }

  async function marcarTodasLeidas() {
    try {
      for (const n of notificacionesUsuario) {
        if (!n.leida) {
          await supabase.from('notificaciones').update({ leida: true }).eq('id', n.id);
        }
      }
      setNotificaciones((prev) =>
        prev.map((n) => ({ ...n, leida: true }))
      );
      window.dispatchEvent(new CustomEvent('notificaciones_updated'));
      setToastMsg({ tipo: 'ok', text: 'Todas las notificaciones fueron marcadas como leídas' });
    } catch {
      // ignore
    }
  }

  async function eliminarNotificacion(id: string) {
    try {
      await supabase.from('notificaciones').delete().eq('id', id);
      setNotificaciones((prev) => prev.filter((n) => n.id !== id));
      window.dispatchEvent(new CustomEvent('notificaciones_updated'));
    } catch (err) {
      console.warn('Error eliminando notificación:', err);
    }
  }

  // Aprobación de Externalización desde la Bandeja (Ingeniero Supervisor / Admin)
  async function handleAprobarSolicitud(n: Notificacion) {
    if (!n.codigo_mantenimiento && !n.mantenimiento_id) return;
    setProcesandoId(n.id);

    try {
      // 1. Obtener la orden de mantenimiento correspondiente
      const { data } = await supabase
        .from('mantenimientos')
        .select('*')
        .eq(n.mantenimiento_id ? 'id' : 'codigo', n.mantenimiento_id || n.codigo_mantenimiento);

      const raw = Array.isArray(data) ? data[0] : data;
      if (!raw) {
        setToastMsg({
          tipo: 'err',
          text: `No se encontró la orden ${n.codigo_mantenimiento || ''} en la base de datos`,
        });
        setProcesandoId(null);
        return;
      }

      const ot = enrichMantenimiento(raw as Mantenimiento);

      // 2. Actualizar estado de aprobación en la OT
      const updatedOTPayload: Record<string, unknown> = {
        ...ot,
        requiere_externalizacion: true,
        estado_solicitud_externalizacion: 'Aprobada',
        externalizacion_resuelta_por: usuarioActivo.nombre,
      };

      await saveMantenimientoRecord({
        id: ot.id,
        codigo: ot.codigo,
        isEdit: true,
        payload: updatedOTPayload,
      });

      // 3. Crear o sincronizar en el módulo de Externalización / Adquisiciones
      await guardarExternalizacionParaMantenimiento({
        mantId: ot.id,
        mantCodigo: ot.codigo,
        tipo: ot.tipo_externalizacion || 'Compra de servicio de mantenimiento o reparación externa',
        descripcion: `Externalización Aprobada por ${usuarioActivo.nombre}. Justificación: ${ot.motivo_externalizacion || ot.problema_reportado}`,
        equipoIdentificacion: ot.equipo_identificacion,
        equipoId: ot.equipo_id,
        solicitante: ot.externalizacion_solicitada_por || ot.solicitado_por || usuarioActivo.nombre,
      });

      // 4. Marcar notificación actual como leída
      await supabase.from('notificaciones').update({ leida: true }).eq('id', n.id);

      // 5. Enviar notificación de confirmación al técnico / solicitante
      await supabase.from('notificaciones').insert({
        destinatario_rol: 'Ingeniero de Servicio / Técnico',
        destinatario_id: null,
        titulo: `Externalización Aprobada — ${ot.codigo}`,
        mensaje: `El Supervisor ${usuarioActivo.nombre} ha aprobado la externalización para la OT ${ot.codigo} (${ot.equipo_identificacion}). El requerimiento fue derivado a Adquisiciones para cotización y compra.`,
        tipo: 'info',
        leida: false,
        mantenimiento_id: ot.id,
        codigo_mantenimiento: ot.codigo,
      });

      setToastMsg({
        tipo: 'ok',
        text: `¡Externalización autorizada para ${ot.codigo}! Se derivó a Adquisiciones y se notificó al técnico.`,
      });

      await cargarNotificaciones();
      window.dispatchEvent(new CustomEvent('mantenimientos_updated'));
      window.dispatchEvent(new CustomEvent('notificaciones_updated'));
    } catch (err) {
      console.error('Error aprobando externalización:', err);
      setToastMsg({
        tipo: 'err',
        text: 'Ocurrió un problema al procesar la aprobación. Inténtalo nuevamente.',
      });
    } finally {
      setProcesandoId(null);
    }
  }

  // Rechazo de Externalización desde la Bandeja
  function abrirModalRechazoInbox(n: Notificacion) {
    setSolicitudARechazar(n);
    setMotivoRechazoInbox('La orden debe ser atendida con insumos y capacidades locales de la unidad técnica.');
  }

  async function handleConfirmarRechazoInbox() {
    if (!solicitudARechazar) return;
    const n = solicitudARechazar;
    if (!n.codigo_mantenimiento && !n.mantenimiento_id) return;
    const motivoRechazo = motivoRechazoInbox.trim() || 'La orden debe ser atendida con capacidades e insumos locales.';

    setProcesandoId(n.id);

    try {
      const { data } = await supabase
        .from('mantenimientos')
        .select('*')
        .eq(n.mantenimiento_id ? 'id' : 'codigo', n.mantenimiento_id || n.codigo_mantenimiento);

      const raw = Array.isArray(data) ? data[0] : data;
      if (!raw) {
        setToastMsg({
          tipo: 'err',
          text: `No se encontró la orden ${n.codigo_mantenimiento || ''}`,
        });
        setProcesandoId(null);
        return;
      }

      const ot = enrichMantenimiento(raw as Mantenimiento);

      // Actualizar estado a Rechazada en la OT
      await saveMantenimientoRecord({
        id: ot.id,
        codigo: ot.codigo,
        isEdit: true,
        payload: {
          ...ot,
          requiere_externalizacion: false,
          estado_solicitud_externalizacion: 'Rechazada',
          externalizacion_resuelta_por: usuarioActivo.nombre,
          motivo_externalizacion: motivoRechazo,
        },
      });

      // Marcar notificación actual como leída
      await supabase.from('notificaciones').update({ leida: true }).eq('id', n.id);

      // Notificar al técnico
      await supabase.from('notificaciones').insert({
        destinatario_rol: 'Ingeniero de Servicio / Técnico',
        destinatario_id: null,
        titulo: `Externalización Rechazada — ${ot.codigo}`,
        mensaje: `La solicitud de externalización para la OT ${ot.codigo} fue rechazada por el Supervisor ${usuarioActivo.nombre}.${motivoRechazo ? ` Observación: ${motivoRechazo}` : ''}`,
        tipo: 'alerta',
        leida: false,
        mantenimiento_id: ot.id,
        codigo_mantenimiento: ot.codigo,
      });

      setToastMsg({
        tipo: 'ok',
        text: `Solicitud de ${ot.codigo} rechazada. Se informó al técnico de servicio.`,
      });

      setSolicitudARechazar(null);
      await cargarNotificaciones();
      window.dispatchEvent(new CustomEvent('mantenimientos_updated'));
      window.dispatchEvent(new CustomEvent('notificaciones_updated'));
    } catch (err) {
      console.error('Error rechazando solicitud:', err);
      setToastMsg({
        tipo: 'err',
        text: 'Ocurrió un error al registrar el rechazo.',
      });
    } finally {
      setProcesandoId(null);
    }
  }

  if (!open) return null;

  return (
    <div
      id="modal-bandeja-notificaciones"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-bandeja-notificaciones"
    >
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm ring-4 ring-blue-50">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="titulo-bandeja-notificaciones" className="text-base font-bold text-slate-900">
                  Bandeja de Notificaciones UEM
                </h2>
                {conteoNoLeidas > 0 && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800 border border-blue-200">
                    {conteoNoLeidas} no leída{conteoNoLeidas === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Flujo de Aprobación de Externalización y Alertas Técnicas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cargarNotificaciones}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
              title="Actualizar bandeja"
              aria-label="Actualizar bandeja"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              title="Cerrar bandeja"
              aria-label="Cerrar bandeja"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Toast Alert Inside Modal */}
        {toastMsg && (
          <div
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

        {/* Filters and Batch Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-white border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFiltroTipo('todas')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filtroTipo === 'todas'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas ({notificacionesUsuario.length})
            </button>
            {esSupervisorOAdmin && (
              <button
                type="button"
                onClick={() => setFiltroTipo('pendientes')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  filtroTipo === 'pendientes'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                <Clock className="h-3 w-3" />
                <span>Solicitudes Pendientes</span>
                {conteoPendientesAprobacion > 0 && (
                  <span className="ml-0.5 rounded-full bg-amber-200/80 px-1.5 py-0.2 text-[10px] font-bold text-amber-900">
                    {conteoPendientesAprobacion}
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setFiltroTipo('no_leidas')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filtroTipo === 'no_leidas'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
              }`}
            >
              No leídas ({conteoNoLeidas})
            </button>
          </div>

          {conteoNoLeidas > 0 && (
            <button
              type="button"
              onClick={marcarTodasLeidas}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition"
            >
              Marcar todas como leídas
            </button>
          )}
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 sm:p-4 space-y-2">
          {loading && notificaciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600 mb-2" />
              <p className="text-sm font-medium text-slate-600">Cargando notificaciones...</p>
            </div>
          ) : notificacionesFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                <Bell className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Bandeja despejada</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                No hay notificaciones {filtroTipo === 'pendientes' ? 'pendientes de aprobación' : 'en este momento'}.
              </p>
            </div>
          ) : (
            notificacionesFiltradas.map((n) => {
              const esSolicitud = n.tipo === 'solicitud_externalizacion';
              const estaProcesando = procesandoId === n.id;

              return (
                <div
                  key={n.id}
                  className={`rounded-xl border p-4 transition-all ${
                    !n.leida
                      ? esSolicitud
                        ? 'border-amber-300 bg-amber-50/60 shadow-xs'
                        : 'border-blue-200 bg-blue-50/40 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm ${
                          esSolicitud
                            ? 'bg-amber-100 text-amber-700'
                            : n.tipo === 'alerta'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {esSolicitud ? (
                          <ShoppingBag className="h-4 w-4" />
                        ) : n.tipo === 'alerta' ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 leading-snug">
                            {n.titulo}
                          </h3>
                          {!n.leida && (
                            <span className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                              Nueva
                            </span>
                          )}
                          {esSolicitud && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                              <Clock className="h-2.5 w-2.5" />
                              Requiere Visto Bueno
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                          {n.mensaje}
                        </p>

                        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                          <span>
                            {new Date(n.created_at).toLocaleString('es-CL', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>

                          {n.codigo_mantenimiento && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                if (onOpenMantenimiento) {
                                  onOpenMantenimiento(n.codigo_mantenimiento!);
                                }
                              }}
                              className="inline-flex items-center gap-1 font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Ver OT {n.codigo_mantenimiento}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {!n.leida ? (
                        <button
                          type="button"
                          onClick={() => marcarLeida(n.id, true)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                          title="Marcar como leída"
                          aria-label="Marcar como leída"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => marcarLeida(n.id, false)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                          title="Marcar como no leída"
                          aria-label="Marcar como no leída"
                        >
                          <Clock className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => eliminarNotificacion(n.id)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        title="Eliminar notificación"
                        aria-label="Eliminar notificación"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Acciones de Aprobación de Externalización para Supervisor */}
                  {esSolicitud && esSupervisorOAdmin && (
                    <div className="mt-3 pt-3 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-amber-800">
                        ¿Autorizar compra / tercerización externa para esta orden?
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={estaProcesando}
                          onClick={() => abrirModalRechazoInbox(n)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 active:scale-95 transition disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Rechazar</span>
                        </button>

                        <button
                          type="button"
                          disabled={estaProcesando}
                          onClick={() => handleAprobarSolicitud(n)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50"
                        >
                          {estaProcesando ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          <span>Autorizar Externalización</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <UserCheck className="h-4 w-4 text-slate-400" />
            <span>Perfil: <strong>{usuarioActivo.rol}</strong></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Sub-modal de Confirmación de Rechazo en la Bandeja */}
      {solicitudARechazar && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                  <X className="h-4 w-4" />
                </div>
                <span>Rechazar Solicitud {solicitudARechazar.codigo_mantenimiento}</span>
              </div>
              <button
                type="button"
                onClick={() => setSolicitudARechazar(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-600">
              Ingresa la justificación o instrucción para que el técnico atienda el requerimiento de forma interna:
            </p>

            <div className="mt-3">
              <textarea
                rows={3}
                value={motivoRechazoInbox}
                onChange={(e) => setMotivoRechazoInbox(e.target.value)}
                placeholder="Motivo del rechazo..."
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={Boolean(procesandoId)}
                onClick={() => setSolicitudARechazar(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={Boolean(procesandoId)}
                onClick={handleConfirmarRechazoInbox}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 active:scale-95 transition disabled:opacity-50"
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
