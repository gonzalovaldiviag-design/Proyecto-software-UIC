import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from 'lucide-react';

export interface ColumnSortState {
  key: string;
  direction: 'asc' | 'desc';
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface TableColumnHeaderProps {
  id?: string;
  title: string;
  sortKey?: string;
  currentSort?: ColumnSortState | null;
  onSort?: (key: string) => void;
  filterType?: 'text' | 'select' | 'none';
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  selectOptions?: (string | SelectOption)[];
  placeholder?: string;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

export default function TableColumnHeader({
  id,
  title,
  sortKey,
  currentSort,
  onSort,
  filterType = 'none',
  filterValue = '',
  onFilterChange,
  selectOptions = [],
  placeholder = 'Filtrar...',
  className = '',
  align = 'left',
}: TableColumnHeaderProps) {
  const isSorted = currentSort && sortKey && currentSort.key === sortKey;
  const isFilterActive = Boolean(
    filterValue &&
      filterValue.trim() !== '' &&
      filterValue.toLowerCase() !== 'todos' &&
      filterValue.toLowerCase() !== 'todas'
  );

  const handleTitleClick = () => {
    if (sortKey && onSort) {
      onSort(sortKey);
    }
  };

  const normalizedOptions: SelectOption[] = selectOptions.map((opt) =>
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const alignClass =
    align === 'right'
      ? 'justify-end text-right'
      : align === 'center'
      ? 'justify-center text-center'
      : 'justify-start text-left';

  return (
    <th
      id={id}
      className={`px-3.5 py-2.5 text-xs font-semibold transition-colors select-none ${
        isFilterActive
          ? 'bg-blue-50/90 text-blue-950 border-b-2 border-b-blue-600'
          : 'bg-slate-50/80 text-slate-700 border-b border-slate-200'
      } ${className}`}
    >
      <div className="flex flex-col gap-1.5">
        {/* Fila del Título y Disparador de Ordenamiento */}
        <div className={`flex items-center gap-1.5 ${alignClass}`}>
          {sortKey && onSort ? (
            <button
              type="button"
              onClick={handleTitleClick}
              className="group inline-flex items-center gap-1 hover:text-blue-600 focus:outline-none transition-colors cursor-pointer"
              title={`Ordenar por ${title} (${
                isSorted ? (currentSort?.direction === 'asc' ? 'Descendente' : 'Ascendente') : 'Ascendente'
              })`}
            >
              <span className="uppercase tracking-wider text-[11px] font-bold">{title}</span>
              <span className="inline-flex items-center justify-center">
                {isSorted ? (
                  currentSort?.direction === 'asc' ? (
                    <ArrowUp className="h-3.5 w-3.5 text-blue-600 stroke-[2.5]" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5 text-blue-600 stroke-[2.5]" />
                  )
                ) : (
                  <ArrowUpDown className="h-3 w-3 text-slate-400 group-hover:text-slate-600 opacity-60 group-hover:opacity-100 transition-opacity" />
                )}
              </span>
            </button>
          ) : (
            <span className="uppercase tracking-wider text-[11px] font-bold text-slate-600">
              {title}
            </span>
          )}

          {isFilterActive && (
            <span
              title="Filtro activo en esta columna"
              className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-blue-600 text-white shadow-2xs text-[9px] font-bold"
            >
              <Filter className="h-2.5 w-2.5" />
            </span>
          )}
        </div>

        {/* Subfiltrado por Encabezado */}
        {filterType === 'text' && onFilterChange && (
          <div
            className="relative w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              value={filterValue}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder={placeholder}
              className={`w-full h-7 rounded-md border text-[11px] font-normal normal-case transition-all pl-2 pr-6 focus:outline-none focus:ring-1 ${
                isFilterActive
                  ? 'border-blue-400 bg-white text-blue-900 placeholder:text-blue-300 focus:border-blue-600 focus:ring-blue-500/30'
                  : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-blue-500/20'
              }`}
            />
            {filterValue && (
              <button
                type="button"
                onClick={() => onFilterChange('')}
                title="Limpiar filtro de esta columna"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {filterType === 'select' && onFilterChange && (
          <div
            className="relative w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <select
              value={filterValue}
              onChange={(e) => onFilterChange(e.target.value)}
              className={`w-full h-7 rounded-md border text-[11px] font-normal normal-case transition-all px-1.5 focus:outline-none focus:ring-1 cursor-pointer ${
                isFilterActive
                  ? 'border-blue-400 bg-white text-blue-900 font-semibold focus:border-blue-600 focus:ring-blue-500/30'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 focus:border-blue-500 focus:ring-blue-500/20'
              }`}
            >
              <option value="">(Todos)</option>
              {normalizedOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </th>
  );
}
