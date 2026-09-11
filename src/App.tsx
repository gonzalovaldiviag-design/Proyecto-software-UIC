import { Component, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  supabase,
  type Equipo,
  type EstadoEquipo,
  type EstadoMantenimiento,
  type ModalidadAdquisicion,
} from '@/lib/supabase';
import { saveMantenimientoRecord } from '@/lib/mantenimientoStorage';
import { AuthProvider, useAuth } from '@/lib/authContext';
import Header from '@/components/Header';
import EquiposView from '@/components/EquiposView';
import MantenimientosView from '@/components/MantenimientosView';
import ExternalizacionView from '@/components/ExternalizacionView';
import UsuariosView from '@/components/UsuariosView';
import EquipoModal from '@/components/EquipoModal';
import HojaVidaModal from '@/components/HojaVidaModal';
import MantenimientoModal, { type MantenimientoFormData } from '@/components/MantenimientoModal';
import MantenimientoChoiceModal from '@/components/MantenimientoChoiceModal';

type Tab = 'inventario' | 'mantenimiento' | 'externalizacion' | 'usuarios';

class TabErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-medium">Ocurrió un error al cargar la vista seleccionada.</p>
            <p className="mt-1 text-rose-600">{this.state.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { puede } = useAuth();
  const [tab, setTab] = useState<Tab>('inventario');

  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Equipo | null>(null);
  const [hojaVidaEquipo, setHojaVidaEquipo] = useState<Equipo | null>(null);
  const [mantModalOpen, setMantModalOpen] = useState(false);
  const [mantEquipo, setMantEquipo] = useState<Equipo | null>(null);
  const [choiceModalOpen, setChoiceModalOpen] = useState(false);
  const [choiceEquipo, setChoiceEquipo] = useState<Equipo | null>(null);

  async function fetchEquipos() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('equipos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setEquipos((data as Equipo[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchEquipos();
  }, []);

  function nextCodigo(): string {
    let max = 0;
    for (const e of equipos) {
      const m = e.codigo.match(/(\d+)\s*$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `EQ-${String(max + 1).padStart(3, '0')}`;
  }

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(eq: Equipo) {
    setEditing(eq);
    setModalOpen(true);
  }

  function openHojaVida(eq: Equipo) {
    setHojaVidaEquipo(eq);
  }

  function openMantenimiento(eq: Equipo) {
    if (!puede('crear_solicitud_ot')) {
      return;
    }
    if (eq.estado === 'Mantenimiento') {
      setChoiceEquipo(eq);
      setChoiceModalOpen(true);
    } else {
      setMantEquipo(eq);
      setMantModalOpen(true);
    }
  }

  function handleChoiceExternalizacion() {
    setChoiceModalOpen(false);
    setChoiceEquipo(null);
    setTab('externalizacion');
  }

  function handleChoiceInterno() {
    if (!puede('crear_solicitud_ot')) {
      return;
    }
    const eq = choiceEquipo;
    setChoiceModalOpen(false);
    setChoiceEquipo(null);
    setMantEquipo(eq);
    setMantModalOpen(true);
  }

  async function handleSaveMantenimiento(data: MantenimientoFormData) {
    if (!puede('crear_solicitud_ot')) {
      return;
    }
    const asignado = (data.asignado_a || '').trim();
    const estadoFinal =
      data.estado_mantenimiento === 'En proceso' && !asignado
        ? 'Pendiente de Asignación'
        : data.estado_mantenimiento ||
          (asignado ? 'En proceso' : 'Pendiente de Asignación');

    const payload = {
      equipo_id: data.equipo_id,
      equipo_identificacion: data.equipo_identificacion,
      problema_reportado: data.problema_reportado,
      solicitado_por: data.solicitado_por,
      asignado_a: data.asignado_a,
      fecha_requerimiento: data.fecha_requerimiento,
      tipo_mantenimiento: data.tipo_mantenimiento,
      estado_mantenimiento: estadoFinal as EstadoMantenimiento,
      accesorios_adicionales: data.accesorios_adicionales,
      descripcion_trabajo_realizado: data.descripcion_trabajo_realizado,
      fecha_cierre: data.fecha_cierre,
      horas_hombre: data.horas_hombre,
      fotos_url: data.fotos_url,
      documentos_url: data.documentos_url,
      completado_por: data.completado_por,
      recibido_por: data.recibido_por,
      numero_informe: data.numero_informe ?? null,
      fecha_emision_informe: data.fecha_emision_informe ?? null,
      diagnostico_final: data.diagnostico_final ?? null,
      repuestos_utilizados: data.repuestos_utilizados ?? null,
      costo: data.costo ?? null,
    };

    const { error } = await saveMantenimientoRecord({
      isEdit: false,
      payload,
    });

    if (error) {
      setError(error.message);
      return;
    }

    if (data.equipo_id) {
      const nuevoEstadoEq = estadoFinal === 'Completado' ? 'Operativo' : 'Mantenimiento';
      await supabase.from('equipos').update({ estado: nuevoEstadoEq }).eq('id', data.equipo_id);
      await fetchEquipos();
    }

    setMantModalOpen(false);
    setMantEquipo(null);
  }

  async function handleSaveEquipo(data: {
    codigo: string;
    nombre: string;
    marca: string;
    modelo: string;
    serie: string;
    ubicacion: string;
    estado: EstadoEquipo;
    inventario: string;
    anio_adquisicion: string;
    orden_compra: string;
    acta_entrega: string;
    vida_util: string;
    vida_util_residual: string;
    modalidad_adquisicion: ModalidadAdquisicion | '';
  }) {
    const payload = {
      codigo: (data.codigo || '').trim(),
      nombre: (data.nombre || '').trim(),
      marca: (data.marca || '').trim() || null,
      modelo: (data.modelo || '').trim() || null,
      serie: (data.serie || '').trim(),
      ubicacion: data.ubicacion || null,
      estado: data.estado,
      inventario: data.inventario || null,
      anio_adquisicion: data.anio_adquisicion ? parseInt(data.anio_adquisicion, 10) : null,
      orden_compra: data.orden_compra || null,
      acta_entrega: data.acta_entrega || null,
      vida_util: data.vida_util ? parseInt(data.vida_util, 10) : null,
      vida_util_residual: data.vida_util_residual ? parseInt(data.vida_util_residual, 10) : null,
      modalidad_adquisicion: data.modalidad_adquisicion || null,
    };

    if (editing) {
      const { error } = await supabase.from('equipos').update(payload).eq('id', editing.id);
      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('equipos').insert(payload);
      if (error) {
        setError(error.message);
        return;
      }
    }

    setModalOpen(false);
    await fetchEquipos();
  }

  async function handleDeleteEquipo(eq: Equipo) {
    if (!puede('dar_baja_equipo')) {
      alert('Solo la Jefatura de Unidad (Administrador) tiene permisos para dar de baja definitiva o eliminar equipamiento.');
      return;
    }
    if (!confirm(`¿Confirmas la eliminación definitiva del equipo "${eq.nombre}" (${eq.codigo})?`)) return;
    const { error } = await supabase.from('equipos').delete().eq('id', eq.id);
    if (error) {
      setError(error.message);
      return;
    }
    await fetchEquipos();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Dynamic Header with RBAC User Switcher and Roles Navigation */}
      <Header currentTab={tab} onTabChange={setTab} onAddEquipo={openAdd} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {tab === 'inventario' && (
          <TabErrorBoundary>
            <EquiposView
              equipos={equipos}
              loading={loading}
              error={error}
              onClearError={() => setError(null)}
              onOpenAdd={openAdd}
              onOpenEdit={openEdit}
              onOpenMantenimiento={openMantenimiento}
              onOpenHojaVida={openHojaVida}
              onDelete={handleDeleteEquipo}
            />
          </TabErrorBoundary>
        )}

        {tab === 'mantenimiento' && (
          <TabErrorBoundary>
            <MantenimientosView equipos={equipos} onEquiposChanged={fetchEquipos} />
          </TabErrorBoundary>
        )}

        {tab === 'externalizacion' && (
          <TabErrorBoundary>
            <ExternalizacionView
              equipos={equipos}
              onNavigateToMantenimiento={() => setTab('mantenimiento')}
            />
          </TabErrorBoundary>
        )}

        {tab === 'usuarios' && (
          <TabErrorBoundary>
            <UsuariosView />
          </TabErrorBoundary>
        )}
      </main>

      {/* Equipo Add / Edit Modal */}
      <EquipoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveEquipo}
        equipo={editing}
        siguienteCodigo={editing ? undefined : nextCodigo()}
      />

      {/* Choice Modal (Interno vs Externalización) */}
      <MantenimientoChoiceModal
        open={choiceModalOpen}
        onClose={() => {
          setChoiceModalOpen(false);
          setChoiceEquipo(null);
        }}
        equipo={choiceEquipo}
        onNuevo={handleChoiceInterno}
        onSelectInterno={handleChoiceInterno}
        onSelectExternalizacion={handleChoiceExternalizacion}
      />

      {/* Mantenimiento Modal */}
      <MantenimientoModal
        open={mantModalOpen}
        onClose={() => {
          setMantModalOpen(false);
          setMantEquipo(null);
        }}
        onSave={handleSaveMantenimiento}
        equipos={equipos}
        equipoPreseleccionado={mantEquipo}
      />

      {/* Hoja de Vida Modal */}
      <HojaVidaModal
        open={hojaVidaEquipo != null}
        onClose={() => setHojaVidaEquipo(null)}
        equipo={hojaVidaEquipo}
        onOpenMantenimiento={openMantenimiento}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
