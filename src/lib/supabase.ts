import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type EstadoEquipo = 'Operativo' | 'Mantenimiento' | 'Dado de baja';
export type ModalidadAdquisicion = 'Propio' | 'Arriendo' | 'Comodato';

export interface Equipo {
  id: string;
  codigo: string;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  serie: string;
  ubicacion: string | null;
  estado: EstadoEquipo;
  inventario: string | null;
  anio_adquisicion: number | null;
  orden_compra: string | null;
  acta_entrega: string | null;
  vida_util: number | null;
  vida_util_residual: number | null;
  modalidad_adquisicion: ModalidadAdquisicion | null;
  created_at: string;
}

export type EquipoInsert = Omit<Equipo, 'id' | 'created_at'>;

export type EstadoMantenimiento = 'Pendiente de Asignación' | 'En proceso' | 'Completado';
export type TipoMantenimiento = 'Correctivo' | 'Preventivo';

export interface Mantenimiento {
  id: string;
  codigo: string;
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
  created_at: string;
}

export interface FallaMantenimiento {
  id: string;
  mantenimiento_id: string;
  descripcion_falla: string;
  registrado_por: string;
  fecha_registro: string;
}

const INITIAL_EQUIPOS: Equipo[] = [
  {
    id: '11111111-1111-4111-8111-111111111101',
    codigo: 'EQ-001',
    nombre: 'Monitor de Signos Vitales',
    marca: 'Philips',
    modelo: 'MX450',
    serie: 'SN-PH-1001',
    ubicacion: 'UCI - Sala 3',
    estado: 'Operativo',
    inventario: 'INV-2023-001',
    anio_adquisicion: 2023,
    orden_compra: 'OC-2023-102',
    acta_entrega: 'AE-2023-015',
    vida_util: 10,
    vida_util_residual: 7,
    modalidad_adquisicion: 'Propio',
    created_at: '2026-07-27T19:00:00.000Z',
  },
  {
    id: '11111111-1111-4111-8111-111111111102',
    codigo: 'EQ-002',
    nombre: 'Respirador Mecánico',
    marca: 'Dräger',
    modelo: 'Evita V500',
    serie: 'SN-DR-2004',
    ubicacion: 'UCI - Sala 3',
    estado: 'Mantenimiento',
    inventario: 'INV-2022-045',
    anio_adquisicion: 2022,
    orden_compra: 'OC-2022-089',
    acta_entrega: 'AE-2022-040',
    vida_util: 10,
    vida_util_residual: 6,
    modalidad_adquisicion: 'Propio',
    created_at: '2026-07-27T19:05:00.000Z',
  },
  {
    id: '11111111-1111-4111-8111-111111111103',
    codigo: 'EQ-003',
    nombre: 'Bomba de Infusión',
    marca: 'B.Braun',
    modelo: 'Infusomat Space',
    serie: 'SN-BB-3055',
    ubicacion: 'Pabellón Quirúrgico',
    estado: 'Operativo',
    inventario: 'INV-2023-112',
    anio_adquisicion: 2023,
    orden_compra: 'OC-2023-210',
    acta_entrega: 'AE-2023-101',
    vida_util: 8,
    vida_util_residual: 5,
    modalidad_adquisicion: 'Propio',
    created_at: '2026-07-27T19:10:00.000Z',
  },
  {
    id: '11111111-1111-4111-8111-111111111104',
    codigo: 'EQ-004',
    nombre: 'Electrocardiógrafo',
    marca: 'GE Healthcare',
    modelo: 'MAC 5500',
    serie: 'SN-GE-4012',
    ubicacion: 'Cardiología',
    estado: 'Operativo',
    inventario: 'INV-2021-088',
    anio_adquisicion: 2021,
    orden_compra: 'OC-2021-044',
    acta_entrega: 'AE-2021-022',
    vida_util: 10,
    vida_util_residual: 5,
    modalidad_adquisicion: 'Propio',
    created_at: '2026-07-27T19:15:00.000Z',
  },
  {
    id: '11111111-1111-4111-8111-111111111105',
    codigo: 'EQ-005',
    nombre: 'Desfibrilador',
    marca: 'Zoll',
    modelo: 'R Series',
    serie: 'SN-ZO-5100',
    ubicacion: 'Emergencias',
    estado: 'Operativo',
    inventario: 'INV-2024-003',
    anio_adquisicion: 2024,
    orden_compra: 'OC-2024-012',
    acta_entrega: 'AE-2024-005',
    vida_util: 8,
    vida_util_residual: 6,
    modalidad_adquisicion: 'Propio',
    created_at: '2026-07-27T19:20:00.000Z',
  },
  {
    id: '11111111-1111-4111-8111-111111111106',
    codigo: 'EQ-006',
    nombre: 'Ecógrafo Portátil',
    marca: 'Sonosite',
    modelo: 'Edge III',
    serie: 'SN-SO-6031',
    ubicacion: 'Maternidad',
    estado: 'Mantenimiento',
    inventario: 'INV-2023-076',
    anio_adquisicion: 2023,
    orden_compra: 'OC-2023-155',
    acta_entrega: 'AE-2023-080',
    vida_util: 7,
    vida_util_residual: 4,
    modalidad_adquisicion: 'Comodato',
    created_at: '2026-07-27T19:25:00.000Z',
  },
  {
    id: '11111111-1111-4111-8111-111111111107',
    codigo: 'EQ-007',
    nombre: 'Mesa de Cirugía',
    marca: 'Maquet',
    modelo: 'Magnus 1200',
    serie: 'SN-MA-7099',
    ubicacion: 'Pabellón Quirúrgico',
    estado: 'Operativo',
    inventario: 'INV-2020-019',
    anio_adquisicion: 2020,
    orden_compra: 'OC-2020-008',
    acta_entrega: 'AE-2020-004',
    vida_util: 15,
    vida_util_residual: 9,
    modalidad_adquisicion: 'Propio',
    created_at: '2026-07-27T19:30:00.000Z',
  },
  {
    id: '11111111-1111-4111-8111-111111111108',
    codigo: 'EQ-008',
    nombre: 'Lámpara Cialítica',
    marca: 'Hillrom',
    modelo: 'TruLight',
    serie: 'SN-HR-8042',
    ubicacion: 'Pabellón Quirúrgico',
    estado: 'Operativo',
    inventario: 'INV-2021-033',
    anio_adquisicion: 2021,
    orden_compra: 'OC-2021-071',
    acta_entrega: 'AE-2021-030',
    vida_util: 12,
    vida_util_residual: 7,
    modalidad_adquisicion: 'Propio',
    created_at: '2026-07-27T19:35:00.000Z',
  },
  {
    id: '11111111-1111-4111-8111-111111111109',
    codigo: 'EQ-009',
    nombre: 'Autoclave',
    marca: 'Tuttnauer',
    modelo: '3870EA',
    serie: 'SN-TU-9011',
    ubicacion: 'Esterilización',
    estado: 'Dado de baja',
    inventario: 'INV-2015-002',
    anio_adquisicion: 2015,
    orden_compra: 'OC-2015-001',
    acta_entrega: 'AE-2015-001',
    vida_util: 10,
    vida_util_residual: 0,
    modalidad_adquisicion: 'Propio',
    created_at: '2026-07-27T19:40:00.000Z',
  },
  {
    id: '11111111-1111-4111-8111-111111111110',
    codigo: 'EQ-010',
    nombre: 'Centrífuga de Laboratorio',
    marca: 'Eppendorf',
    modelo: '5810R',
    serie: 'SN-EP-1022',
    ubicacion: 'Laboratorio',
    estado: 'Operativo',
    inventario: 'INV-2022-099',
    anio_adquisicion: 2022,
    orden_compra: 'OC-2022-140',
    acta_entrega: 'AE-2022-065',
    vida_util: 10,
    vida_util_residual: 6,
    modalidad_adquisicion: 'Arriendo',
    created_at: '2026-07-27T19:45:00.000Z',
  },
];

const INITIAL_MANTENIMIENTOS: Mantenimiento[] = [
  {
    id: '22222222-2222-4222-8222-222222222201',
    codigo: 'MANT-001',
    equipo_id: '11111111-1111-4111-8111-111111111102',
    equipo_identificacion: 'EQ-002 — Respirador Mecánico',
    problema_reportado: 'Alarma de presión baja continua en ventilación asistida durante ciclado.',
    solicitado_por: 'Dra. María González',
    asignado_a: 'Ing. Carlos Pérez',
    fecha_requerimiento: '2026-09-02',
    tipo_mantenimiento: 'Correctivo',
    estado_mantenimiento: 'En proceso',
    descripcion_trabajo_realizado: null,
    fecha_cierre: null,
    horas_hombre: null,
    fotos_url: [],
    documentos_url: [],
    accesorios_adicionales: 'Circuito de paciente y válvula espiratoria de repuesto',
    completado_por: null,
    recibido_por: null,
    created_at: '2026-09-02T10:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222202',
    codigo: 'MANT-002',
    equipo_id: '11111111-1111-4111-8111-111111111106',
    equipo_identificacion: 'EQ-006 — Ecógrafo Portátil',
    problema_reportado: 'Falla en conector de transductor lineal, artefactos en modo B y requiere calibración.',
    solicitado_por: 'Dr. Roberto Soto',
    asignado_a: null,
    fecha_requerimiento: '2026-09-05',
    tipo_mantenimiento: 'Correctivo',
    estado_mantenimiento: 'Pendiente de Asignación',
    descripcion_trabajo_realizado: null,
    fecha_cierre: null,
    horas_hombre: null,
    fotos_url: [],
    documentos_url: [],
    accesorios_adicionales: null,
    completado_por: null,
    recibido_por: null,
    created_at: '2026-09-05T14:30:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222203',
    codigo: 'MANT-003',
    equipo_id: '11111111-1111-4111-8111-111111111101',
    equipo_identificacion: 'EQ-001 — Monitor de Signos Vitales',
    problema_reportado: 'Mantenimiento preventivo periódico semestral según pauta institucional.',
    solicitado_por: 'Enf. Patricia Morales',
    asignado_a: 'Téc. Fernando Ruiz',
    fecha_requerimiento: '2026-08-20',
    tipo_mantenimiento: 'Preventivo',
    estado_mantenimiento: 'Completado',
    descripcion_trabajo_realizado: 'Limpieza de sensores, pruebas de seguridad eléctrica, calibración de PNI y test de batería OK.',
    fecha_cierre: '2026-08-21',
    horas_hombre: 3.5,
    fotos_url: [],
    documentos_url: [],
    accesorios_adicionales: 'Brazalete adulto nuevo instalado',
    completado_por: 'Téc. Fernando Ruiz',
    recibido_por: 'Enf. Patricia Morales',
    created_at: '2026-08-20T09:00:00.000Z',
  },
];

type QueryFilter = (row: Record<string, unknown>) => boolean;
type SortComparator = (a: Record<string, unknown>, b: Record<string, unknown>) => number;

// Helper to create safe in-memory/localStorage mock client
function createMockClient() {
  const getStored = <T>(key: string, defaultVal: T): T => {
    if (typeof window === 'undefined') return defaultVal;
    try {
      const val = localStorage.getItem(`app_${key}`);
      return val ? (JSON.parse(val) as T) : defaultVal;
    } catch {
      return defaultVal;
    }
  };

  const setStored = <T>(key: string, val: T) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`app_${key}`, JSON.stringify(val));
    } catch {
      // storage quota or disabled
    }
  };

  let equipos: Equipo[] = getStored<Equipo[]>('equipos', INITIAL_EQUIPOS);
  let mantenimientos: Mantenimiento[] = getStored<Mantenimiento[]>('mantenimientos', INITIAL_MANTENIMIENTOS);
  let fallas: FallaMantenimiento[] = getStored<FallaMantenimiento[]>('fallas', []);
  const storageFiles = new Map<string, string>();

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

  function getNextMantCode(): string {
    let maxNum = 0;
    for (const m of mantenimientos) {
      const match = m.codigo?.match(/(\d+)\s*$/);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    return `MANT-${String(maxNum + 1).padStart(3, '0')}`;
  }

  return {
    from(tableName: string) {
      return {
        select() {
          const filters: QueryFilter[] = [];
          let sortFn: SortComparator | null = null;

          const queryBuilder = {
            eq(column: string, value: unknown) {
              filters.push((row) => row[column] === value);
              return queryBuilder;
            },
            neq(column: string, value: unknown) {
              filters.push((row) => row[column] !== value);
              return queryBuilder;
            },
            order(column: string, options?: { ascending?: boolean }) {
              const asc = options?.ascending ?? true;
              sortFn = (a: Record<string, unknown>, b: Record<string, unknown>) => {
                const va = a[column];
                const vb = b[column];
                if (va === vb) return 0;
                if (va == null) return asc ? -1 : 1;
                if (vb == null) return asc ? 1 : -1;
                if (va < vb) return asc ? -1 : 1;
                return asc ? 1 : -1;
              };
              return queryBuilder;
            },
            async then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
              onfulfilled?: ((res: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
              onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
            ) {
              try {
                let dataset: Record<string, unknown>[] = [];
                if (tableName === 'equipos') dataset = [...(equipos as unknown as Record<string, unknown>[])];
                else if (tableName === 'mantenimientos') dataset = [...(mantenimientos as unknown as Record<string, unknown>[])];
                else if (tableName === 'fallas_mantenimiento') dataset = [...(fallas as unknown as Record<string, unknown>[])];

                for (const filter of filters) {
                  dataset = dataset.filter(filter);
                }
                if (sortFn) {
                  dataset.sort(sortFn);
                }

                const result = { data: dataset, error: null };
                return onfulfilled ? onfulfilled(result) : result;
              } catch (err) {
                if (onrejected) return onrejected(err);
                throw err;
              }
            },
          };

          return queryBuilder;
        },

        async insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
          const items = Array.isArray(payload) ? payload : [payload];
          const created: Record<string, unknown>[] = [];

          for (const item of items) {
            const newItem: Record<string, unknown> = {
              ...item,
              id: (item.id as string) || generateUuid(),
              created_at: (item.created_at as string) || new Date().toISOString(),
            };

            if (tableName === 'mantenimientos' && !newItem.codigo) {
              newItem.codigo = getNextMantCode();
            }

            if (tableName === 'equipos') {
              equipos = [newItem as unknown as Equipo, ...equipos];
              setStored('equipos', equipos);
            } else if (tableName === 'mantenimientos') {
              mantenimientos = [newItem as unknown as Mantenimiento, ...mantenimientos];
              setStored('mantenimientos', mantenimientos);
            } else if (tableName === 'fallas_mantenimiento') {
              fallas = [newItem as unknown as FallaMantenimiento, ...fallas];
              setStored('fallas', fallas);
            }
            created.push(newItem);
          }

          return { data: Array.isArray(payload) ? created : created[0], error: null };
        },

        update(updates: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              return (async () => {
                if (tableName === 'equipos') {
                  equipos = equipos.map((eq) =>
                    (eq as unknown as Record<string, unknown>)[column] === value
                      ? ({ ...eq, ...updates } as unknown as Equipo)
                      : eq
                  );
                  setStored('equipos', equipos);
                } else if (tableName === 'mantenimientos') {
                  mantenimientos = mantenimientos.map((m) =>
                    (m as unknown as Record<string, unknown>)[column] === value
                      ? ({ ...m, ...updates } as unknown as Mantenimiento)
                      : m
                  );
                  setStored('mantenimientos', mantenimientos);
                }
                return { data: null, error: null };
              })();
            },
          };
        },

        delete() {
          return {
            eq(column: string, value: unknown) {
              return (async () => {
                if (tableName === 'equipos') {
                  equipos = equipos.filter(
                    (eq) => (eq as unknown as Record<string, unknown>)[column] !== value
                  );
                  setStored('equipos', equipos);
                } else if (tableName === 'mantenimientos') {
                  mantenimientos = mantenimientos.filter(
                    (m) => (m as unknown as Record<string, unknown>)[column] !== value
                  );
                  setStored('mantenimientos', mantenimientos);
                } else if (tableName === 'fallas_mantenimiento') {
                  fallas = fallas.filter(
                    (f) => (f as unknown as Record<string, unknown>)[column] !== value
                  );
                  setStored('fallas', fallas);
                }
                return { data: null, error: null };
              })();
            },
          };
        },
      };
    },

    storage: {
      from() {
        return {
          async upload(filePath: string, file: File) {
            try {
              const fileUrl = URL.createObjectURL(file);
              storageFiles.set(filePath, fileUrl);
              return { data: { path: filePath }, error: null };
            } catch {
              return { data: { path: filePath }, error: null };
            }
          },
          getPublicUrl(filePath: string) {
            const existing = storageFiles.get(filePath);
            return {
              data: {
                publicUrl:
                  existing ||
                  `https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80#${encodeURIComponent(filePath)}`,
              },
            };
          },
          async remove(paths: string[]) {
            for (const p of paths) {
              storageFiles.delete(p);
            }
            return { data: {}, error: null };
          },
        };
      },
    },
  };
}

const hasValidSupabaseEnv =
  Boolean(supabaseUrl) &&
  typeof supabaseUrl === 'string' &&
  supabaseUrl.startsWith('http') &&
  Boolean(supabaseAnonKey) &&
  supabaseAnonKey !== 'undefined';

let clientInstance: unknown;

if (hasValidSupabaseEnv) {
  try {
    clientInstance = createClient(supabaseUrl!, supabaseAnonKey!);
  } catch (e) {
    console.warn('[AI Studio] Could not initialize live Supabase client, activating mock fallback:', e);
    clientInstance = createMockClient();
  }
} else {
  clientInstance = createMockClient();
}

export const supabase = clientInstance as unknown as SupabaseClient;
