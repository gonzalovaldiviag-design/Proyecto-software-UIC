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
  numero_informe?: string | null;
  fecha_emision_informe?: string | null;
  diagnostico_final?: string | null;
  repuestos_utilizados?: string | null;
  costo?: number | null;
  created_at: string;
}

export function generarNumeroInforme(codigoMantenimiento: string): string {
  const match = codigoMantenimiento.match(/(\d+)\s*$/);
  if (match) {
    const num = parseInt(match[1], 10);
    return `INF-MNT-${String(num).padStart(5, '0')}`;
  }
  return `INF-MNT-${Date.now().toString().slice(-5)}`;
}

export interface FallaMantenimiento {
  id: string;
  mantenimiento_id: string;
  descripcion_falla: string;
  registrado_por: string;
  fecha_registro: string;
}

export type TipoExternalizacion =
  | 'Compra de repuesto por fondo fijo'
  | 'Compra de repuesto por Informe de requerimiento'
  | 'Compra de servicio de mantenimiento o reparación externa';

export type EtapaExternalizacion =
  | 'Cotización / Evaluación Técnica'
  | 'Informe de Requerimiento Creado'
  | 'Solicitud de Compra Asignada'
  | 'En Espera de Orden de Compra'
  | 'Finalizada / Recibida';

export interface Externalizacion {
  id: string;
  codigo: string;
  origen: 'mantenimiento' | 'directa';
  codigo_mantenimiento?: string | null;
  mantenimiento_id?: string | null;
  tipo: TipoExternalizacion;
  descripcion: string;
  equipo_identificacion?: string | null;
  equipo_id?: string | null;
  solicitante: string;
  etapa_actual: EtapaExternalizacion;

  // Etapa 1: Cotización / Evaluación Técnica
  cotizacion_url?: string | null;
  cotizacion_nombre?: string | null;
  monto_estimado?: number | null;
  fecha_cotizacion?: string | null;

  // Etapa 2: Informe de Requerimiento Creado
  informe_req_url?: string | null;
  informe_req_nombre?: string | null;
  informe_req_folio?: string | null;
  fecha_informe_req?: string | null;

  // Etapa 3: Solicitud de Compra Asignada
  solicitud_compra_folio?: string | null;
  solicitud_compra_url?: string | null;
  fecha_solicitud_compra?: string | null;

  // Etapa 4: En Espera de Orden de Compra
  numero_oc?: string | null;
  oc_url?: string | null;
  oc_nombre?: string | null;
  fecha_oc?: string | null;
  fecha_recepcion?: string | null;

  // Observaciones
  notas?: string | null;
  created_at: string;
  updated_at: string;
}

export type RolUsuario =
  | 'Administrador (Jefe de Unidad)'
  | 'Ingeniero Supervisor'
  | 'Ingeniero de Servicio / Técnico'
  | 'Clínico / Solicitante'
  | 'Auditor / Directivo';

export interface PermisosUsuario {
  // Catastro de Equipos
  ver_equipos: boolean;
  crear_equipos: boolean;
  editar_equipos: boolean;
  eliminar_baja_equipos: boolean;
  exportar_equipos: boolean;

  // Mantenimiento y OTs
  ver_mantenimientos: boolean;
  crear_solicitud_ot: boolean;
  asignar_tecnico_ot: boolean;
  cerrar_emitir_informe_ot: boolean;
  reabrir_anular_ot: boolean;
  eliminar_ot: boolean;
  exportar_mantenimientos: boolean;

  // Compras y Externalización
  ver_externalizacion: boolean;
  gestionar_etapas_compras: boolean;
  crear_solicitud_compra: boolean;
  exportar_compras: boolean;

  // Administración y Usuarios
  gestionar_usuarios: boolean;
}

export interface PerfilUsuario {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  cargo: string;
  servicio_clinico_asignado?: string | null;
  password?: string;
  permisos: PermisosUsuario;
  activo: boolean;
  avatar_url?: string | null;
  created_at: string;
}

export const PERMISOS_DEFAULT_POR_ROL: Record<RolUsuario, PermisosUsuario> = {
  'Administrador (Jefe de Unidad)': {
    ver_equipos: true,
    crear_equipos: true,
    editar_equipos: true,
    eliminar_baja_equipos: true,
    exportar_equipos: true,
    ver_mantenimientos: true,
    crear_solicitud_ot: true,
    asignar_tecnico_ot: true,
    cerrar_emitir_informe_ot: true,
    reabrir_anular_ot: true,
    eliminar_ot: true,
    exportar_mantenimientos: true,
    ver_externalizacion: true,
    gestionar_etapas_compras: true,
    crear_solicitud_compra: true,
    exportar_compras: true,
    gestionar_usuarios: true,
  },
  'Ingeniero Supervisor': {
    ver_equipos: true,
    crear_equipos: true,
    editar_equipos: true,
    eliminar_baja_equipos: false,
    exportar_equipos: true,
    ver_mantenimientos: true,
    crear_solicitud_ot: true,
    asignar_tecnico_ot: true,
    cerrar_emitir_informe_ot: true,
    reabrir_anular_ot: false,
    eliminar_ot: false,
    exportar_mantenimientos: true,
    ver_externalizacion: true,
    gestionar_etapas_compras: true,
    crear_solicitud_compra: true,
    exportar_compras: true,
    gestionar_usuarios: false,
  },
  'Ingeniero de Servicio / Técnico': {
    ver_equipos: true,
    crear_equipos: false,
    editar_equipos: false,
    eliminar_baja_equipos: false,
    exportar_equipos: true,
    ver_mantenimientos: true,
    crear_solicitud_ot: false,
    asignar_tecnico_ot: false,
    cerrar_emitir_informe_ot: true,
    reabrir_anular_ot: false,
    eliminar_ot: false,
    exportar_mantenimientos: true,
    ver_externalizacion: true,
    gestionar_etapas_compras: false,
    crear_solicitud_compra: false,
    exportar_compras: true,
    gestionar_usuarios: false,
  },
  'Clínico / Solicitante': {
    ver_equipos: true,
    crear_equipos: false,
    editar_equipos: false,
    eliminar_baja_equipos: false,
    exportar_equipos: true,
    ver_mantenimientos: true,
    crear_solicitud_ot: true,
    asignar_tecnico_ot: false,
    cerrar_emitir_informe_ot: false,
    reabrir_anular_ot: false,
    eliminar_ot: false,
    exportar_mantenimientos: true,
    ver_externalizacion: false,
    gestionar_etapas_compras: false,
    crear_solicitud_compra: false,
    exportar_compras: false,
    gestionar_usuarios: false,
  },
  'Auditor / Directivo': {
    ver_equipos: true,
    crear_equipos: false,
    editar_equipos: false,
    eliminar_baja_equipos: false,
    exportar_equipos: true,
    ver_mantenimientos: true,
    crear_solicitud_ot: false,
    asignar_tecnico_ot: false,
    cerrar_emitir_informe_ot: false,
    reabrir_anular_ot: false,
    eliminar_ot: false,
    exportar_mantenimientos: true,
    ver_externalizacion: true,
    gestionar_etapas_compras: false,
    crear_solicitud_compra: false,
    exportar_compras: true,
    gestionar_usuarios: false,
  },
};

export const INITIAL_PERFILES: PerfilUsuario[] = [
  {
    id: 'user-001-admin',
    nombre: 'Ing. Carlos Mendoza',
    email: 'cmendoza@hospital.cl',
    rol: 'Administrador (Jefe de Unidad)',
    cargo: 'Jefe Unidad de Equipos Médicos',
    servicio_clinico_asignado: null,
    password: 'admin*uem2026',
    permisos: { ...PERMISOS_DEFAULT_POR_ROL['Administrador (Jefe de Unidad)'] },
    activo: true,
    avatar_url: null,
    created_at: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 'user-002-supervisor',
    nombre: 'Ing. Pamela Soto',
    email: 'psoto@hospital.cl',
    rol: 'Ingeniero Supervisor',
    cargo: 'Supervisora de Operaciones Clínicas',
    servicio_clinico_asignado: null,
    password: 'super*uem2026',
    permisos: { ...PERMISOS_DEFAULT_POR_ROL['Ingeniero Supervisor'] },
    activo: true,
    avatar_url: null,
    created_at: '2026-01-15T09:00:00.000Z',
  },
  {
    id: 'user-003-tecnico',
    nombre: 'Téc. Fernando Ruiz',
    email: 'fruiz@hospital.cl',
    rol: 'Ingeniero de Servicio / Técnico',
    cargo: 'Técnico Especialista en Mantenimiento Biomédico',
    servicio_clinico_asignado: null,
    password: 'tec*uem2026',
    permisos: { ...PERMISOS_DEFAULT_POR_ROL['Ingeniero de Servicio / Técnico'] },
    activo: true,
    avatar_url: null,
    created_at: '2026-02-01T10:00:00.000Z',
  },
  {
    id: 'user-004-clinico',
    nombre: 'Enf. Marcela Fuentes',
    email: 'mfuentes@hospital.cl',
    rol: 'Clínico / Solicitante',
    cargo: 'Enfermera Coordinadora de UCI',
    servicio_clinico_asignado: 'UCI - Sala 3',
    password: 'clinico*uem2026',
    permisos: { ...PERMISOS_DEFAULT_POR_ROL['Clínico / Solicitante'] },
    activo: true,
    avatar_url: null,
    created_at: '2026-02-10T11:00:00.000Z',
  },
  {
    id: 'user-005-auditor',
    nombre: 'Dra. Andrea Morales',
    email: 'amorales@hospital.cl',
    rol: 'Auditor / Directivo',
    cargo: 'Directora de Calidad Asistencial y Auditoría',
    servicio_clinico_asignado: null,
    password: 'auditor*uem2026',
    permisos: { ...PERMISOS_DEFAULT_POR_ROL['Auditor / Directivo'] },
    activo: true,
    avatar_url: null,
    created_at: '2026-02-15T12:00:00.000Z',
  },
];

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
    numero_informe: 'INF-MNT-00003',
    fecha_emision_informe: '2026-08-21T17:00:00.000Z',
    diagnostico_final: 'Equipo en óptimas condiciones de operatividad. Pruebas de seguridad eléctrica según norma IEC 62353 aprobadas.',
    repuestos_utilizados: 'Brazalete adulto NIBP nuevo (Ref: M1574A)',
    costo: 85000,
    created_at: '2026-08-20T09:00:00.000Z',
  },
];

export const INITIAL_EXTERNALIZACIONES: Externalizacion[] = [
  {
    id: '33333333-3333-4333-8333-333333333301',
    codigo: 'EXT-001',
    origen: 'mantenimiento',
    codigo_mantenimiento: 'MANT-001',
    mantenimiento_id: '22222222-2222-4222-8222-222222222201',
    tipo: 'Compra de repuesto por Informe de requerimiento',
    descripcion: 'Adquisición de kit de calibración de flujo y módulo sensor de presión espiratoria para ventilador mecánico Dräger Evita V500.',
    equipo_identificacion: 'EQ-002 — Respirador Mecánico',
    equipo_id: '11111111-1111-4111-8111-111111111102',
    solicitante: 'Dra. María González',
    etapa_actual: 'Cotización / Evaluación Técnica',
    cotizacion_url: 'https://example.com/docs/cotizacion_drager_9921.pdf',
    cotizacion_nombre: 'Cotizacion_Drager_V500_Repuestos.pdf',
    monto_estimado: 1450000,
    fecha_cotizacion: '2026-09-03',
    notas: 'Cotización emitida por representante oficial Dräger Medical Chile.',
    created_at: '2026-09-02T11:00:00.000Z',
    updated_at: '2026-09-03T16:00:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333302',
    codigo: 'EXT-002',
    origen: 'mantenimiento',
    codigo_mantenimiento: 'MANT-002',
    mantenimiento_id: '22222222-2222-4222-8222-222222222202',
    tipo: 'Compra de servicio de mantenimiento o reparación externa',
    descripcion: 'Reparación de cable coaxial y conector de transductor lineal L12-4 para ecógrafo portátil.',
    equipo_identificacion: 'EQ-006 — Ecógrafo Portátil',
    equipo_id: '11111111-1111-4111-8111-111111111106',
    solicitante: 'Dr. Roberto Soto',
    etapa_actual: 'Informe de Requerimiento Creado',
    cotizacion_url: 'https://example.com/docs/cotizacion_sonosite_repair.pdf',
    cotizacion_nombre: 'Cotizacion_Servicio_Tecnico_Transductor.pdf',
    monto_estimado: 890000,
    fecha_cotizacion: '2026-09-06',
    informe_req_url: 'https://example.com/docs/req_2026_0941.pdf',
    informe_req_nombre: 'Informe_Requerimiento_REQ-2026-0941.pdf',
    informe_req_folio: 'REQ-2026-0941',
    fecha_informe_req: '2026-09-07',
    notas: 'Informe visado por Jefatura de Imagenología y Dirección Médica.',
    created_at: '2026-09-05T15:00:00.000Z',
    updated_at: '2026-09-07T10:30:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333303',
    codigo: 'EXT-003',
    origen: 'directa',
    codigo_mantenimiento: null,
    mantenimiento_id: null,
    tipo: 'Compra de repuesto por fondo fijo',
    descripcion: 'Reposición urgente de 10 paquetes de cables troncales ECG y 20 mangueras de PNI adulto para stock clínico de emergencia.',
    equipo_identificacion: 'Stock Insumos Críticos — Pabellón Quirúrgico y UCI',
    equipo_id: null,
    solicitante: 'Enf. Patricia Morales',
    etapa_actual: 'En Espera de Orden de Compra',
    cotizacion_url: 'https://example.com/docs/cotizacion_cables_pni.pdf',
    cotizacion_nombre: 'Cotizacion_MedSup_CablesTroncales.pdf',
    monto_estimado: 380000,
    fecha_cotizacion: '2026-08-25',
    informe_req_url: null,
    informe_req_folio: 'REQ-FF-2026-018',
    informe_req_nombre: 'Memorandum_FondoFijo_018.pdf',
    fecha_informe_req: '2026-08-26',
    solicitud_compra_folio: 'SC-2026-0881',
    solicitud_compra_url: 'https://doc.hospital.cl/sc/SC-2026-0881',
    fecha_solicitud_compra: '2026-08-28',
    notas: 'Aprobado por Subdirección Administrativa con cargo a Fondo Fijo de Equipamiento.',
    created_at: '2026-08-25T08:30:00.000Z',
    updated_at: '2026-08-28T14:00:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333304',
    codigo: 'EXT-004',
    origen: 'mantenimiento',
    codigo_mantenimiento: 'MANT-003',
    mantenimiento_id: '22222222-2222-4222-8222-222222222203',
    tipo: 'Compra de repuesto por fondo fijo',
    descripcion: 'Brazalete adulto NIBP nuevo (Ref: M1574A) adquirido por reposición directa.',
    equipo_identificacion: 'EQ-001 — Monitor de Signos Vitales',
    equipo_id: '11111111-1111-4111-8111-111111111101',
    solicitante: 'Enf. Patricia Morales',
    etapa_actual: 'Finalizada / Recibida',
    cotizacion_url: 'https://example.com/docs/cotiz_brazalete.pdf',
    cotizacion_nombre: 'Cotiz_Brazalete_Philips.pdf',
    monto_estimado: 85000,
    fecha_cotizacion: '2026-08-18',
    informe_req_folio: 'REQ-2026-0772',
    informe_req_nombre: 'Req_Brazalete_0772.pdf',
    fecha_informe_req: '2026-08-19',
    solicitud_compra_folio: 'SC-2026-0715',
    fecha_solicitud_compra: '2026-08-19',
    numero_oc: '2398-105-CM26',
    oc_url: 'https://mercadopublico.cl/oc/2398-105-CM26',
    oc_nombre: 'OC_MercadoPublico_2398-105-CM26.pdf',
    fecha_oc: '2026-08-20',
    fecha_recepcion: '2026-08-21',
    notas: 'Repuesto recibido conforme en bodega técnica e instalado satisfactoriamente.',
    created_at: '2026-08-18T09:00:00.000Z',
    updated_at: '2026-08-21T16:00:00.000Z',
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
  let externalizaciones: Externalizacion[] = getStored<Externalizacion[]>('externalizaciones', INITIAL_EXTERNALIZACIONES);
  let perfiles: PerfilUsuario[] = getStored<PerfilUsuario[]>('perfiles', INITIAL_PERFILES).map((p) => {
    if (p.rol === 'Ingeniero de Servicio / Técnico' && p.permisos?.crear_solicitud_ot) {
      return {
        ...p,
        permisos: {
          ...p.permisos,
          crear_solicitud_ot: false,
        },
      };
    }
    return p;
  });
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

  function getNextExtCode(): string {
    let maxNum = 0;
    for (const ext of externalizaciones) {
      const match = ext.codigo?.match(/(\d+)\s*$/);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    return `EXT-${String(maxNum + 1).padStart(3, '0')}`;
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
                else if (tableName === 'externalizaciones') dataset = [...(externalizaciones as unknown as Record<string, unknown>[])];
                else if (tableName === 'perfiles') dataset = [...(perfiles as unknown as Record<string, unknown>[])];

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
            } else if (tableName === 'externalizaciones' && !newItem.codigo) {
              newItem.codigo = getNextExtCode();
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
            } else if (tableName === 'externalizaciones') {
              externalizaciones = [newItem as unknown as Externalizacion, ...externalizaciones];
              setStored('externalizaciones', externalizaciones);
            } else if (tableName === 'perfiles') {
              perfiles = [newItem as unknown as PerfilUsuario, ...perfiles];
              setStored('perfiles', perfiles);
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
                } else if (tableName === 'externalizaciones') {
                  externalizaciones = externalizaciones.map((ext) =>
                    (ext as unknown as Record<string, unknown>)[column] === value
                      ? ({ ...ext, ...updates, updated_at: new Date().toISOString() } as unknown as Externalizacion)
                      : ext
                  );
                  setStored('externalizaciones', externalizaciones);
                } else if (tableName === 'perfiles') {
                  perfiles = perfiles.map((p) =>
                    (p as unknown as Record<string, unknown>)[column] === value
                      ? ({ ...p, ...updates } as unknown as PerfilUsuario)
                      : p
                  );
                  setStored('perfiles', perfiles);
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
                } else if (tableName === 'externalizaciones') {
                  externalizaciones = externalizaciones.filter(
                    (ext) => (ext as unknown as Record<string, unknown>)[column] !== value
                  );
                  setStored('externalizaciones', externalizaciones);
                } else if (tableName === 'perfiles') {
                  perfiles = perfiles.filter(
                    (p) => (p as unknown as Record<string, unknown>)[column] !== value
                  );
                  setStored('perfiles', perfiles);
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
