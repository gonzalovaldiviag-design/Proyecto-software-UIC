import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { EstadoEquipo, Equipo, ModalidadAdquisicion } from '@/lib/supabase';

interface EquipoModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
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
  }) => void;
  editing?: Equipo | null;
  defaultCodigo?: string;
}

const modalidades: ModalidadAdquisicion[] = ['Propio', 'Arriendo', 'Comodato'];

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

export default function EquipoModal({ open, onClose, onSave, editing, defaultCodigo }: EquipoModalProps) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [serie, setSerie] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [estado, setEstado] = useState<EstadoEquipo>('Operativo');
  const [inventario, setInventario] = useState('');
  const [anioAdquisicion, setAnioAdquisicion] = useState('');
  const [ordenCompra, setOrdenCompra] = useState('');
  const [actaEntrega, setActaEntrega] = useState('');
  const [vidaUtil, setVidaUtil] = useState('');
  const [vidaUtilResidual, setVidaUtilResidual] = useState('');
  const [modalidad, setModalidad] = useState<ModalidadAdquisicion | ''>('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setTouched(false);
      if (editing) {
        setCodigo(editing.codigo);
        setNombre(editing.nombre);
        setMarca(editing.marca ?? '');
        setModelo(editing.modelo ?? '');
        setSerie(editing.serie ?? '');
        setUbicacion(editing.ubicacion ?? '');
        setEstado(editing.estado);
        setInventario(editing.inventario ?? '');
        setAnioAdquisicion(editing.anio_adquisicion?.toString() ?? '');
        setOrdenCompra(editing.orden_compra ?? '');
        setActaEntrega(editing.acta_entrega ?? '');
        setVidaUtil(editing.vida_util?.toString() ?? '');
        setVidaUtilResidual(editing.vida_util_residual?.toString() ?? '');
        setModalidad(editing.modalidad_adquisicion ?? '');
      } else {
        setCodigo(defaultCodigo ?? '');
        setNombre('');
        setMarca('');
        setModelo('');
        setSerie('');
        setUbicacion('');
        setEstado('Operativo');
        setInventario('');
        setAnioAdquisicion('');
        setOrdenCompra('');
        setActaEntrega('');
        setVidaUtil('');
        setVidaUtilResidual('');
        setModalidad('');
      }
    }
  }, [open, editing, defaultCodigo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const valid = nombre.trim() !== '' && serie.trim() !== '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    onSave({
      codigo: codigo.trim(),
      nombre: nombre.trim(),
      marca: marca.trim(),
      modelo: modelo.trim(),
      serie: serie.trim(),
      ubicacion: ubicacion.trim(),
      estado,
      inventario: inventario.trim(),
      anio_adquisicion: anioAdquisicion.trim(),
      orden_compra: ordenCompra.trim(),
      acta_entrega: actaEntrega.trim(),
      vida_util: vidaUtil.trim(),
      vida_util_residual: vidaUtilResidual.trim(),
      modalidad_adquisicion: modalidad,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/60">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {editing ? 'Editar Equipo' : 'Agregar Equipo'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {editing ? 'Actualiza los datos del equipo' : 'Completa los datos del nuevo equipo'}
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

        <form onSubmit={handleSubmit} className="max-h-[calc(100vh-12rem)] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Código / ID
              </label>
              <div className="relative">
                <input
                  className={`${inputClass} ${!editing ? 'bg-slate-50 pr-10 font-mono' : ''}`}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="EQ-011"
                  readOnly={!editing}
                />
                {!editing && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                    auto
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {editing ? 'Identificador del equipo' : 'Se genera automáticamente en orden correlativo'}
              </p>
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Nombre / Equipo <span className="text-rose-500">*</span>
              </label>
              <input
                className={inputClass}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Monitor de Signos Vitales"
              />
              {touched && !nombre.trim() && (
                <p className="mt-1 text-xs text-rose-500">El nombre es obligatorio</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Servicio Clínico
              </label>
              <input
                className={inputClass}
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="UCI - Sala 3"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Marca</label>
              <input
                className={inputClass}
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                placeholder="Philips"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Modelo</label>
              <input
                className={inputClass}
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder="MX450"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Serie <span className="text-rose-500">*</span>
              </label>
              <input
                className={inputClass}
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                placeholder="SN-2024-001"
              />
              {touched && !serie.trim() && (
                <p className="mt-1 text-xs text-rose-500">La serie es obligatoria</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Inventario</label>
              <input
                className={inputClass}
                value={inventario}
                onChange={(e) => setInventario(e.target.value)}
                placeholder="INV-00123"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Año de Adquisición
              </label>
              <input
                type="number"
                className={inputClass}
                value={anioAdquisicion}
                onChange={(e) => setAnioAdquisicion(e.target.value)}
                placeholder="2023"
                min="1900"
                max="2100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Orden de Compra
              </label>
              <input
                className={inputClass}
                value={ordenCompra}
                onChange={(e) => setOrdenCompra(e.target.value)}
                placeholder="OC-2023-0456"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Acta de Entrega
              </label>
              <input
                className={inputClass}
                value={actaEntrega}
                onChange={(e) => setActaEntrega(e.target.value)}
                placeholder="AE-2023-0078"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Vida Útil (años)
              </label>
              <input
                type="number"
                className={inputClass}
                value={vidaUtil}
                onChange={(e) => setVidaUtil(e.target.value)}
                placeholder="10"
                min="0"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Vida Útil Residual (años)
              </label>
              <input
                type="number"
                className={inputClass}
                value={vidaUtilResidual}
                onChange={(e) => setVidaUtilResidual(e.target.value)}
                placeholder="7"
                min="0"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Propio / Arriendo / Comodato
              </label>
              <select
                className={inputClass}
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value as ModalidadAdquisicion | '')}
              >
                <option value="">— Seleccionar —</option>
                {modalidades.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

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
              {editing ? 'Guardar cambios' : 'Agregar equipo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
