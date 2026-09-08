import type { EstadoEquipo } from '@/lib/supabase';

const styles: Record<EstadoEquipo, { dot: string; badge: string; label: string }> = {
  Operativo: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    label: 'Operativo',
  },
  Mantenimiento: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    label: 'Mantenimiento',
  },
  'Dado de baja': {
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    label: 'Dado de baja',
  },
};

export default function EstadoBadge({ estado }: { estado: EstadoEquipo }) {
  const s = styles[estado];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${s.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
