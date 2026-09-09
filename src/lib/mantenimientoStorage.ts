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

  return {
    ...m,
    numero_informe,
    fecha_emision_informe,
    diagnostico_final,
    repuestos_utilizados,
    costo,
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
}): Promise<{ error: Error | null; data?: unknown }> {
  const { id, codigo, isEdit, payload } = params;

  const extraMeta: MantenimientoExtraMeta = {
    numero_informe: (payload.numero_informe as string) ?? null,
    fecha_emision_informe: (payload.fecha_emision_informe as string) ?? null,
    diagnostico_final: (payload.diagnostico_final as string) ?? null,
    repuestos_utilizados: (payload.repuestos_utilizados as string) ?? null,
    costo: (payload.costo as number) ?? null,
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
        return { error: null, data };
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
        const createdId = (data as unknown as { id?: string }[])?.[0]?.id;
        if (createdId) saveLocalMeta(createdId, codigo, extraMeta);
        return { error: null, data };
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
): Promise<{ error: Error | null; data?: unknown }> {
  // Strip extended columns that don't exist in the database table
  const safePayload: Record<string, unknown> = { ...payload };
  delete safePayload.numero_informe;
  delete safePayload.fecha_emision_informe;
  delete safePayload.diagnostico_final;
  delete safePayload.repuestos_utilizados;
  delete safePayload.costo;

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
    return { error: null, data };
  } else {
    const { data, error } = await supabase
      .from('mantenimientos')
      .insert(safePayload)
      .select();

    if (error) {
      return { error: new Error(error.message) };
    }

    const createdId = (data as unknown as { id?: string }[])?.[0]?.id;
    if (createdId) saveLocalMeta(createdId, codigo, extraMeta);
    return { error: null, data };
  }
}
