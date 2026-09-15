import {
  supabase,
  type Mantenimiento,
  generarNumeroInforme,
} from '@/lib/supabase';

export interface MantenimientoExtraMeta {
  numero_informe?: string | null;
  fecha_emision_informe?: string | null;
  diagnostico_final?: string | null;
  repuestos_utilizados?: string | null;
  costo?: number | null;
  requiere_externalizacion?: boolean | null;
  tipo_externalizacion?: string | null;
  estado_solicitud_externalizacion?: 'Ninguna' | 'Pendiente_Aprobacion' | 'Aprobada' | 'Rechazada' | null;
  motivo_externalizacion?: string | null;
  externalizacion_solicitada_por?: string | null;
  externalizacion_resuelta_por?: string | null;
}

const LOCAL_STORAGE_KEY = 'cormed_mantenimientos_extra_meta';

// Helper to safely get local cache
function getLocalMetaCache(): Record<string, MantenimientoExtraMeta> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Helper to safely save local cache
export function saveLocalMeta(
  id: string,
  codigo: string | null | undefined,
  meta: MantenimientoExtraMeta
): void {
  if (typeof window === 'undefined') return;
  try {
    const cache = getLocalMetaCache();
    if (id) cache[id] = { ...cache[id], ...meta };
    if (codigo) cache[codigo] = { ...cache[codigo], ...meta };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota
  }
}

export function parseDocumentoUrlMeta(rawUrl: string | null | undefined): MantenimientoExtraMeta | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as MantenimientoExtraMeta;
      }
    } catch {
      // not JSON
    }
  }
  return null;
}

/**
 * Enriches a maintenance record by hydrating extended fields
 * from embedded metadata or local persistence cache.
 */
export function enrichMantenimiento(m: Mantenimiento): Mantenimiento {
  const localCache = getLocalMetaCache();
  const fromLocal = (m.id && localCache[m.id]) || (m.codigo && localCache[m.codigo]) || {};
  const fromDocUrl = parseDocumentoUrlMeta(m.documentos_url?.[0] ? null : (m as unknown as { documento_url?: string }).documento_url) || {};

  const mergedMeta: MantenimientoExtraMeta = {
    ...fromDocUrl,
    ...fromLocal,
  };

  const numero_informe =
    m.numero_informe ||
    mergedMeta.numero_informe ||
    (m.estado_mantenimiento === 'Completado' && m.codigo ? generarNumeroInforme(m.codigo) : null);

  const fecha_emision_informe =
    m.fecha_emision_informe ||
    mergedMeta.fecha_emision_informe ||
    (m.estado_mantenimiento === 'Completado' && m.fecha_cierre ? m.fecha_cierre : null);

  const diagnostico_final = m.diagnostico_final || mergedMeta.diagnostico_final || null;
  const repuestos_utilizados = m.repuestos_utilizados || mergedMeta.repuestos_utilizados || null;
  const costo = m.costo != null ? m.costo : (mergedMeta.costo != null ? mergedMeta.costo : null);
  const requiere_externalizacion =
    m.requiere_externalizacion !== undefined
      ? m.requiere_externalizacion
      : (mergedMeta.requiere_externalizacion ?? false);
  const tipo_externalizacion =
    m.tipo_externalizacion ||
    (mergedMeta.tipo_externalizacion as Mantenimiento['tipo_externalizacion']) ||
    null;
  const estado_solicitud_externalizacion =
    m.estado_solicitud_externalizacion ||
    mergedMeta.estado_solicitud_externalizacion ||
    null;
  const motivo_externalizacion =
    m.motivo_externalizacion || mergedMeta.motivo_externalizacion || null;
  const externalizacion_solicitada_por =
    m.externalizacion_solicitada_por || mergedMeta.externalizacion_solicitada_por || null;
  const externalizacion_resuelta_por =
    m.externalizacion_resuelta_por || mergedMeta.externalizacion_resuelta_por || null;

  return {
    ...m,
    numero_informe,
    fecha_emision_informe,
    diagnostico_final,
    repuestos_utilizados,
    costo,
    requiere_externalizacion,
    tipo_externalizacion,
    estado_solicitud_externalizacion,
    motivo_externalizacion,
    externalizacion_solicitada_por,
    externalizacion_resuelta_por,
  };
}

/**
 * Saves or updates a maintenance order in Supabase with automatic schema fallback:
 * If the remote database table lacks the new columns (numero_informe, diagnostico_final, etc.),
 * it catches PostgREST PGRST204 errors, stores the extra data in a dual persistence layer
 * (documento_url backup in DB + localStorage), and safely retries the save without throwing an error.
 */
export async function saveMantenimientoRecord(params: {
  id?: string;
  codigo?: string;
  isEdit: boolean;
  payload: Record<string, unknown>;
}): Promise<{ error: Error | null; data?: unknown; record?: Mantenimiento }> {
  const { id, codigo, isEdit, payload } = params;

  const extraMeta: MantenimientoExtraMeta = {
    numero_informe: (payload.numero_informe as string) ?? null,
    fecha_emision_informe: (payload.fecha_emision_informe as string) ?? null,
    diagnostico_final: (payload.diagnostico_final as string) ?? null,
    repuestos_utilizados: (payload.repuestos_utilizados as string) ?? null,
    costo: (payload.costo as number) ?? null,
    requiere_externalizacion: (payload.requiere_externalizacion as boolean) ?? false,
    tipo_externalizacion: (payload.tipo_externalizacion as string) ?? null,
    estado_solicitud_externalizacion: (payload.estado_solicitud_externalizacion as 'Ninguna' | 'Pendiente_Aprobacion' | 'Aprobada' | 'Rechazada') ?? null,
    motivo_externalizacion: (payload.motivo_externalizacion as string) ?? null,
    externalizacion_solicitada_por: (payload.externalizacion_solicitada_por as string) ?? null,
    externalizacion_resuelta_por: (payload.externalizacion_resuelta_por as string) ?? null,
  };

  const getRecord = (resultData: unknown): Mantenimiento | undefined => {
    if (!resultData) return undefined;
    const raw = Array.isArray(resultData) ? resultData[0] : resultData;
    if (raw && typeof raw === 'object' && 'id' in raw) {
      return enrichMantenimiento(raw as Mantenimiento);
    }
    return undefined;
  };

  // 1. First attempt: try full payload directly (works if database columns exist)
  try {
    if (isEdit && id) {
      const { data, error } = await supabase
        .from('mantenimientos')
        .update(payload)
        .eq('id', id)
        .select();

      if (!error) {
        if (id) saveLocalMeta(id, codigo, extraMeta);
        const rec = getRecord(data);
        return { error: null, data, record: rec };
      }

      // Check if the error is a missing column in Supabase schema cache
      if (error.code === 'PGRST204' || error.message?.includes('Could not find the')) {
        console.info('[Supabase Schema Compat] Column not in DB table, using dual-layer persistence:', error.message);
        return await executeSafeFallback(isEdit, id, payload, extraMeta, codigo);
      }

      return { error: new Error(error.message) };
    } else {
      const { data, error } = await supabase
        .from('mantenimientos')
        .insert(payload)
        .select();

      if (!error) {
        const rec = getRecord(data);
        const createdId = rec?.id || (data as unknown as { id?: string }[])?.[0]?.id;
        const createdCodigo = rec?.codigo || codigo;
        if (createdId) saveLocalMeta(createdId, createdCodigo, extraMeta);
        return { error: null, data, record: rec };
      }

      if (error.code === 'PGRST204' || error.message?.includes('Could not find the')) {
        console.info('[Supabase Schema Compat] Column not in DB table, using dual-layer persistence:', error.message);
        return await executeSafeFallback(isEdit, undefined, payload, extraMeta, codigo);
      }

      return { error: new Error(error.message) };
    }
  } catch (err) {
    return { error: err as Error };
  }
}

async function executeSafeFallback(
  isEdit: boolean,
  id: string | undefined,
  payload: Record<string, unknown>,
  extraMeta: MantenimientoExtraMeta,
  codigo?: string
): Promise<{ error: Error | null; data?: unknown; record?: Mantenimiento }> {
  const getRecord = (resultData: unknown): Mantenimiento | undefined => {
    if (!resultData) return undefined;
    const raw = Array.isArray(resultData) ? resultData[0] : resultData;
    if (raw && typeof raw === 'object' && 'id' in raw) {
      return enrichMantenimiento(raw as Mantenimiento);
    }
    return undefined;
  };

  // Strip extended columns that don't exist in the database table
  const safePayload: Record<string, unknown> = { ...payload };
  delete safePayload.numero_informe;
  delete safePayload.fecha_emision_informe;
  delete safePayload.diagnostico_final;
  delete safePayload.repuestos_utilizados;
  delete safePayload.costo;
  delete safePayload.requiere_externalizacion;
  delete safePayload.tipo_externalizacion;
  delete safePayload.estado_solicitud_externalizacion;
  delete safePayload.motivo_externalizacion;
  delete safePayload.externalizacion_solicitada_por;
  delete safePayload.externalizacion_resuelta_por;

  // Dual-layer persistence: Store JSON string in existing 'documento_url' field in database
  safePayload.documento_url = JSON.stringify(extraMeta);

  if (isEdit && id) {
    const { data, error } = await supabase
      .from('mantenimientos')
      .update(safePayload)
      .eq('id', id)
      .select();

    if (error) {
      return { error: new Error(error.message) };
    }

    saveLocalMeta(id, codigo, extraMeta);
    const rec = getRecord(data);
    return { error: null, data, record: rec };
  } else {
    const { data, error } = await supabase
      .from('mantenimientos')
      .insert(safePayload)
      .select();

    if (error) {
      return { error: new Error(error.message) };
    }

    const rec = getRecord(data);
    const createdId = rec?.id || (data as unknown as { id?: string }[])?.[0]?.id;
    const createdCodigo = rec?.codigo || codigo;
    if (createdId) saveLocalMeta(createdId, createdCodigo, extraMeta);
    return { error: null, data, record: rec };
  }
}
