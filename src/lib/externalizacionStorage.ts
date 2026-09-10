import {
  supabase,
  type Externalizacion,
  type TipoExternalizacion,
  type EtapaExternalizacion,
  INITIAL_EXTERNALIZACIONES,
} from '@/lib/supabase';

export const ETAPAS_ORDEN: EtapaExternalizacion[] = [
  'Cotización / Evaluación Técnica',
  'Informe de Requerimiento Creado',
  'Solicitud de Compra Asignada',
  'En Espera de Orden de Compra',
  'Finalizada / Recibida',
];

export const TIPOS_EXTERNALIZACION: TipoExternalizacion[] = [
  'Compra de repuesto por fondo fijo',
  'Compra de repuesto por Informe de requerimiento',
  'Compra de servicio de mantenimiento o reparación externa',
];

const STORAGE_KEY = 'app_externalizaciones';

function getStoredExternalizaciones(): Externalizacion[] {
  if (typeof window === 'undefined') return [...INITIAL_EXTERNALIZACIONES];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_EXTERNALIZACIONES));
      return [...INITIAL_EXTERNALIZACIONES];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...INITIAL_EXTERNALIZACIONES];
  } catch {
    return [...INITIAL_EXTERNALIZACIONES];
  }
}

function setStoredExternalizaciones(items: Externalizacion[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Error guardando externalizaciones en localStorage:', err);
  }
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getNextExtCode(list: Externalizacion[]): string {
  let maxNum = 0;
  for (const ext of list) {
    const match = ext.codigo?.match(/(\d+)\s*$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }
  return `EXT-${String(maxNum + 1).padStart(3, '0')}`;
}

export function isTableMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string; status?: number };
  if (err.code === 'PGRST205' || err.code === '42P01' || err.status === 404) return true;
  if (
    typeof err.message === 'string' &&
    (err.message.includes('externalizaciones') ||
      err.message.includes('schema cache') ||
      err.message.includes('does not exist'))
  ) {
    return true;
  }
  return false;
}

export const SQL_MIGRATION_EXTERNALIZACIONES = `-- Script SQL para habilitar la tabla 'externalizaciones' en tu proyecto Supabase:
-- (Copia y ejecuta esto en Supabase Dashboard > SQL Editor > New query > Run)

CREATE TABLE IF NOT EXISTS public.externalizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  origen TEXT NOT NULL DEFAULT 'directa',
  codigo_mantenimiento TEXT,
  mantenimiento_id UUID,
  tipo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  equipo_identificacion TEXT,
  equipo_id UUID,
  solicitante TEXT NOT NULL,
  etapa_actual TEXT NOT NULL DEFAULT 'Cotización / Evaluación Técnica',
  cotizacion_url TEXT,
  cotizacion_nombre TEXT,
  monto_estimado NUMERIC,
  fecha_cotizacion DATE,
  informe_req_url TEXT,
  informe_req_nombre TEXT,
  informe_req_folio TEXT,
  fecha_informe_req DATE,
  solicitud_compra_folio TEXT,
  solicitud_compra_url TEXT,
  fecha_solicitud_compra DATE,
  numero_oc TEXT,
  oc_url TEXT,
  oc_nombre TEXT,
  fecha_oc DATE,
  fecha_recepcion DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Row Level Security (RLS) con políticas de acceso
ALTER TABLE public.externalizaciones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'externalizaciones' AND policyname = 'Permitir lectura publica') THEN
    CREATE POLICY "Permitir lectura publica" ON public.externalizaciones FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'externalizaciones' AND policyname = 'Permitir insercion publica') THEN
    CREATE POLICY "Permitir insercion publica" ON public.externalizaciones FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'externalizaciones' AND policyname = 'Permitir actualizacion publica') THEN
    CREATE POLICY "Permitir actualizacion publica" ON public.externalizaciones FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'externalizaciones' AND policyname = 'Permitir eliminacion publica') THEN
    CREATE POLICY "Permitir eliminacion publica" ON public.externalizaciones FOR DELETE USING (true);
  END IF;
END $$;
`;

export async function checkSupabaseExternalizacionesStatus(): Promise<{ exists: boolean; message?: string }> {
  try {
    const { error } = await supabase.from('externalizaciones').select('id').limit(1);
    if (error) {
      if (isTableMissingError(error)) {
        return { exists: false, message: 'Tabla no encontrada en Supabase (modo local activo).' };
      }
      return { exists: false, message: error.message };
    }
    return { exists: true };
  } catch (err) {
    return { exists: false, message: (err as Error).message };
  }
}

export function getEtapaIndex(etapa: EtapaExternalizacion): number {
  const idx = ETAPAS_ORDEN.indexOf(etapa);
  return idx >= 0 ? idx : 0;
}

export function getProgresoPorcentaje(etapa: EtapaExternalizacion): number {
  switch (etapa) {
    case 'Cotización / Evaluación Técnica':
      return 25;
    case 'Informe de Requerimiento Creado':
      return 50;
    case 'Solicitud de Compra Asignada':
      return 75;
    case 'En Espera de Orden de Compra':
      return 90;
    case 'Finalizada / Recibida':
      return 100;
    default:
      return 0;
  }
}

export async function fetchExternalizaciones(): Promise<Externalizacion[]> {
  try {
    const { data, error } = await supabase
      .from('externalizaciones')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableMissingError(error)) {
        return getStoredExternalizaciones();
      }
      throw error;
    }
    const list = (data as Externalizacion[]) || [];
    // Synchronize local storage as cache
    if (list.length > 0) {
      setStoredExternalizaciones(list);
    }
    return list;
  } catch (err) {
    console.warn('Aviso: usando almacenamiento local para externalizaciones:', err);
    return getStoredExternalizaciones();
  }
}

export async function findExternalizacionByMantenimiento(
  mantId?: string | null,
  mantCodigo?: string | null
): Promise<Externalizacion | null> {
  if (!mantId && !mantCodigo) return null;
  const list = await fetchExternalizaciones();
  return (
    list.find(
      (e) =>
        (mantId && e.mantenimiento_id === mantId) ||
        (mantCodigo && e.codigo_mantenimiento === mantCodigo)
    ) || null
  );
}

/**
 * Valida si los datos de la Solicitud de Compra (Etapa 3) son válidos:
 * Requiere un N° de Folio no vacío, de longitud mínima y que no sea un placeholder genérico.
 */
export function isValidSolicitudCompraFolio(folio: string | null | undefined): boolean {
  if (!folio) return false;
  const clean = folio.trim();
  if (clean.length < 3) return false;
  if (/^[-._/0\s]+$/.test(clean)) return false;
  const upper = clean.toUpperCase();
  if (upper === 'N/A' || upper === 'NONE' || upper === 'PENDIENTE' || upper === 'SIN FOLIO' || upper === 'S/N') {
    return false;
  }
  return true;
}

/**
 * Valida si el número de Orden de Compra de Mercado Público (Etapa 4) es válido:
 * Requiere un código con longitud mínima y que no sea un placeholder genérico.
 */
export function isValidNumeroOC(oc: string | null | undefined): boolean {
  if (!oc) return false;
  const clean = oc.trim().toUpperCase();
  if (clean.length < 5) return false;
  if (/^[-._/0\s]+$/.test(clean)) return false;
  if (clean === 'N/A' || clean === 'NONE' || clean === 'PENDIENTE' || clean === 'SIN OC' || clean === 'S/N') {
    return false;
  }
  return true;
}

/**
 * Regla de Integridad de Cierre:
 * Un mantenimiento no puede marcarse como 'Completado' si tiene externalización
 * activa en etapas 1 a 4 (debe estar en 'Finalizada / Recibida' con OC válida).
 */
export async function puedeCompletarMantenimiento(
  mantId?: string | null,
  mantCodigo?: string | null
): Promise<{ puede: boolean; motivo?: string; externalizacion?: Externalizacion }> {
  const ext = await findExternalizacionByMantenimiento(mantId, mantCodigo);
  if (!ext) {
    return { puede: true };
  }

  if (ext.etapa_actual !== 'Finalizada / Recibida') {
    return {
      puede: false,
      motivo: `Bloqueo de Integridad: Esta orden tiene una gestión de adquisición externa en curso (${ext.codigo}) en etapa "${ext.etapa_actual}". Debe completarse la Etapa 4 con el N° de Orden de Compra (OC) de Mercado Público en el módulo de Externalización antes de emitir el Informe Técnico y cerrar la orden.`,
      externalizacion: ext,
    };
  }

  if (!isValidNumeroOC(ext.numero_oc)) {
    return {
      puede: false,
      motivo: `Bloqueo de Integridad: La adquisición externa (${ext.codigo}) no cuenta con un N° de Orden de Compra (OC) válido de Mercado Público. Debe completarse la Etapa 4 antes de emitir el Informe Técnico y cerrar la orden.`,
      externalizacion: ext,
    };
  }

  return { puede: true, externalizacion: ext };
}

export async function guardarExternalizacionParaMantenimiento(params: {
  mantId?: string | null;
  mantCodigo?: string | null;
  tipo: TipoExternalizacion;
  descripcion: string;
  equipoIdentificacion?: string | null;
  equipoId?: string | null;
  solicitante: string;
}): Promise<Externalizacion | null> {
  const list = await fetchExternalizaciones();
  const existente = list.find(
    (e) =>
      (params.mantId && e.mantenimiento_id === params.mantId) ||
      (params.mantCodigo && e.codigo_mantenimiento === params.mantCodigo)
  );

  const now = new Date().toISOString();

  if (existente) {
    const updates: Partial<Externalizacion> = {
      tipo: params.tipo,
      descripcion: params.descripcion || existente.descripcion,
      equipo_identificacion: params.equipoIdentificacion || existente.equipo_identificacion,
      equipo_id: params.equipoId || existente.equipo_id,
      solicitante: params.solicitante || existente.solicitante,
      codigo_mantenimiento: params.mantCodigo || existente.codigo_mantenimiento,
      mantenimiento_id: params.mantId || existente.mantenimiento_id,
      updated_at: now,
    };

    const updatedObj: Externalizacion = { ...existente, ...updates };

    try {
      const { error } = await supabase.from('externalizaciones').update(updates).eq('id', existente.id);
      if (error && isTableMissingError(error)) {
        const localList = getStoredExternalizaciones();
        setStoredExternalizaciones(localList.map((e) => (e.id === existente.id ? updatedObj : e)));
        return updatedObj;
      }
    } catch {
      const localList = getStoredExternalizaciones();
      setStoredExternalizaciones(localList.map((e) => (e.id === existente.id ? updatedObj : e)));
      return updatedObj;
    }

    const localList = getStoredExternalizaciones();
    setStoredExternalizaciones(localList.map((e) => (e.id === existente.id ? updatedObj : e)));
    return updatedObj;
  }

  // Create new
  const codigo = getNextExtCode(list);
  const nuevo: Externalizacion = {
    id: generateUuid(),
    codigo,
    origen: 'mantenimiento',
    codigo_mantenimiento: params.mantCodigo || null,
    mantenimiento_id: params.mantId || null,
    tipo: params.tipo,
    descripcion:
      params.descripcion ||
      `Requerimiento de compra externa derivado de OT ${params.mantCodigo || 'Mantenimiento'}.`,
    equipo_identificacion: params.equipoIdentificacion || null,
    equipo_id: params.equipoId || null,
    solicitante: params.solicitante,
    etapa_actual: 'Cotización / Evaluación Técnica',
    created_at: now,
    updated_at: now,
  };

  try {
    const { data, error } = await supabase.from('externalizaciones').insert(nuevo);
    if (error && isTableMissingError(error)) {
      const localList = getStoredExternalizaciones();
      setStoredExternalizaciones([nuevo, ...localList]);
      return nuevo;
    }
    if (error) {
      console.warn('Error en supabase insert, usando respaldo local:', error);
      const localList = getStoredExternalizaciones();
      setStoredExternalizaciones([nuevo, ...localList]);
      return nuevo;
    }
    return (Array.isArray(data) ? data[0] : (data as Externalizacion)) || nuevo;
  } catch {
    const localList = getStoredExternalizaciones();
    setStoredExternalizaciones([nuevo, ...localList]);
    return nuevo;
  }
}

export async function crearExternalizacionDirecta(params: {
  tipo: TipoExternalizacion;
  descripcion: string;
  equipoIdentificacion?: string | null;
  equipoId?: string | null;
  solicitante: string;
  montoEstimado?: number | null;
  notas?: string | null;
}): Promise<Externalizacion | null> {
  const list = await fetchExternalizaciones();
  const codigo = getNextExtCode(list);
  const now = new Date().toISOString();

  const nuevo: Externalizacion = {
    id: generateUuid(),
    codigo,
    origen: 'directa',
    codigo_mantenimiento: null,
    mantenimiento_id: null,
    tipo: params.tipo,
    descripcion: params.descripcion,
    equipo_identificacion: params.equipoIdentificacion || null,
    equipo_id: params.equipoId || null,
    solicitante: params.solicitante,
    monto_estimado: params.montoEstimado || null,
    notas: params.notas || null,
    etapa_actual: 'Cotización / Evaluación Técnica',
    created_at: now,
    updated_at: now,
  };

  try {
    const { data, error } = await supabase.from('externalizaciones').insert(nuevo);
    if (error && isTableMissingError(error)) {
      const localList = getStoredExternalizaciones();
      setStoredExternalizaciones([nuevo, ...localList]);
      return nuevo;
    }
    if (error) {
      console.warn('Error insertando en Supabase, guardando localmente:', error);
      const localList = getStoredExternalizaciones();
      setStoredExternalizaciones([nuevo, ...localList]);
      return nuevo;
    }
    return (Array.isArray(data) ? data[0] : (data as Externalizacion)) || nuevo;
  } catch {
    const localList = getStoredExternalizaciones();
    setStoredExternalizaciones([nuevo, ...localList]);
    return nuevo;
  }
}

export async function actualizarEtapaExternalizacion(
  id: string,
  data: Partial<Externalizacion>,
  avanzarEtapa: boolean = false
): Promise<{ success: boolean; error?: string; externalizacion?: Externalizacion }> {
  try {
    const list = await fetchExternalizaciones();
    const actual = list.find((e) => e.id === id);
    if (!actual) return { success: false, error: 'Registro no encontrado' };

    let nuevaEtapa = data.etapa_actual || actual.etapa_actual;

    const solFolio = data.solicitud_compra_folio !== undefined ? data.solicitud_compra_folio : actual.solicitud_compra_folio;
    const oc = data.numero_oc !== undefined ? data.numero_oc : actual.numero_oc;

    const hasValidSolCompra = isValidSolicitudCompraFolio(solFolio);
    const hasValidOC = isValidNumeroOC(oc);

    if (avanzarEtapa) {
      if (nuevaEtapa === 'Cotización / Evaluación Técnica') {
        nuevaEtapa = 'Informe de Requerimiento Creado';
      } else if (nuevaEtapa === 'Informe de Requerimiento Creado') {
        nuevaEtapa = 'Solicitud de Compra Asignada';
      } else if (nuevaEtapa === 'Solicitud de Compra Asignada') {
        if (!hasValidSolCompra) {
          return {
            success: false,
            error: 'Para completar la Etapa 3 y avanzar en el ciclo, debes ingresar un N° de Folio válido para la Solicitud de Compra Tramitada (mínimo 3 caracteres no vacíos).',
          };
        }
        nuevaEtapa = 'En Espera de Orden de Compra';
      } else if (nuevaEtapa === 'En Espera de Orden de Compra') {
        if (!hasValidOC) {
          return {
            success: false,
            error: 'Para completar la Etapa 4 y finalizar la adquisición, debes ingresar un N° de Orden de Compra (OC) válido de Mercado Público.',
          };
        }
        nuevaEtapa = 'Finalizada / Recibida';
      } else if (nuevaEtapa === 'Finalizada / Recibida') {
        if (!hasValidOC) {
          return {
            success: false,
            error: 'Para mantener la adquisición como Finalizada / Recibida, se requiere el N° de Orden de Compra de Mercado Público.',
          };
        }
      } else {
        const idx = ETAPAS_ORDEN.indexOf(nuevaEtapa);
        if (idx >= 0 && idx < ETAPAS_ORDEN.length - 1) {
          nuevaEtapa = ETAPAS_ORDEN[idx + 1];
        }
      }
    } else if (data.etapa_actual && data.etapa_actual !== actual.etapa_actual) {
      // Cambio manual de etapa: validaciones de prerrequisito
      if (
        (data.etapa_actual === 'En Espera de Orden de Compra' || data.etapa_actual === 'Finalizada / Recibida') &&
        !hasValidSolCompra
      ) {
        return {
          success: false,
          error: 'No se puede situar la adquisición en esta etapa: La Etapa 3 debe completarse con un N° de Folio válido de Solicitud de Compra.',
        };
      }

      if (data.etapa_actual === 'Finalizada / Recibida' && !hasValidOC) {
        return {
          success: false,
          error: 'No se puede situar en "Finalizada / Recibida": La Etapa 4 requiere registrar el N° de Orden de Compra de Mercado Público.',
        };
      }
    }

    // Validación de integridad del ciclo: Etapa 4 requiere OC para pasar o mantenerse en Finalizada / Recibida
    if (nuevaEtapa === 'Finalizada / Recibida' && !hasValidOC) {
      return {
        success: false,
        error: 'Para completar la Etapa 4 y marcar como Finalizada / Recibida, debes ingresar el N° de Orden de Compra de Mercado Público.',
      };
    }

    if (nuevaEtapa === 'Finalizada / Recibida' && !data.fecha_recepcion && !actual.fecha_recepcion) {
      data.fecha_recepcion = new Date().toISOString().slice(0, 10);
    }

    const updates: Partial<Externalizacion> = {
      ...data,
      etapa_actual: nuevaEtapa,
      updated_at: new Date().toISOString(),
    };

    const updatedObj: Externalizacion = { ...actual, ...updates };

    try {
      const { error } = await supabase.from('externalizaciones').update(updates).eq('id', id);
      if (error && isTableMissingError(error)) {
        const localList = getStoredExternalizaciones();
        setStoredExternalizaciones(localList.map((e) => (e.id === id ? updatedObj : e)));
        return { success: true, externalizacion: updatedObj };
      }
      if (error) {
        console.warn('Error en supabase update, actualizando local:', error);
        const localList = getStoredExternalizaciones();
        setStoredExternalizaciones(localList.map((e) => (e.id === id ? updatedObj : e)));
        return { success: true, externalizacion: updatedObj };
      }
    } catch {
      const localList = getStoredExternalizaciones();
      setStoredExternalizaciones(localList.map((e) => (e.id === id ? updatedObj : e)));
      return { success: true, externalizacion: updatedObj };
    }

    const localList = getStoredExternalizaciones();
    setStoredExternalizaciones(localList.map((e) => (e.id === id ? updatedObj : e)));

    return {
      success: true,
      externalizacion: updatedObj,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteExternalizacion(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('externalizaciones').delete().eq('id', id);
    const localList = getStoredExternalizaciones();
    setStoredExternalizaciones(localList.filter((e) => e.id !== id));
    if (error && isTableMissingError(error)) {
      return true;
    }
    return !error;
  } catch {
    const localList = getStoredExternalizaciones();
    setStoredExternalizaciones(localList.filter((e) => e.id !== id));
    return true;
  }
}
