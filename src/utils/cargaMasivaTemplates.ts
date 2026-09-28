/**
 * Definiciones de Plantillas Oficiales de Carga Masiva y Generador CSV para UEM1.3
 */

export interface PlantillaConfig {
  id: 'equipos' | 'convenios' | 'mantenimientos';
  titulo: string;
  nombreArchivo: string;
  descripcion: string;
  headers: string[];
  headersLabels: Record<string, string>;
  obligatorios: string[];
  ejemplos: Record<string, string>[];
}

export const PLANTILLAS_CARGA: Record<'equipos' | 'convenios' | 'mantenimientos', PlantillaConfig> = {
  equipos: {
    id: 'equipos',
    titulo: 'Paso 1: Catastro de Equipos (Entidad Base Obligatoria)',
    nombreArchivo: 'Plantilla_Oficial_UEM1.3_Equipos.csv',
    descripcion: 'Entidad raíz indispensable. Todos los convenios y mantenimientos futuros dependen de que los equipos estén previamente catastrados.',
    headers: [
      'codigo',
      'nombre',
      'marca',
      'modelo',
      'serie',
      'ubicacion',
      'estado',
      'inventario',
      'anio_adquisicion',
      'orden_compra',
      'acta_entrega',
      'vida_util',
      'vida_util_residual',
      'modalidad_adquisicion',
    ],
    headersLabels: {
      codigo: 'Código UEM (Ej: EQ-101) [Clave Única]',
      nombre: 'Nombre / Tipo de Equipo',
      marca: 'Marca Fabricante',
      modelo: 'Modelo',
      serie: 'Número de Serie de Fábrica',
      ubicacion: 'Servicio Clínico / Recinto',
      estado: 'Estado (Operativo / Mantenimiento / Dado de baja)',
      inventario: 'N° Folio Inventario Institucional',
      anio_adquisicion: 'Año Adquisición (Ej: 2024)',
      orden_compra: 'Orden de Compra Inicial',
      acta_entrega: 'Acta de Entrega Inicial',
      vida_util: 'Vida Útil Estimada (Años)',
      vida_util_residual: 'Vida Útil Residual (Años)',
      modalidad_adquisicion: 'Modalidad (Propio / Arriendo / Comodato)',
    },
    obligatorios: ['codigo', 'nombre', 'serie', 'ubicacion', 'estado'],
    ejemplos: [
      {
        codigo: 'EQ-011',
        nombre: 'Electrocardiógrafo 12 Canales',
        marca: 'Mortara',
        modelo: 'ELI 280',
        serie: 'SN-MO-8812',
        ubicacion: 'Emergencias',
        estado: 'Operativo',
        inventario: 'INV-2025-055',
        anio_adquisicion: '2024',
        orden_compra: 'OC-2024-712',
        acta_entrega: 'AE-2024-311',
        vida_util: '8',
        vida_util_residual: '6',
        modalidad_adquisicion: 'Propio',
      },
      {
        codigo: 'EQ-012',
        nombre: 'Bomba de Infusión Volumétrica',
        marca: 'B. Braun',
        modelo: 'Infusomat Space',
        serie: 'SN-BB-4421',
        ubicacion: 'Pabellón Quirúrgico',
        estado: 'Operativo',
        inventario: 'INV-2025-056',
        anio_adquisicion: '2023',
        orden_compra: 'OC-2023-440',
        acta_entrega: 'AE-2023-112',
        vida_util: '10',
        vida_util_residual: '7',
        modalidad_adquisicion: 'Comodato',
      },
    ],
  },
  convenios: {
    id: 'convenios',
    titulo: 'Paso 2: Convenios Marco y Cuotas Mensuales',
    nombreArchivo: 'Plantilla_Oficial_UEM1.3_Convenios_Cuotas.csv',
    descripcion: 'Registra contratos de arriendo, comodato o garantía, vincula los equipos amparados (que deben existir en el Catastro) y pre-carga la matriz UIC de pagos.',
    headers: [
      'codigo_convenio',
      'nombre_convenio',
      'empresa_proveedor',
      'rut_empresa',
      'tipo_convenio',
      'fecha_inicio',
      'fecha_termino',
      'monto_total_comprometido',
      'codigo_equipo_asociado',
      'numero_guia',
      'fecha_guia',
      'codigo_mi_ssvq',
      'mes',
      'anio',
      'cuota',
      'valor_cuota_clp',
      'estado_uic',
      'orden_compra',
      'fecha_oc',
      'estado_mercado_publico',
      'numero_factura',
      'fecha_factura',
    ],
    headersLabels: {
      codigo_convenio: 'Código Convenio (Ej: CONV-2026-010) [Clave Única]',
      nombre_convenio: 'Nombre / Objeto de la Licitación o Contrato',
      empresa_proveedor: 'Razón Social Proveedor / Empresa',
      rut_empresa: 'RUT Empresa Proveedora',
      tipo_convenio: 'Tipo (Arriendo / Comodato / Garantía / Mantenimiento)',
      fecha_inicio: 'Fecha Inicio (AAAA-MM-DD)',
      fecha_termino: 'Fecha Término (AAAA-MM-DD)',
      monto_total_comprometido: 'Monto Total Contrato ($ CLP)',
      codigo_equipo_asociado: 'Código Equipo a Amparar (Debe existir en Catastro)',
      numero_guia: 'N° Guía Despacho (Planilla UIC)',
      fecha_guia: 'Fecha Guía (AAAA-MM-DD)',
      codigo_mi_ssvq: 'Código MI SSVQ',
      mes: 'Mes Cuota (Ej: Agosto)',
      anio: 'Año Cuota (Ej: 2026)',
      cuota: 'N° Cuota / Total (Ej: 8/24)',
      valor_cuota_clp: 'Valor Mensual Cuota ($ CLP)',
      estado_uic: 'Estado UIC (Facturado Conforme / Pendiente de OC / En Trámite)',
      orden_compra: 'Orden de Compra Mercado Público',
      fecha_oc: 'Fecha OC (AAAA-MM-DD)',
      estado_mercado_publico: 'Estado Mercado Público',
      numero_factura: 'N° Factura Comercial',
      fecha_factura: 'Fecha Factura (AAAA-MM-DD)',
    },
    obligatorios: [
      'codigo_convenio',
      'nombre_convenio',
      'empresa_proveedor',
      'tipo_convenio',
      'fecha_inicio',
      'fecha_termino',
      'monto_total_comprometido',
      'codigo_equipo_asociado',
      'mes',
      'anio',
      'cuota',
      'valor_cuota_clp',
    ],
    ejemplos: [
      {
        codigo_convenio: 'CONV-2026-010',
        nombre_convenio: 'Arriendo Integral de Bombas de Infusión',
        empresa_proveedor: 'B. Braun Medical SpA',
        rut_empresa: '76.442.110-3',
        tipo_convenio: 'Arriendo',
        fecha_inicio: '2026-01-01',
        fecha_termino: '2027-12-31',
        monto_total_comprometido: '24000000',
        codigo_equipo_asociado: 'EQ-001',
        numero_guia: 'G-11501',
        fecha_guia: '2026-08-01',
        codigo_mi_ssvq: 'MI-SSVQ-2026-012',
        mes: 'Agosto',
        anio: '2026',
        cuota: '8/24',
        valor_cuota_clp: '1000000',
        estado_uic: 'Facturado Conforme',
        orden_compra: '2398-440-CM26',
        fecha_oc: '2026-08-05',
        estado_mercado_publico: 'Recepcionado Conforme',
        numero_factura: 'F-10299',
        fecha_factura: '2026-08-10',
      },
      {
        codigo_convenio: 'CONV-2026-011',
        nombre_convenio: 'Comodato de Equipos de Monitoreo Pediátrico',
        empresa_proveedor: 'Mindray Medical Chile',
        rut_empresa: '77.550.990-1',
        tipo_convenio: 'Comodato',
        fecha_inicio: '2026-03-01',
        fecha_termino: '2027-03-01',
        monto_total_comprometido: '12000000',
        codigo_equipo_asociado: 'EQ-003',
        numero_guia: 'G-11502',
        fecha_guia: '2026-08-02',
        codigo_mi_ssvq: 'MI-SSVQ-2026-013',
        mes: 'Agosto',
        anio: '2026',
        cuota: '6/12',
        valor_cuota_clp: '1000000',
        estado_uic: 'Pendiente de OC',
        orden_compra: '2398-441-CM26',
        fecha_oc: '2026-08-06',
        estado_mercado_publico: 'Pendiente OC',
        numero_factura: '',
        fecha_factura: '',
      },
    ],
  },
  mantenimientos: {
    id: 'mantenimientos',
    titulo: 'Paso 3: Historial de Mantenimientos y Órdenes de Trabajo (OTs)',
    nombreArchivo: 'Plantilla_Oficial_UEM1.3_Mantenimientos.csv',
    descripcion: 'Importa órdenes de trabajo preventivas y correctivas históricas. Requiere que el código del equipo exista previamente en el Catastro.',
    headers: [
      'codigo_ot',
      'codigo_equipo',
      'problema_reportado',
      'solicitado_por',
      'asignado_a',
      'fecha_requerimiento',
      'tipo_mantenimiento',
      'estado_mantenimiento',
      'descripcion_trabajo',
      'fecha_cierre',
      'horas_hombre',
      'costo_repuestos',
    ],
    headersLabels: {
      codigo_ot: 'Código OT (Ej: MANT-050) [Clave Única]',
      codigo_equipo: 'Código Equipo (Debe existir en Catastro)',
      problema_reportado: 'Motivo de Falla o Requerimiento',
      solicitado_por: 'Nombre Solicitante / Clínico',
      asignado_a: 'Técnico o Empresa Asignada',
      fecha_requerimiento: 'Fecha Solicitud (AAAA-MM-DD)',
      tipo_mantenimiento: 'Tipo (Preventivo / Correctivo)',
      estado_mantenimiento: 'Estado (Pendiente de Asignación / En proceso / Completado)',
      descripcion_trabajo: 'Trabajo Realizado / Diagnóstico',
      fecha_cierre: 'Fecha de Cierre (AAAA-MM-DD)',
      horas_hombre: 'Horas Hombre Invertidas',
      costo_repuestos: 'Costo Total Repuestos ($ CLP)',
    },
    obligatorios: [
      'codigo_ot',
      'codigo_equipo',
      'problema_reportado',
      'solicitado_por',
      'fecha_requerimiento',
      'tipo_mantenimiento',
      'estado_mantenimiento',
    ],
    ejemplos: [
      {
        codigo_ot: 'MANT-050',
        codigo_equipo: 'EQ-001',
        problema_reportado: 'Mantenimiento preventivo semestral pauta institucional',
        solicitado_por: 'Enf. Patricia Morales',
        asignado_a: 'Téc. Fernando Ruiz',
        fecha_requerimiento: '2026-08-15',
        tipo_mantenimiento: 'Preventivo',
        estado_mantenimiento: 'Completado',
        descripcion_trabajo: 'Limpieza técnica, calibración de sensores de flujo y test de seguridad eléctrica IEC 62353',
        fecha_cierre: '2026-08-16',
        horas_hombre: '3.0',
        costo_repuestos: '55000',
      },
      {
        codigo_ot: 'MANT-051',
        codigo_equipo: 'EQ-005',
        problema_reportado: 'Falla en descarga de palas externas y código de error 404',
        solicitado_por: 'Dr. Roberto Soto',
        asignado_a: 'Téc. Fernando Ruiz',
        fecha_requerimiento: '2026-09-02',
        tipo_mantenimiento: 'Correctivo',
        estado_mantenimiento: 'En proceso',
        descripcion_trabajo: 'Revisión en taller biomédico, en espera de reemplazo de batería interna',
        fecha_cierre: '',
        horas_hombre: '1.5',
        costo_repuestos: '0',
      },
    ],
  },
};

/**
 * Genera y descarga el archivo CSV con BOM UTF-8 y delimitador ';'
 */
export function descargarPlantillaCSV(pasoId: 'equipos' | 'convenios' | 'mantenimientos'): boolean {
  const config = PLANTILLAS_CARGA[pasoId];
  if (!config) return false;

  const escapar = (val: string): string => {
    if (!val) return '';
    const clean = String(val).trim();
    if (clean.includes(';') || clean.includes('"') || clean.includes('\n') || clean.includes('\r')) {
      return `"${clean.replace(/"/g, '""')}"`;
    }
    return clean;
  };

  const filaEncabezados = config.headers.map(escapar).join(';');

  const filasEjemplos = config.ejemplos.map((ej) => {
    return config.headers.map((h) => escapar(ej[h] || '')).join(';');
  });

  const csvContent = '\uFEFF' + [filaEncabezados, ...filasEjemplos].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', config.nombreArchivo);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return true;
}
