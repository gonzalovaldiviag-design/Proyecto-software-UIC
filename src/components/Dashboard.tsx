import { Package, CheckCircle2, Wrench } from 'lucide-react';

interface DashboardProps {
  total: number;
  operativos: number;
  mantenimiento: number;
}

export default function Dashboard({ total, operativos, mantenimiento }: DashboardProps) {
  const cards = [
    {
      label: 'Total de Equipos',
      value: total,
      icon: Package,
      accent: 'bg-slate-900',
      ring: 'ring-slate-200',
      text: 'text-slate-900',
      sub: 'text-slate-500',
    },
    {
      label: 'Equipos Operativos',
      value: operativos,
      icon: CheckCircle2,
      accent: 'bg-emerald-600',
      ring: 'ring-emerald-100',
      text: 'text-emerald-700',
      sub: 'text-emerald-600',
    },
    {
      label: 'Equipos en Mantenimiento',
      value: mantenimiento,
      icon: Wrench,
      accent: 'bg-amber-500',
      ring: 'ring-amber-100',
      text: 'text-amber-700',
      sub: 'text-amber-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => {
        const Icon = c.icon;
        const pct = total > 0 ? Math.round((c.value / total) * 100) : 0;
        return (
          <div
            key={c.label}
            className={`group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ${c.ring} transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{c.label}</p>
                <p className={`mt-2 text-4xl font-bold tracking-tight ${c.text}`}>
                  {c.value}
                </p>
                <p className={`mt-1 text-xs font-medium ${c.sub}`}>
                  {total > 0 ? `${pct}% del total` : 'Sin datos'}
                </p>
              </div>
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.accent} text-white shadow-sm transition-transform duration-300 group-hover:scale-110`}
              >
                <Icon className="h-6 w-6" strokeWidth={2} />
              </div>
            </div>
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${c.accent} transition-all duration-700 ease-out`}
                style={{ width: `${total > 0 ? pct : 0}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
