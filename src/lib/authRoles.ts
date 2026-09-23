import type { RolUsuario } from './supabase';

export interface RolSimulableConfig {
  rol: RolUsuario;
  label: string;
  descripcion: string;
}

export const ROLES_SIMULABLES: RolSimulableConfig[] = [
  {
    rol: 'Ingeniero Supervisor',
    label: 'Ingeniero Supervisor',
    descripcion: 'Asignación técnica, cierre/emisión de informes y avance de compras.',
  },
  {
    rol: 'Ingeniero de Servicio / Técnico',
    label: 'Ingeniero de Servicio / Técnico',
    descripcion: 'Atención y resolución de OTs asignadas con emisión de informe técnico.',
  },
  {
    rol: 'Clínico / Solicitante',
    label: 'Clínico / Solicitante',
    descripcion: 'Filtro exclusivo por Servicio Clínico asignado y reporte de fallas.',
  },
  {
    rol: 'Auditor / Directivo',
    label: 'Auditor',
    descripcion: 'Acceso en modo Solo Lectura y exportación/impresión de informes.',
  },
];
