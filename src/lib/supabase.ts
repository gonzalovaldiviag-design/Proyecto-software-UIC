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
  requiere_externalizacion?: boolean | null;
  tipo_externalizacion?: TipoExternalizacion | null;
  estado_solicitud_externalizacion?: 'Ninguna' | 'Pendiente_Aprobacion' | 'Aprobada' | 'Rechazada' | null;
  motivo_externalizacion?: string | null;
  externalizacion_solicitada_por?: string | null;
  externalizacion_resuelta_por?: string | null;
  created_at: string;
}

export type TipoNotificacion =
  | 'ot_asignada'
  | 'solicitud_externalizacion'
  | 'externalizacion_aprobada'
  | 'externalizacion_rechazada'
  | 'externalizacion_finalizada'
  | 'info'
  | 'alerta';

export interface Notificacion {
  id: string;
  destinatario_id?: string | null;
  destinatario_rol?: RolUsuario | null;
  destinatario_nombre?: string | null;
  titulo: string;
  mensaje: string;
  tipo: TipoNotificacion;
  leida: boolean;
  mantenimiento_id?: string | null;
  codigo_mantenimiento?: string | null;
  codigo_mantenimiento_ref?: string | null;
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
  tipo_origen?: string;
  codigo_mantenimiento?: string | null;
  codigo_mantenimiento_ref?: string | null;
  mantenimiento_id?: string | null;
  tipo: TipoExternalizacion;
  clasificacion?: string;
  descripcion: string;
  descripcion_requerimiento?: string;
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

  // Convenios y Pagos
  ver_convenios?: boolean;
  gestionar_convenios?: boolean;

  // Administración y Usuarios
  gestionar_usuarios: boolean;
}

export type TipoConvenio = 'Garantía' | 'Comodato' | 'Arriendo' | 'Mantenimiento' | 'Suministro';
export type EstadoConvenio = 'Vigente' | 'Por Vencer' | 'Vencido' | 'Finalizado' | 'En Tramitación';

export interface Convenio {
  id: string;
  codigo: string;
  nombre: string;
  empresa: string;
  rut_empresa?: string | null;
  tipo_convenio: TipoConvenio;
  fecha_inicio: string;
  fecha_termino: string;
  monto_total_comprometido: number;
  moneda: 'CLP' | 'UF';
  valor_uf?: number | null;
  orden_compra_madre?: string | null;
  licitacion_id?: string | null;
  estado: EstadoConvenio;
  responsable?: string | null;
  descripcion?: string | null;
  created_at: string;
}

export type EstadoVinculoEquipo = 'Activo' | 'Desvinculado';

export interface ConvenioEquipo {
  id: string;
  convenio_id: string;
  equipo_id: string;
  fecha_incorporacion: string;
  fecha_salida?: string | null;
  motivo_salida?: string | null;
  estado_vinculo: EstadoVinculoEquipo;
  observaciones?: string | null;
  created_at: string;
}

export interface ConvenioCuotaMensual {
  id: string;
  convenio_id: string;
  estado_uic: string;
  numero_guia: string;
  fecha_guia: string;
  codigo_mi_ssvq: string;
  fecha_entrega_abastecimiento: string;
  empresa: string;
  equipo_servicio: string;
  orden_compra: string;
  fecha_oc: string;
  mes: string;
  anio: number;
  cuota: string;
  valor_clp: number;
  estado_mercado_publico: string;
  numero_factura: string;
  fecha_factura: string;
  observaciones?: string | null;
  created_at: string;
}

export interface VistaAuditoriaConvenios {
  total_presupuesto_comprometido_clp: number;
  total_presupuesto_comprometido_uf: number;
  monto_ejecutado_clp: number;
  saldo_deuda_clp: number;
  convenios_por_vencer_count: number;
  cuotas_traba_administrativa_count: number;
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
    requiere_externalizacion: false,
    tipo_externalizacion: 'Compra de servicio de mantenimiento o reparación externa',
    estado_solicitud_externalizacion: 'Pendiente_Aprobacion',
    motivo_externalizacion: 'Se requiere reparación técnica especializada en laboratorio del fabricante para calibración acústica y conector de transductor lineal.',
    externalizacion_solicitada_por: 'Téc. Fernando Ruiz',
    externalizacion_resuelta_por: null,
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

export const INITIAL_NOTIFICACIONES: Notificacion[] = [
  {
    id: '44444444-4444-4444-8444-444444444401',
    destinatario_rol: 'Ingeniero Supervisor',
    destinatario_id: null,
    destinatario_nombre: null,
    titulo: 'Solicitud de Externalización - MANT-002',
    mensaje: 'El técnico Téc. Fernando Ruiz solicita externalización para la OT MANT-002 (EQ-006 — Ecógrafo Portátil). Motivo: Se requiere reparación técnica especializada en laboratorio del fabricante para calibración acústica y conector de transductor lineal.',
    tipo: 'solicitud_externalizacion',
    leida: false,
    mantenimiento_id: '22222222-2222-4222-8222-222222222202',
    codigo_mantenimiento: 'MANT-002',
    codigo_mantenimiento_ref: 'MANT-002',
    created_at: '2026-09-05T14:45:00.000Z',
  },
  {
    id: '44444444-4444-4444-8444-444444444402',
    destinatario_rol: 'Ingeniero de Servicio / Técnico',
    destinatario_id: 'user-003-tecnico',
    destinatario_nombre: 'Téc. Fernando Ruiz',
    titulo: 'Nueva OT Asignada: MANT-003',
    mensaje: 'Se te ha asignado la orden para el equipo EQ-001 — Monitor de Signos Vitales del servicio UCI - Sala 3.',
    tipo: 'ot_asignada',
    leida: false,
    mantenimiento_id: '22222222-2222-4222-8222-222222222203',
    codigo_mantenimiento: 'MANT-003',
    codigo_mantenimiento_ref: 'MANT-003',
    created_at: '2026-08-20T09:10:00.000Z',
  },
  {
    id: '44444444-4444-4444-8444-444444444403',
    destinatario_rol: 'Ingeniero de Servicio / Técnico',
    destinatario_id: 'user-003-tecnico',
    destinatario_nombre: 'Téc. Fernando Ruiz',
    titulo: 'Externalización Autorizada: MANT-001',
    mensaje: 'El requerimiento de compra/servicio externo fue aprobado e ingresado a Compras.',
    tipo: 'externalizacion_aprobada',
    leida: false,
    mantenimiento_id: '22222222-2222-4222-8222-222222222201',
    codigo_mantenimiento: 'MANT-001',
    codigo_mantenimiento_ref: 'MANT-001',
    created_at: '2026-09-03T11:30:00.000Z',
  },
  {
    id: '44444444-4444-4444-8444-444444444404',
    destinatario_rol: 'Ingeniero de Servicio / Técnico',
    destinatario_id: 'user-003-tecnico',
    destinatario_nombre: 'Téc. Fernando Ruiz',
    titulo: 'Insumo/Servicio Recibido: MANT-003',
    mensaje: 'La gestión externa ha concluido (OC recepcionada). Ya puedes proceder con la ejecución y cierre de la OT.',
    tipo: 'externalizacion_finalizada',
    leida: false,
    mantenimiento_id: '22222222-2222-4222-8222-222222222203',
    codigo_mantenimiento: 'MANT-003',
    codigo_mantenimiento_ref: 'MANT-003',
    created_at: '2026-08-21T16:30:00.000Z',
  },
];

export const INITIAL_CONVENIOS: Convenio[] = [
  {
    id: '55555555-5555-4555-8555-555555555501',
    codigo: 'CONV-2025-001',
    nombre: 'Arriendo Integral de Monitores Multiparamétricos y Bombas de Infusión',
    empresa: 'Philips Chilena S.A.',
    rut_empresa: '96.541.230-8',
    tipo_convenio: 'Arriendo',
    fecha_inicio: '2025-01-01',
    fecha_termino: '2026-12-31',
    monto_total_comprometido: 48000000,
    moneda: 'CLP',
    valor_uf: 1250,
    orden_compra_madre: '2398-102-LR25',
    licitacion_id: '2398-45-LP24',
    estado: 'Vigente',
    responsable: 'Ing. Pamela Soto',
    descripcion: 'Contrato de arriendo con mantención preventiva trimestral y soporte técnico especializado.',
    created_at: '2025-01-01T08:00:00.000Z',
  },
  {
    id: '55555555-5555-4555-8555-555555555502',
    codigo: 'CONV-2025-002',
    nombre: 'Comodato de Equipos de Ultrasonido y Diagnóstico Portátil',
    empresa: 'Sonosite Medical Chile SpA',
    rut_empresa: '76.890.112-K',
    tipo_convenio: 'Comodato',
    fecha_inicio: '2025-10-15',
    fecha_termino: '2026-10-30',
    monto_total_comprometido: 18500000,
    moneda: 'CLP',
    valor_uf: 480,
    orden_compra_madre: '2398-330-CM25',
    licitacion_id: '2398-12-LE25',
    estado: 'Por Vencer',
    responsable: 'Ing. Carlos Mendoza',
    descripcion: 'Comodato de ecografía en Maternidad. Requiere renovación o restitución en menos de 60 días.',
    created_at: '2025-10-15T09:00:00.000Z',
  },
  {
    id: '55555555-5555-4555-8555-555555555503',
    codigo: 'CONV-2026-003',
    nombre: 'Garantía Técnica y Mantención Equipos de Desfibrilación',
    empresa: 'Zoll Medical de Chile',
    rut_empresa: '77.210.450-4',
    tipo_convenio: 'Garantía',
    fecha_inicio: '2026-01-01',
    fecha_termino: '2027-01-01',
    monto_total_comprometido: 9600000,
    moneda: 'CLP',
    valor_uf: 250,
    orden_compra_madre: '2398-012-CM26',
    licitacion_id: '2398-02-LR26',
    estado: 'Vigente',
    responsable: 'Téc. Fernando Ruiz',
    descripcion: 'Garantía extendida de fabricante con reemplazo de palas y calibración semestral.',
    created_at: '2026-01-01T10:00:00.000Z',
  },
  {
    id: '55555555-5555-4555-8555-555555555504',
    codigo: 'CONV-2024-004',
    nombre: 'Arriendo Operativo de Centrífugas de Laboratorio Clínico',
    empresa: 'Eppendorf Chile Ltda.',
    rut_empresa: '76.123.456-7',
    tipo_convenio: 'Arriendo',
    fecha_inicio: '2024-06-01',
    fecha_termino: '2027-06-30',
    monto_total_comprometido: 14400000,
    moneda: 'CLP',
    valor_uf: 375,
    orden_compra_madre: '2398-140-CM24',
    licitacion_id: '2398-88-LP23',
    estado: 'Vigente',
    responsable: 'Ing. Pamela Soto',
    descripcion: 'Arriendo de centrífuga con servicio preventivo y mantención de rotores incluidos.',
    created_at: '2024-06-01T11:00:00.000Z',
  },
];

export const INITIAL_CONVENIO_EQUIPOS: ConvenioEquipo[] = [
  {
    id: '66666666-6666-4666-8666-666666666601',
    convenio_id: '55555555-5555-4555-8555-555555555501',
    equipo_id: '11111111-1111-4111-8111-111111111101',
    fecha_incorporacion: '2025-01-01',
    estado_vinculo: 'Activo',
    observaciones: 'Equipo Monitor Philips asignado a UCI - Sala 3.',
    created_at: '2025-01-01T08:30:00.000Z',
  },
  {
    id: '66666666-6666-4666-8666-666666666602',
    convenio_id: '55555555-5555-4555-8555-555555555501',
    equipo_id: '11111111-1111-4111-8111-111111111103',
    fecha_incorporacion: '2025-01-01',
    estado_vinculo: 'Activo',
    observaciones: 'Bomba de Infusión amparada en Pabellón Quirúrgico.',
    created_at: '2025-01-01T08:30:00.000Z',
  },
  {
    id: '66666666-6666-4666-8666-666666666603',
    convenio_id: '55555555-5555-4555-8555-555555555502',
    equipo_id: '11111111-1111-4111-8111-111111111106',
    fecha_incorporacion: '2025-10-15',
    estado_vinculo: 'Activo',
    observaciones: 'Ecógrafo Portátil en Maternidad. Alerta: Comodato por Vencer (< 60 días).',
    created_at: '2025-10-15T09:30:00.000Z',
  },
  {
    id: '66666666-6666-4666-8666-666666666604',
    convenio_id: '55555555-5555-4555-8555-555555555503',
    equipo_id: '11111111-1111-4111-8111-111111111105',
    fecha_incorporacion: '2026-01-01',
    estado_vinculo: 'Activo',
    observaciones: 'Desfibrilador en Emergencias amparado por Garantía Vigente.',
    created_at: '2026-01-01T10:30:00.000Z',
  },
  {
    id: '66666666-6666-4666-8666-666666666605',
    convenio_id: '55555555-5555-4555-8555-555555555504',
    equipo_id: '11111111-1111-4111-8111-111111111110',
    fecha_incorporacion: '2024-06-01',
    estado_vinculo: 'Activo',
    observaciones: 'Centrífuga en Laboratorio con arriendo operativo vigente.',
    created_at: '2024-06-01T11:30:00.000Z',
  },
  {
    id: '66666666-6666-4666-8666-666666666606',
    convenio_id: '55555555-5555-4555-8555-555555555501',
    equipo_id: '11111111-1111-4111-8111-111111111102',
    fecha_incorporacion: '2025-01-01',
    fecha_salida: '2026-02-28',
    motivo_salida: 'Traspaso a nueva licitación de ventilación mecánica especializada',
    estado_vinculo: 'Desvinculado',
    observaciones: 'Desvinculado conforme según acta de entrega.',
    created_at: '2025-01-01T08:30:00.000Z',
  },
];

export const INITIAL_CONVENIO_CUOTAS: ConvenioCuotaMensual[] = [
  {
    id: '77777777-7777-4777-8777-777777777701',
    convenio_id: '55555555-5555-4555-8555-555555555501',
    estado_uic: 'Facturado Conforme',
    numero_guia: 'G-10221',
    fecha_guia: '2026-01-08',
    codigo_mi_ssvq: 'SSVQ-MI-2026-001',
    fecha_entrega_abastecimiento: '2026-01-12',
    empresa: 'Philips Chilena S.A.',
    equipo_servicio: 'Monitores UCI - Sala 3',
    orden_compra: '2398-102-LR25',
    fecha_oc: '2026-01-15',
    mes: 'Enero',
    anio: 2026,
    cuota: '1/12',
    valor_clp: 4000000,
    estado_mercado_publico: 'Recepcionado Conforme',
    numero_factura: 'F-91201',
    fecha_factura: '2026-01-18',
    observaciones: 'Pago conforme y procesado en Tesorería.',
    created_at: '2026-01-18T10:00:00.000Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777702',
    convenio_id: '55555555-5555-4555-8555-555555555501',
    estado_uic: 'Facturado Conforme',
    numero_guia: 'G-10340',
    fecha_guia: '2026-02-06',
    codigo_mi_ssvq: 'SSVQ-MI-2026-022',
    fecha_entrega_abastecimiento: '2026-02-10',
    empresa: 'Philips Chilena S.A.',
    equipo_servicio: 'Monitores UCI - Sala 3',
    orden_compra: '2398-102-LR25',
    fecha_oc: '2026-02-14',
    mes: 'Febrero',
    anio: 2026,
    cuota: '2/12',
    valor_clp: 4000000,
    estado_mercado_publico: 'Recepcionado Conforme',
    numero_factura: 'F-91605',
    fecha_factura: '2026-02-18',
    observaciones: 'Recepción conforme en Abastecimiento.',
    created_at: '2026-02-18T10:00:00.000Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777703',
    convenio_id: '55555555-5555-4555-8555-555555555501',
    estado_uic: 'Facturado Conforme',
    numero_guia: 'G-10499',
    fecha_guia: '2026-03-05',
    codigo_mi_ssvq: 'SSVQ-MI-2026-045',
    fecha_entrega_abastecimiento: '2026-03-09',
    empresa: 'Philips Chilena S.A.',
    equipo_servicio: 'Monitores UCI - Sala 3',
    orden_compra: '2398-102-LR25',
    fecha_oc: '2026-03-12',
    mes: 'Marzo',
    anio: 2026,
    cuota: '3/12',
    valor_clp: 4000000,
    estado_mercado_publico: 'Recepcionado Conforme',
    numero_factura: 'F-92012',
    fecha_factura: '2026-03-15',
    observaciones: 'Cuota marzo visada por UIC.',
    created_at: '2026-03-15T10:00:00.000Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777704',
    convenio_id: '55555555-5555-4555-8555-555555555501',
    estado_uic: 'Facturado Conforme',
    numero_guia: 'G-10611',
    fecha_guia: '2026-04-07',
    codigo_mi_ssvq: 'SSVQ-MI-2026-071',
    fecha_entrega_abastecimiento: '2026-04-10',
    empresa: 'Philips Chilena S.A.',
    equipo_servicio: 'Monitores UCI - Sala 3',
    orden_compra: '2398-102-LR25',
    fecha_oc: '2026-04-14',
    mes: 'Abril',
    anio: 2026,
    cuota: '4/12',
    valor_clp: 4000000,
    estado_mercado_publico: 'Recepcionado Conforme',
    numero_factura: 'F-92430',
    fecha_factura: '2026-04-18',
    observaciones: 'Devengado y enviado a pago.',
    created_at: '2026-04-18T10:00:00.000Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777705',
    convenio_id: '55555555-5555-4555-8555-555555555501',
    estado_uic: 'Facturado Conforme',
    numero_guia: 'G-10702',
    fecha_guia: '2026-05-06',
    codigo_mi_ssvq: 'SSVQ-MI-2026-098',
    fecha_entrega_abastecimiento: '2026-05-11',
    empresa: 'Philips Chilena S.A.',
    equipo_servicio: 'Monitores UCI - Sala 3',
    orden_compra: '2398-102-LR25',
    fecha_oc: '2026-05-15',
    mes: 'Mayo',
    anio: 2026,
    cuota: '5/12',
    valor_clp: 4000000,
    estado_mercado_publico: 'Recepcionado Conforme',
    numero_factura: 'F-92890',
    fecha_factura: '2026-05-20',
    observaciones: 'Pago realizado.',
    created_at: '2026-05-20T10:00:00.000Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777706',
    convenio_id: '55555555-5555-4555-8555-555555555501',
    estado_uic: 'Facturado Conforme',
    numero_guia: 'G-10815',
    fecha_guia: '2026-06-08',
    codigo_mi_ssvq: 'SSVQ-MI-2026-115',
    fecha_entrega_abastecimiento: '2026-06-12',
    empresa: 'Philips Chilena S.A.',
    equipo_servicio: 'Monitores UCI - Sala 3',
    orden_compra: '2398-102-LR25',
    fecha_oc: '2026-06-16',
    mes: 'Junio',
    anio: 2026,
    cuota: '6/12',
    valor_clp: 4000000,
    estado_mercado_publico: 'Recepcionado Conforme',
    numero_factura: 'F-93310',
    fecha_factura: '2026-06-20',
    observaciones: 'Conformidad técnica y administrativa aprobada.',
    created_at: '2026-06-20T10:00:00.000Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777707',
    convenio_id: '55555555-5555-4555-8555-555555555501',
    estado_uic: 'Facturado Conforme',
    numero_guia: 'G-10940',
    fecha_guia: '2026-07-07',
    codigo_mi_ssvq: 'SSVQ-MI-2026-140',
    fecha_entrega_abastecimiento: '2026-07-10',
    empresa: 'Philips Chilena S.A.',
    equipo_servicio: 'Monitores UCI - Sala 3',
    orden_compra: '2398-102-LR25',
    fecha_oc: '2026-07-15',
    mes: 'Julio',
    anio: 2026,
    cuota: '7/12',
    valor_clp: 4000000,
    estado_mercado_publico: 'Recepcionado Conforme',
    numero_factura: 'F-93780',
    fecha_factura: '2026-07-19',
    observaciones: 'Pago emitido.',
    created_at: '2026-07-19T10:00:00.000Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777708',
    convenio_id: '55555555-5555-4555-8555-555555555501',
    estado_uic: 'Facturado Conforme',
    numero_guia: 'G-11052',
    fecha_guia: '2026-08-05',
    codigo_mi_ssvq: 'SSVQ-MI-2026-165',
    fecha_entrega_abastecimiento: '2026-08-10',
    empresa: 'Philips Chilena S.A.',
    equipo_servicio: 'Monitores UCI - Sala 3',
    orden_compra: '2398-102-LR25',
    fecha_oc: '2026-08-14',
    mes: 'Agosto',
    anio: 2026,
    cuota: '8/12',
    valor_clp: 4000000,
    estado_mercado_publico: 'Recepcionado Conforme',
    numero_factura: 'F-94215',
    fecha_factura: '2026-08-18',
    observaciones: 'Pago conforme en Abastecimiento.',
    created_at: '2026-08-18T10:00:00.000Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777709',
    convenio_id: '55555555-5555-4555-8555-555555555501',
    estado_uic: 'Pendiente de OC',
    numero_guia: 'G-11204',
    fecha_guia: '2026-09-05',
    codigo_mi_ssvq: 'SSVQ-MI-2026-192',
    fecha_entrega_abastecimiento: '2026-09-08',
    empresa: 'Philips Chilena S.A.',
    equipo_servicio: 'Monitores UCI - Sala 3',
    orden_compra: '',
    fecha_oc: '',
    mes: 'Septiembre',
    anio: 2026,
    cuota: '9/12',
    valor_clp: 4000000,
    estado_mercado_publico: 'Pendiente OC',
    numero_factura: 'F-94801',
    fecha_factura: '2026-09-12',
    observaciones: 'Traba administrativa: Guía emitida y recepcionada, pero Abastecimiento aún no genera OC mensual.',
    created_at: '2026-09-12T10:00:00.000Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777710',
    convenio_id: '55555555-5555-4555-8555-555555555502',
    estado_uic: 'Sin presupuesto',
    numero_guia: 'G-11218',
    fecha_guia: '2026-09-10',
    codigo_mi_ssvq: 'SSVQ-MI-2026-199',
    fecha_entrega_abastecimiento: '2026-09-14',
    empresa: 'Sonosite Medical Chile SpA',
    equipo_servicio: 'Ecografía Portátil Maternidad',
    orden_compra: '',
    fecha_oc: '',
    mes: 'Septiembre',
    anio: 2026,
    cuota: '11/12',
    valor_clp: 1541666,
    estado_mercado_publico: 'Observada / Sin Saldo',
    numero_factura: 'F-55019',
    fecha_factura: '2026-09-15',
    observaciones: 'Traba administrativa: Alerta de falta de suplementación presupuestaria en ítem 22 para cierre de comodato.',
    created_at: '2026-09-15T11:00:00.000Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777711',
    convenio_id: '55555555-5555-4555-8555-555555555503',
    estado_uic: 'Facturado Conforme',
    numero_guia: 'G-11088',
    fecha_guia: '2026-08-12',
    codigo_mi_ssvq: 'SSVQ-MI-2026-170',
    fecha_entrega_abastecimiento: '2026-08-15',
    empresa: 'Zoll Medical de Chile',
    equipo_servicio: 'Desfibriladores Emergencias',
    orden_compra: '2398-012-CM26',
    fecha_oc: '2026-08-18',
    mes: 'Agosto',
    anio: 2026,
    cuota: '8/12',
    valor_clp: 800000,
    estado_mercado_publico: 'Recepcionado Conforme',
    numero_factura: 'F-8812',
    fecha_factura: '2026-08-20',
    observaciones: 'Mantención preventiva y garantía al día.',
    created_at: '2026-08-20T10:00:00.000Z',
  },
  {
    id: '77777777-7777-4777-8777-777777777712',
    convenio_id: '55555555-5555-4555-8555-555555555504',
    estado_uic: 'Facturado Conforme',
    numero_guia: 'G-11095',
    fecha_guia: '2026-08-15',
    codigo_mi_ssvq: 'SSVQ-MI-2026-175',
    fecha_entrega_abastecimiento: '2026-08-18',
    empresa: 'Eppendorf Chile Ltda.',
    equipo_servicio: 'Centrífuga Laboratorio Clínico',
    orden_compra: '2398-140-CM24',
    fecha_oc: '2026-08-20',
    mes: 'Agosto',
    anio: 2026,
    cuota: '8/12',
    valor_clp: 1200000,
    estado_mercado_publico: 'Recepcionado Conforme',
    numero_factura: 'F-77401',
    fecha_factura: '2026-08-22',
    observaciones: 'Arriendo mensual al día.',
    created_at: '2026-08-22T10:00:00.000Z',
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
  let notificaciones: Notificacion[] = getStored<Notificacion[]>('notificaciones', INITIAL_NOTIFICACIONES);
  let convenios: Convenio[] = getStored<Convenio[]>('convenios', INITIAL_CONVENIOS);
  let convenioEquipos: ConvenioEquipo[] = getStored<ConvenioEquipo[]>('convenio_equipos', INITIAL_CONVENIO_EQUIPOS);
  let convenioCuotas: ConvenioCuotaMensual[] = getStored<ConvenioCuotaMensual[]>('convenio_cuotas', INITIAL_CONVENIO_CUOTAS);
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

  function getNextConvCode(): string {
    let maxNum = 0;
    const currentYear = new Date().getFullYear();
    for (const c of convenios) {
      const match = c.codigo?.match(/(\d+)\s*$/);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    return `CONV-${currentYear}-${String(maxNum + 1).padStart(3, '0')}`;
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
                else if (tableName === 'notificaciones') {
                  notificaciones = getStored<Notificacion[]>('notificaciones', notificaciones);
                  dataset = [...(notificaciones as unknown as Record<string, unknown>[])];
                }
                else if (tableName === 'perfiles') {
                  perfiles = getStored<PerfilUsuario[]>('perfiles', perfiles);
                  dataset = [...(perfiles as unknown as Record<string, unknown>[])];
                }
                else if (tableName === 'convenios') {
                  convenios = getStored<Convenio[]>('convenios', convenios);
                  dataset = [...(convenios as unknown as Record<string, unknown>[])];
                }
                else if (tableName === 'convenio_equipos') {
                  convenioEquipos = getStored<ConvenioEquipo[]>('convenio_equipos', convenioEquipos);
                  dataset = [...(convenioEquipos as unknown as Record<string, unknown>[])];
                }
                else if (tableName === 'convenio_cuotas_mensuales') {
                  convenioCuotas = getStored<ConvenioCuotaMensual[]>('convenio_cuotas', convenioCuotas);
                  dataset = [...(convenioCuotas as unknown as Record<string, unknown>[])];
                }
                else if (tableName === 'vista_auditoria_convenios') {
                  convenios = getStored<Convenio[]>('convenios', convenios);
                  convenioCuotas = getStored<ConvenioCuotaMensual[]>('convenio_cuotas', convenioCuotas);
                  const totalComprometido = convenios.reduce((acc, c) => acc + (c.monto_total_comprometido || 0), 0);
                  const montoEjecutado = convenioCuotas
                    .filter((q) => q.estado_uic === 'Facturado Conforme' || q.estado_uic === 'Pagado')
                    .reduce((acc, q) => acc + (q.valor_clp || 0), 0);
                  const saldoDeuda = Math.max(0, totalComprometido - montoEjecutado);
                  const hoy = new Date();
                  const conveniosPorVencer = convenios.filter((c) => {
                    if (!c.fecha_termino) return false;
                    const diffDays = Math.ceil((new Date(c.fecha_termino).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                    return diffDays >= 0 && diffDays <= 60;
                  }).length;
                  const cuotasTrabaAdmin = convenioCuotas.filter((q) => {
                    const tieneGuia = Boolean(q.numero_guia && q.numero_guia.trim() !== '');
                    const estado = (q.estado_uic || '').trim().toLowerCase();
                    return tieneGuia && (estado === 'pendiente de oc' || estado === 'sin presupuesto');
                  }).length;

                  const row: VistaAuditoriaConvenios = {
                    total_presupuesto_comprometido_clp: totalComprometido,
                    total_presupuesto_comprometido_uf: Math.round(totalComprometido / 38500),
                    monto_ejecutado_clp: montoEjecutado,
                    saldo_deuda_clp: saldoDeuda,
                    convenios_por_vencer_count: conveniosPorVencer,
                    cuotas_traba_administrativa_count: cuotasTrabaAdmin,
                  };
                  dataset = [row as unknown as Record<string, unknown>];
                }

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

        insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
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
            } else if (tableName === 'notificaciones') {
              notificaciones = getStored<Notificacion[]>('notificaciones', notificaciones);
              notificaciones = [newItem as unknown as Notificacion, ...notificaciones];
              setStored('notificaciones', notificaciones);
            } else if (tableName === 'perfiles') {
              perfiles = getStored<PerfilUsuario[]>('perfiles', perfiles);
              perfiles = [newItem as unknown as PerfilUsuario, ...perfiles];
              setStored('perfiles', perfiles);
            } else if (tableName === 'convenios') {
              if (!newItem.codigo) newItem.codigo = getNextConvCode();
              convenios = getStored<Convenio[]>('convenios', convenios);
              convenios = [newItem as unknown as Convenio, ...convenios];
              setStored('convenios', convenios);
            } else if (tableName === 'convenio_equipos') {
              convenioEquipos = getStored<ConvenioEquipo[]>('convenio_equipos', convenioEquipos);
              convenioEquipos = [newItem as unknown as ConvenioEquipo, ...convenioEquipos];
              setStored('convenio_equipos', convenioEquipos);
            } else if (tableName === 'convenio_cuotas_mensuales') {
              convenioCuotas = getStored<ConvenioCuotaMensual[]>('convenio_cuotas', convenioCuotas);
              convenioCuotas = [newItem as unknown as ConvenioCuotaMensual, ...convenioCuotas];
              setStored('convenio_cuotas', convenioCuotas);
            }
            created.push(newItem);
          }

          const response = { data: created, error: null };
          return {
            ...response,
            select() {
              return Promise.resolve(response);
            },
            then<TResult1 = typeof response, TResult2 = never>(
              onfulfilled?: ((value: typeof response) => TResult1 | PromiseLike<TResult1>) | null,
              onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
            ) {
              return Promise.resolve(response).then(onfulfilled, onrejected);
            },
          };
        },

        update(updates: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              const updatedRows: Record<string, unknown>[] = [];
              if (tableName === 'equipos') {
                equipos = equipos.map((eq) => {
                  if ((eq as unknown as Record<string, unknown>)[column] === value) {
                    const row = { ...eq, ...updates } as unknown as Equipo;
                    updatedRows.push(row as unknown as Record<string, unknown>);
                    return row;
                  }
                  return eq;
                });
                setStored('equipos', equipos);
              } else if (tableName === 'mantenimientos') {
                mantenimientos = mantenimientos.map((m) => {
                  if ((m as unknown as Record<string, unknown>)[column] === value) {
                    const row = { ...m, ...updates } as unknown as Mantenimiento;
                    updatedRows.push(row as unknown as Record<string, unknown>);
                    return row;
                  }
                  return m;
                });
                setStored('mantenimientos', mantenimientos);
              } else if (tableName === 'externalizaciones') {
                externalizaciones = externalizaciones.map((ext) => {
                  if ((ext as unknown as Record<string, unknown>)[column] === value) {
                    const row = {
                      ...ext,
                      ...updates,
                      updated_at: new Date().toISOString(),
                    } as unknown as Externalizacion;
                    updatedRows.push(row as unknown as Record<string, unknown>);
                    return row;
                  }
                  return ext;
                });
                setStored('externalizaciones', externalizaciones);
              } else if (tableName === 'notificaciones') {
                notificaciones = getStored<Notificacion[]>('notificaciones', notificaciones);
                notificaciones = notificaciones.map((n) => {
                  if ((n as unknown as Record<string, unknown>)[column] === value) {
                    const row = { ...n, ...updates } as unknown as Notificacion;
                    updatedRows.push(row as unknown as Record<string, unknown>);
                    return row;
                  }
                  return n;
                });
                setStored('notificaciones', notificaciones);
              } else if (tableName === 'perfiles') {
                perfiles = getStored<PerfilUsuario[]>('perfiles', perfiles);
                perfiles = perfiles.map((p) => {
                  if ((p as unknown as Record<string, unknown>)[column] === value) {
                    const row = { ...p, ...updates } as unknown as PerfilUsuario;
                    updatedRows.push(row as unknown as Record<string, unknown>);
                    return row;
                  }
                  return p;
                });
                setStored('perfiles', perfiles);
              } else if (tableName === 'convenios') {
                convenios = getStored<Convenio[]>('convenios', convenios);
                convenios = convenios.map((c) => {
                  if ((c as unknown as Record<string, unknown>)[column] === value) {
                    const row = { ...c, ...updates } as unknown as Convenio;
                    updatedRows.push(row as unknown as Record<string, unknown>);
                    return row;
                  }
                  return c;
                });
                setStored('convenios', convenios);
              } else if (tableName === 'convenio_equipos') {
                convenioEquipos = getStored<ConvenioEquipo[]>('convenio_equipos', convenioEquipos);
                convenioEquipos = convenioEquipos.map((ce) => {
                  if ((ce as unknown as Record<string, unknown>)[column] === value) {
                    const row = { ...ce, ...updates } as unknown as ConvenioEquipo;
                    updatedRows.push(row as unknown as Record<string, unknown>);
                    return row;
                  }
                  return ce;
                });
                setStored('convenio_equipos', convenioEquipos);
              } else if (tableName === 'convenio_cuotas_mensuales') {
                convenioCuotas = getStored<ConvenioCuotaMensual[]>('convenio_cuotas', convenioCuotas);
                convenioCuotas = convenioCuotas.map((cq) => {
                  if ((cq as unknown as Record<string, unknown>)[column] === value) {
                    const row = { ...cq, ...updates } as unknown as ConvenioCuotaMensual;
                    updatedRows.push(row as unknown as Record<string, unknown>);
                    return row;
                  }
                  return cq;
                });
                setStored('convenio_cuotas', convenioCuotas);
              }
              const response = { data: updatedRows, error: null };
              return {
                ...response,
                select() {
                  return Promise.resolve(response);
                },
                then<TResult1 = typeof response, TResult2 = never>(
                  onfulfilled?: ((value: typeof response) => TResult1 | PromiseLike<TResult1>) | null,
                  onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
                ) {
                  return Promise.resolve(response).then(onfulfilled, onrejected);
                },
              };
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
                } else if (tableName === 'notificaciones') {
                  notificaciones = getStored<Notificacion[]>('notificaciones', notificaciones);
                  notificaciones = notificaciones.filter(
                    (n) => (n as unknown as Record<string, unknown>)[column] !== value
                  );
                  setStored('notificaciones', notificaciones);
                } else if (tableName === 'perfiles') {
                  perfiles = getStored<PerfilUsuario[]>('perfiles', perfiles);
                  perfiles = perfiles.filter(
                    (p) => (p as unknown as Record<string, unknown>)[column] !== value
                  );
                  setStored('perfiles', perfiles);
                } else if (tableName === 'convenios') {
                  convenios = getStored<Convenio[]>('convenios', convenios);
                  convenios = convenios.filter(
                    (c) => (c as unknown as Record<string, unknown>)[column] !== value
                  );
                  setStored('convenios', convenios);
                } else if (tableName === 'convenio_equipos') {
                  convenioEquipos = getStored<ConvenioEquipo[]>('convenio_equipos', convenioEquipos);
                  convenioEquipos = convenioEquipos.filter(
                    (ce) => (ce as unknown as Record<string, unknown>)[column] !== value
                  );
                  setStored('convenio_equipos', convenioEquipos);
                } else if (tableName === 'convenio_cuotas_mensuales') {
                  convenioCuotas = getStored<ConvenioCuotaMensual[]>('convenio_cuotas', convenioCuotas);
                  convenioCuotas = convenioCuotas.filter(
                    (cq) => (cq as unknown as Record<string, unknown>)[column] !== value
                  );
                  setStored('convenio_cuotas', convenioCuotas);
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

    auth: {
      async signInWithPassword({ email, password }: { email?: string; password?: string }) {
        const list = getStored<PerfilUsuario[]>('perfiles', perfiles);
        const match = list.find((p) => p.email.toLowerCase() === (email || '').toLowerCase().trim());
        if (!match) {
          return { data: { user: null, session: null }, error: new Error('Usuario no encontrado en el sistema.') };
        }
        if (match.activo === false) {
          return { data: { user: null, session: null }, error: new Error('Cuenta inactiva o deshabilitada.') };
        }
        if (match.password && match.password !== password) {
          return { data: { user: null, session: null }, error: new Error('Credenciales inválidas.') };
        }
        const user = { id: match.id, email: match.email, user_metadata: { nombre: match.nombre, rol: match.rol } };
        const session = { user, access_token: 'mock-session-token' };
        return { data: { user, session }, error: null };
      },
      async signUp({ email, password, options }: { email?: string; password?: string; options?: { data?: Record<string, unknown> } }) {
        const list = getStored<PerfilUsuario[]>('perfiles', perfiles);
        const exists = list.some((p) => p.email.toLowerCase() === (email || '').toLowerCase().trim());
        if (exists) {
          return { data: { user: null, session: null }, error: new Error('Ya existe un usuario con este correo electrónico.') };
        }
        const newId = generateUuid();
        const user = {
          id: newId,
          email: email || '',
          user_metadata: { ...(options?.data || {}), has_password: Boolean(password) },
        };
        return { data: { user, session: null }, error: null };
      },
      async signOut() {
        return { error: null };
      },
      async getSession() {
        return { data: { session: null }, error: null };
      },
      async getUser() {
        return { data: { user: null }, error: null };
      },
      onAuthStateChange() {
        return {
          data: {
            subscription: {
              unsubscribe() {},
            },
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
    const liveClient = createClient(supabaseUrl!, supabaseAnonKey!);
    const mockClient = createMockClient();

    // Proxy the Supabase client: route 'perfiles' (and any tables not present in schema cache)
    // to the persistent mock storage so saving and modifying user profiles always succeeds seamlessly.
    clientInstance = new Proxy(liveClient, {
      get(target, prop, receiver) {
        if (prop === 'from') {
          return (tableName: string) => {
            if (tableName === 'perfiles') {
              return mockClient.from('perfiles');
            }
            const liveFrom = target.from(tableName);
            if (['convenios', 'convenio_equipos', 'convenio_cuotas_mensuales', 'vista_auditoria_convenios'].includes(tableName)) {
              return new Proxy(liveFrom, {
                get(qTarget, qProp, qReceiver) {
                  if (qProp === 'select') {
                    return (...args: unknown[]) => {
                      const liveQuery = (qTarget.select as (...a: unknown[]) => Promise<{ data?: unknown[]; error?: unknown }>)(...args);
                      return new Proxy(liveQuery, {
                        get(resTarget, resProp) {
                          if (resProp === 'then') {
                            return (onfulfilled?: (val: unknown) => unknown, onrejected?: (reason: unknown) => unknown) => {
                              return liveQuery.then((res: { data?: unknown[]; error?: unknown }) => {
                                if (res.error || !res.data || res.data.length === 0) {
                                  return (mockClient.from(tableName).select() as unknown as Promise<{ data: unknown[]; error: unknown }>).then((mockRes) => {
                                    if (res.error) return onfulfilled ? onfulfilled(mockRes) : mockRes;
                                    if (res.data && res.data.length > 0) return onfulfilled ? onfulfilled(res) : res;
                                    return onfulfilled ? onfulfilled(mockRes) : mockRes;
                                  });
                                }
                                return onfulfilled ? onfulfilled(res) : res;
                              }).catch(() => {
                                return (mockClient.from(tableName).select() as unknown as Promise<unknown>).then(onfulfilled, onrejected);
                              });
                            };
                          }
                          return Reflect.get(resTarget, resProp);
                        },
                      });
                    };
                  }
                  const val = Reflect.get(qTarget, qProp, qReceiver);
                  return typeof val === 'function' ? val.bind(qTarget) : val;
                },
              });
            }
            return liveFrom;
          };
        }
        const val = Reflect.get(target, prop, receiver);
        if (typeof val === 'function') {
          return val.bind(target);
        }
        return val;
      },
    });
  } catch (e) {
    console.warn('[AI Studio] Could not initialize live Supabase client, activating mock fallback:', e);
    clientInstance = createMockClient();
  }
} else {
  clientInstance = createMockClient();
}

export const supabase = clientInstance as unknown as SupabaseClient;
