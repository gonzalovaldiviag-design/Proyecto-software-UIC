/**
 * Utilidad de Exportación a Excel / CSV para UEM1.3
 * Genera archivos CSV compatibles con Microsoft Excel en español:
 * - Prefijo BOM UTF-8 (\uFEFF) para preservar tildes y caracteres especiales.
 * - Delimitador ';' (punto y coma) para apertura directa en columnas sin desfasar datos.
 * - Formato ISO de fecha en el nombre del archivo descargado.
 */

export interface ExportColumn<T> {
  header: string;
  accessor: (item: T) => string | number | boolean | null | undefined;
}

export function exportarACSV<T>(
  itemsFiltrados: T[],
  columnas: ExportColumn<T>[],
  nombreBaseArchivo: string
): boolean {
  if (!itemsFiltrados || itemsFiltrados.length === 0) {
    return false;
  }

  // Fecha actual en formato YYYY-MM-DD
  const fechaHoy = new Date().toISOString().split('T')[0];
  const nombreArchivo = `${nombreBaseArchivo}_${fechaHoy}.csv`;

  // Sanitizador de celdas para CSV con delimitador ';'
  const escaparValor = (valor: string | number | boolean | null | undefined): string => {
    if (valor === null || valor === undefined) return '';
    const texto = String(valor).trim();
    // Si contiene delimitador, comillas o saltos de línea, envolver en comillas dobles y duplicar comillas internas
    if (texto.includes(';') || texto.includes('"') || texto.includes('\n') || texto.includes('\r')) {
      return `"${texto.replace(/"/g, '""')}"`;
    }
    return texto;
  };

  // 1. Fila de encabezados
  const filaEncabezados = columnas.map((col) => escaparValor(col.header)).join(';');

  // 2. Filas de datos
  const filasDatos = itemsFiltrados.map((item) => {
    return columnas.map((col) => escaparValor(col.accessor(item))).join(';');
  });

  // 3. Contenido con BOM UTF-8 (\uFEFF) para que Microsoft Excel en Windows abra con tildes y formato directo
  const csvContent = '\uFEFF' + [filaEncabezados, ...filasDatos].join('\r\n');

  // 4. Disparador de descarga en el navegador
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', nombreArchivo);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return true;
}
