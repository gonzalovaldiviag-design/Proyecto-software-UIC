import { Package, CheckCircle2, Wrench } from 'lucide-react';

interface DashboardProps {
  total: number;
  operativos: number;
  mantenimiento: number;
  selectedEstado?: string;
  onSelectEstado?: (estado: string) => void;
}

export default function Dashboard({
  total,
  operativos,
  mantenimiento,
  selectedEstado = 'Todos',
  onSelectEstado,
}: DashboardProps) {
  const cards = [
    {
      id: 'stat-card-total',
      filterKey: 'Todos',
      label: 'Total de Equipos',
      value: total,
      icon: Package,
      accent: 'bg-slate-900',
      ring: 'ring-slate-200/80',
      text: 'text-slate-900',
      sub: 'text-slate-500',
      activeRing: 'ring-2 ring-slate-900 bg-slate-50/80',
    },
    {
      id: 'stat-card-operativos',
      filterKey: 'Operativo',
      label: 'Equipos Operativos',
      value: operativos,
      icon: CheckCircle2,
      accent: 'bg-emerald-600',
      ring: 'ring-emerald-200/70',
      text: 'text-emerald-700',
      sub: 'text-emerald-600',
      activeRing: 'ring-2 ring-emerald-600 bg-emerald-50/70',
    },
    {
      id: 'stat-card-mantenimiento',
      filterKey: 'Mantenimiento',
      label: 'Equipos en Mantenimiento',
      value: mantenimiento,
      icon: Wrench,
      accent: 'bg-amber-500',
      ring: 'ring-amber-200/70',
      text: 'text-amber-700',
      sub: 'text-amber-600',
      activeRing: 'ring-2 ring-amber-500 bg-amber-50/70',
    },
  ];

  return (
    <div id="dashboard-stats-grid" className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => {
        const Icon = c.icon;
        const pct = total > 0 ? Math.round((c.value / total) * 100) : 0;
        const isSelected =
          selectedEstado === c.filterKey ||
          (c.filterKey === 'Mantenimiento' && (selectedEstado === 'En Mantenimiento' || selectedEstado === 'Mantenimiento'));

        const handleClick = () => {
          if (!onSelectEstado) return;
          if (isSelected && c.filterKey !== 'Todos') {
            onSelectEstado('Todos');
          } else {
            onSelectEstado(c.filterKey);
          }
        };

        return (
          <div
            id={c.id}
            key={c.filterKey}
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }}
            aria-pressed={isSelected}
            title={`Filtrar listado por: ${c.label}`}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-xl p-4 text-left shadow-sm transition-all duration-200 cursor-pointer select-none hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isSelected
                ? `${c.activeRing} shadow-md`
                : `bg-white ring-1 ${c.ring} hover:ring-slate-300`
            }`}
          >
            <div className="flex items-start justify-between w-full">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-slate-500 truncate">{c.label}</p>
                  {isSelected && (
                    <span className="inline-flex items-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none">
                      Activo
                    </span>
                  )}
                </div>
                <p className={`mt-1 text-2xl sm:text-3xl font-bold tracking-tight ${c.text}`}>
                  {c.value}
                </p>
                <p className={`mt-0.5 text-xs font-medium ${c.sub}`}>
                  {total > 0 ? `${pct}% del total` : 'Sin datos'}
                </p>
              </div>
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${c.accent} text-white shadow-sm transition-transform duration-200 group-hover:scale-110`}
              >
                <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
              </div>
            </div>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${c.accent} transition-all duration-500 ease-out`}
                style={{ width: `${total > 0 ? pct : 0}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
