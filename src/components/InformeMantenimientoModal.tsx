import { useState, useEffect, useRef } from 'react';
import {
  X,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Activity,
  FileText,
  Image as ImageIcon,
  Download,
  Loader2,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  type Mantenimiento,
  type Equipo,
  generarNumeroInforme,
} from '@/lib/supabase';
import { getNombreArchivo } from '@/lib/fileUtils';
import { useAuth } from '@/lib/authContext';

export interface InformeMantenimientoModalProps {
  open: boolean;
  onClose: () => void;
  mantenimiento: Mantenimiento | null;
  equipo?: Equipo | null;
  equipos?: Equipo[];
  onReabrir?: (mantenimiento: Mantenimiento) => void;
}

export default function InformeMantenimientoModal({
  open,
  onClose,
  mantenimiento,
  equipo,
  equipos,
  onReabrir,
}: InformeMantenimientoModalProps) {
  const { puede } = useAuth();
  const reportRef = useRef<HTMLDivElement>(null);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mantenimiento) return null;

  // Resolver el equipo clínico asociado
  const eq = equipo || equipos?.find((e) => e.id === mantenimiento.equipo_id);

  // Extraer información de respaldo si no hay equipo en el inventario
  const parseEquipoInfo = () => {
    if (eq) {
      return {
        codigo: eq.codigo,
        nombre: eq.nombre,
        marca: eq.marca || '—',
        modelo: eq.modelo || '—',
        serie: eq.serie || '—',
        ubicacion: eq.ubicacion || '—',
      };
    }

    const partes = (mantenimiento?.equipo_identificacion || '').split('—');
    const codigo = (partes[0] || '').trim() || '—';
    const nombre = (partes[1] || '').trim() || mantenimiento?.equipo_identificacion || '—';

    return {
      codigo,
      nombre,
      marca: '—',
      modelo: '—',
      serie: '—',
      ubicacion: '—',
    };
  };

  const datosEquipo = parseEquipoInfo();

  const formatearFecha = (dateStr: string | null | undefined, incluirHora = false): string => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      if (incluirHora) {
        return d.toLocaleDateString('es-CL', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      return d.toLocaleDateString('es-CL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const correlativo =
    mantenimiento.numero_informe ||
    generarNumeroInforme(mantenimiento.codigo || 'MANT-001');

  const fechaEmision =
    mantenimiento.fecha_emision_informe ||
    mantenimiento.fecha_cierre ||
    mantenimiento.created_at;

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.warn('window.print no disponible:', e);
    }
  };

  const handleExportPDF = async () => {
    if (generandoPDF || !reportRef.current) return;
    setGenerandoPDF(true);
    setMensajeEstado(null);

    let staging: HTMLElement | null = null;

    try {
      const sourceReport = reportRef.current;

      // Esperamos a que las fuentes y recursos estén listos
      if (document.fonts) {
        await document.fonts.ready;
      }

      staging = document.createElement('div');
      staging.id = 'pdf-pages-staging';
      staging.style.position = 'fixed';
      staging.style.top = '-99999px';
      staging.style.left = '0';
      staging.style.width = '816px'; // Formato Carta (Letter) a 96 DPI: 215.9mm
      staging.style.backgroundColor = '#ffffff';
      staging.style.zIndex = '-9999';
      staging.style.opacity = '0';
      staging.style.pointerEvents = 'none';
      document.body.appendChild(staging);

      // Dimensiones exactas para formato Carta (Letter) a 96 DPI: 215.9mm x 279.4mm -> 816px x 1056px
      const PAGE_WIDTH_PX = 816;
      const PAGE_HEIGHT_PX = 1056;
      const PAD_TOP_PX = 57; // 15mm
      const PAD_BOTTOM_PX = 57; // 15mm
      const PAD_X_PX = 45; // 12mm

      // Obtenemos los bloques estructurales del reporte original
      const origHeader = sourceReport.querySelector('header');
      const allSections = Array.from(sourceReport.querySelectorAll<HTMLElement>('section'));

      // Identificamos cada sección semántica
      const secEquipo = allSections.find((s) => s.textContent?.includes('1. Datos del Equipo Clínico'));
      const secAntecedentes = allSections.find((s) => s.textContent?.includes('2. Antecedentes del Servicio'));
      const secIntervencion = allSections.find((s) => s.textContent?.includes('3. Intervención Técnica'));
      const secRecursos = allSections.find((s) => s.textContent?.includes('4. Recursos Empleados'));
      const secEvidencia = allSections.find((s) => s.textContent?.includes('5. Evidencia Fotográfica'));
      const secFirmas = allSections.find((s) => s.textContent?.includes('Conformidad') || s.textContent?.includes('Firmas'));

      interface PageRecord {
        pageEl: HTMLElement;
        headerEl: HTMLElement;
        contentEl: HTMLElement;
        footerEl: HTMLElement;
        pageNumEl: HTMLElement;
        getUsableHeight: () => number;
      }

      const pages: PageRecord[] = [];

      const createNewPage = (pageNum: number): PageRecord => {
        const pageEl = document.createElement('div');
        pageEl.className = 'pdf-page-container bg-white text-slate-900';
        pageEl.style.width = `${PAGE_WIDTH_PX}px`;
        pageEl.style.height = `${PAGE_HEIGHT_PX}px`;
        pageEl.style.minHeight = `${PAGE_HEIGHT_PX}px`;
        pageEl.style.maxHeight = `${PAGE_HEIGHT_PX}px`;
        pageEl.style.boxSizing = 'border-box';
        pageEl.style.padding = `${PAD_TOP_PX}px ${PAD_X_PX}px ${PAD_BOTTOM_PX}px ${PAD_X_PX}px`;
        pageEl.style.backgroundColor = '#ffffff';
        pageEl.style.position = 'relative';
        pageEl.style.overflow = 'hidden';
        pageEl.style.display = 'block';

        // Header institucional
        const headerEl = document.createElement('div');
        headerEl.className = 'pdf-page-header';
        headerEl.style.width = '100%';
        headerEl.style.marginBottom = '14px';
        headerEl.style.flexShrink = '0';

        if (pageNum === 1 && origHeader) {
          const hClone = origHeader.cloneNode(true) as HTMLElement;
          hClone.classList.remove('mb-6');
          hClone.classList.add('mb-0');
          headerEl.appendChild(hClone);
        } else {
          headerEl.innerHTML = `
            <div class="flex items-center justify-between pb-2 border-b-2 border-slate-900 text-xs">
              <div class="flex items-center gap-2 font-black text-slate-900 uppercase tracking-tight">
                <div class="flex h-6 w-6 items-center justify-center rounded bg-slate-900 text-white flex-shrink-0">
                  <svg class="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span>UNIDAD DE EQUIPOS MÉDICOS • INFORME TÉCNICO DE MANTENIMIENTO</span>
              </div>
              <div class="font-mono font-black text-slate-900 text-xs">
                N° ${correlativo}
              </div>
            </div>
          `;
        }
        pageEl.appendChild(headerEl);

        // Contenedor de contenido de tarjetas
        const contentEl = document.createElement('div');
        contentEl.className = 'pdf-page-body';
        contentEl.style.display = 'flex';
        contentEl.style.flexDirection = 'column';
        contentEl.style.gap = '14px';
        contentEl.style.width = '100%';
        pageEl.appendChild(contentEl);

        // Footer institucional anclado al pie de la página
        const footerEl = document.createElement('div');
        footerEl.className = 'pdf-page-footer';
        footerEl.style.position = 'absolute';
        footerEl.style.bottom = `${PAD_BOTTOM_PX}px`;
        footerEl.style.left = `${PAD_X_PX}px`;
        footerEl.style.right = `${PAD_X_PX}px`;
        footerEl.style.paddingTop = '8px';
        footerEl.style.borderTop = '1px solid #cbd5e1';
        footerEl.style.display = 'flex';
        footerEl.style.alignItems = 'center';
        footerEl.style.justifyContent = 'space-between';
        footerEl.style.fontSize = '10px';
        footerEl.style.color = '#64748b';
        footerEl.innerHTML = `
          <span>Documento oficial de trazabilidad • Registro: ${correlativo} • Emisión: ${formatearFecha(fechaEmision, false)}</span>
          <span class="pdf-page-num font-semibold text-slate-700">Página ${pageNum}</span>
        `;
        pageEl.appendChild(footerEl);

        const pageNumEl = footerEl.querySelector('.pdf-page-num') as HTMLElement;

        staging!.appendChild(pageEl);

        const getUsableHeight = () => {
          const headerH = headerEl.offsetHeight || (pageNum === 1 ? 130 : 38);
          // 1056 - 57(top) - headerH - 14(margin) - 36(footer + gap) - 57(bottom)
          return PAGE_HEIGHT_PX - PAD_TOP_PX - headerH - 14 - 36 - PAD_BOTTOM_PX;
        };

        return { pageEl, headerEl, contentEl, footerEl, pageNumEl, getUsableHeight };
      };

      let currentPage = createNewPage(1);
      pages.push(currentPage);

      // Función estricta que añade una tarjeta indivisible. Si no cabe en el espacio útil, la mueve a la siguiente página.
      const addCard = (card: HTMLElement) => {
        card.classList.remove('mb-6');
        card.classList.add('mb-0');
        card.style.flexShrink = '0';
        card.style.height = 'auto';
        card.style.maxHeight = 'none';
        card.style.minHeight = 'auto';
        card.style.overflow = 'visible';
        card.style.width = '100%';
        card.style.boxSizing = 'border-box';

        currentPage.contentEl.appendChild(card);

        const usableH = currentPage.getUsableHeight();
        const currentContentH = currentPage.contentEl.offsetHeight;

        // Si sobrepasa la altura útil de la hoja y no es el único elemento de la página, trasladar a página nueva
        if (currentContentH > usableH && currentPage.contentEl.children.length > 1) {
          currentPage.contentEl.removeChild(card);
          currentPage = createNewPage(pages.length + 1);
          pages.push(currentPage);
          currentPage.contentEl.appendChild(card);
        }
      };

      // 1. Sección 1: Datos del Equipo Clínico
      if (secEquipo) {
        addCard(secEquipo.cloneNode(true) as HTMLElement);
      }

      // 2. Sección 2: Antecedentes del Servicio
      if (secAntecedentes) {
        addCard(secAntecedentes.cloneNode(true) as HTMLElement);
      }

      // 3. Sección 3: Intervención Técnica (con partición limpia si no cabe en el espacio restante)
      if (secIntervencion) {
        const subblocks = Array.from(secIntervencion.querySelectorAll<HTMLElement>('.pdf-subblock'));

        // Probamos primero agregar la sección 3 completa como un solo bloque
        const cardIntervencionFull = secIntervencion.cloneNode(true) as HTMLElement;
        cardIntervencionFull.classList.remove('mb-6');
        cardIntervencionFull.classList.add('mb-0');
        cardIntervencionFull.style.flexShrink = '0';
        cardIntervencionFull.style.height = 'auto';
        cardIntervencionFull.style.maxHeight = 'none';
        cardIntervencionFull.style.minHeight = 'auto';
        cardIntervencionFull.style.overflow = 'visible';
        cardIntervencionFull.style.width = '100%';

        currentPage.contentEl.appendChild(cardIntervencionFull);

        const usableH = currentPage.getUsableHeight();
        const fitsFull = currentPage.contentEl.offsetHeight <= usableH;

        if (fitsFull) {
          // Cabe perfectamente entera en la página 1
        } else {
          // No cabe entera en el espacio restante de la página actual:
          currentPage.contentEl.removeChild(cardIntervencionFull);

          // Evaluamos si el Problema y la Descripción pueden caber en la página actual
          const cardIntervencionA = document.createElement('section');
          cardIntervencionA.className = 'rounded-lg border border-slate-300 overflow-hidden bg-white mb-0';
          cardIntervencionA.style.flexShrink = '0';
          cardIntervencionA.style.height = 'auto';
          cardIntervencionA.style.width = '100%';
          cardIntervencionA.innerHTML = `
            <div class="bg-slate-100 px-4 py-2 border-b border-slate-300 flex items-center justify-between">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800">
                3. Intervención Técnica
              </h3>
              <span class="text-[10px] font-semibold text-slate-500 uppercase">Motivo y Descripción</span>
            </div>
            <div class="p-4 space-y-4"></div>
          `;
          const bodyA = cardIntervencionA.querySelector('div.p-4')!;
          if (subblocks[0]) bodyA.appendChild(subblocks[0].cloneNode(true));
          if (subblocks[1]) bodyA.appendChild(subblocks[1].cloneNode(true));

          // Submódulo B: Diagnóstico Final y Pruebas (Siempre con su título formal y caja verde íntegra)
          const cardIntervencionB = document.createElement('section');
          cardIntervencionB.className = 'rounded-lg border border-slate-300 overflow-hidden bg-white mb-0';
          cardIntervencionB.style.flexShrink = '0';
          cardIntervencionB.style.height = 'auto';
          cardIntervencionB.style.width = '100%';
          cardIntervencionB.innerHTML = `
            <div class="bg-slate-100 px-4 py-2 border-b border-slate-300 flex items-center justify-between">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800">
                3. Intervención Técnica (Continuación)
              </h3>
              <span class="text-[10px] font-semibold text-slate-500 uppercase">Diagnóstico y Operatividad</span>
            </div>
            <div class="p-4 space-y-4"></div>
          `;
          const bodyB = cardIntervencionB.querySelector('div.p-4')!;
          if (subblocks[2]) bodyB.appendChild(subblocks[2].cloneNode(true));

          // Probamos si la parte A cabe en la página actual
          currentPage.contentEl.appendChild(cardIntervencionA);
          if (currentPage.contentEl.offsetHeight <= currentPage.getUsableHeight()) {
            // Parte A se queda en esta página, Parte B se añade (irá a la siguiente página limpiamente si no cabe)
            addCard(cardIntervencionB);
          } else {
            // Ni siquiera Parte A cabe en el espacio restante: trasladamos la sección 3 completa a la página siguiente
            currentPage.contentEl.removeChild(cardIntervencionA);
            currentPage = createNewPage(pages.length + 1);
            pages.push(currentPage);
            currentPage.contentEl.appendChild(cardIntervencionFull);
          }
        }
      }

      // 4. Sección 4: Recursos Empleados
      if (secRecursos) {
        addCard(secRecursos.cloneNode(true) as HTMLElement);
      }

      // 5. Sección 5: Evidencia Fotográfica (si existe)
      if (secEvidencia) {
        addCard(secEvidencia.cloneNode(true) as HTMLElement);
      }

      // 6. Sección 6: Conformidad y Firmas de Responsabilidad (INDIVISIBLE)
      if (secFirmas) {
        addCard(secFirmas.cloneNode(true) as HTMLElement);
      }

      // Actualizamos los números de página finales (Página X de Total)
      const totalPages = pages.length;
      pages.forEach((p, idx) => {
        p.pageNumEl.textContent = `Página ${idx + 1} de ${totalPages}`;
      });

      // Esperamos que todas las imágenes de las páginas carguen
      const allImgs = Array.from(staging.querySelectorAll('img'));
      if (allImgs.length > 0) {
        await Promise.all(
          allImgs.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          })
        );
      }

      // Renderizamos cada hoja Carta (Letter) individualmente en el PDF sin cortes
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter',
      });

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) {
          pdf.addPage();
        }

        const pageCanvas = await html2canvas(pages[i].pageEl, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: PAGE_WIDTH_PX,
          height: PAGE_HEIGHT_PX,
          windowWidth: 1200,
        });

        const imgData = pageCanvas.toDataURL('image/jpeg', 0.98);
        pdf.addImage(imgData, 'JPEG', 0, 0, 215.9, 279.4, undefined, 'FAST');
      }

      const nombreLimpio = correlativo.replace(/[^a-zA-Z0-9_-]/g, '_');
      const nombreArchivo = `Informe_Tecnico_${nombreLimpio}.pdf`;
      pdf.save(nombreArchivo);

      setMensajeEstado({
        tipo: 'exito',
        texto: `¡Informe técnico generado exitosamente! Se descargaron ${totalPages} páginas en formato Carta sin cortes ni solapamientos.`,
      });
      setTimeout(() => setMensajeEstado(null), 6000);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      try {
        window.print();
      } catch (printErr) {
        console.warn('Fallback print falló:', printErr);
      }
      setMensajeEstado({
        tipo: 'error',
        texto: 'Hubo un inconveniente al exportar el archivo PDF. Se activó el cuadro de impresión directa.',
      });
      setTimeout(() => setMensajeEstado(null), 5000);
    } finally {
      if (staging && staging.parentNode) {
        staging.parentNode.removeChild(staging);
      }
      setGenerandoPDF(false);
    }
  };

  return (
    <div
      id="informe-modal-wrapper"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 print-modal-overlay"
    >
      {/* Fondo oscuro - oculto al imprimir */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity print:hidden"
        onClick={onClose}
      />

      {/* Contenedor del Modal */}
      <div className="relative flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 print-modal-container print:max-h-none print:shadow-none print:ring-0">
        
        {/* Barra superior de acciones - oculta al imprimir */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-3.5 print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Informe Técnico de Mantenimiento
                </h2>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 font-mono text-xs font-semibold text-blue-800">
                  {correlativo}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Ficha técnica oficial imprimible y almacenable en formato PDF
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onReabrir && puede('reabrir_anular_ot') && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onReabrir(mantenimiento);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 active:scale-95"
                title="Reabrir orden de trabajo y anular cierre"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reabrir Orden</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={generandoPDF}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95 disabled:opacity-75 disabled:cursor-wait"
              title="Exportar y descargar Informe Técnico en PDF"
            >
              {generandoPDF ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generando PDF...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Exportar a PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
              title="Imprimir documento con diálogo del navegador"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600"
              aria-label="Cerrar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Notificación de estado de exportación */}
        {mensajeEstado && (
          <div
            className={`mx-6 mt-3 flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium print:hidden ${
              mensajeEstado.tipo === 'exito'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {mensajeEstado.tipo === 'exito' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            )}
            <span className="flex-1">{mensajeEstado.texto}</span>
            <button
              type="button"
              onClick={() => setMensajeEstado(null)}
              className="text-slate-400 hover:text-slate-600 font-bold ml-1"
            >
              ×
            </button>
          </div>
        )}

        {/* Cuerpo del Informe con scroll en pantalla, flujo completo al imprimir */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 print-modal-scroll print:p-0 print:overflow-visible">
          <div
            id="printable-report"
            ref={reportRef}
            className="mx-auto max-w-3xl bg-white p-6 sm:p-8 text-slate-900 print:max-w-none print:p-6"
          >
            {/* ENCABEZADO INSTITUCIONAL Y CORRELATIVO */}
            <header className="border-b-2 border-slate-900 pb-5 mb-6 pdf-block">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm flex-shrink-0">
                    <Activity className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
                      UNIDAD DE EQUIPOS MÉDICOS - INFORME TÉCNICO DE MANTENIMIENTO
                    </h1>
                    <p className="text-xs font-medium text-slate-600 mt-0.5">
                      Subdirección de Gestión de Tecnologías Médicas y Operaciones Clínicas
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Departamento de Ingeniería Biomédica • Sistema de Trazabilidad Clínica
                    </p>
                  </div>
                </div>

                {/* Cuadro superior derecho con el correlativo en grande y fecha de emisión */}
                <div className="border-2 border-slate-900 rounded-lg p-3 sm:text-right bg-slate-50 flex-shrink-0 min-w-[200px]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    INFORME TÉCNICO N°
                  </div>
                  <div className="text-xl sm:text-2xl font-mono font-black text-slate-900 tracking-tight">
                    {correlativo}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-600 border-t border-slate-200 pt-1">
                    <span className="font-semibold">Fecha emisión:</span>{' '}
                    {formatearFecha(fechaEmision, false)}
                  </div>
                </div>
              </div>
            </header>

            {/* SECCIÓN 1: DATOS DEL EQUIPO CLÍNICO */}
            <section
              className="mb-6 rounded-lg border border-slate-300 overflow-hidden break-inside-avoid print-avoid-break pdf-block"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  1. Datos del Equipo Clínico
                </h3>
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Inventario y Ubicación</span>
              </div>
              <div className="p-4 grid grid-cols-3 gap-3.5 text-xs" style={{ minHeight: 'auto' }}>
                <div style={{ minHeight: 'auto', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  <span className="block font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-0.5">Código / ID</span>
                  <span className="font-mono font-bold text-slate-900 text-sm block" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{datosEquipo.codigo}</span>
                </div>
                <div className="col-span-2" style={{ minHeight: 'auto', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  <span className="block font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-0.5">Nombre del Equipo</span>
                  <span className="font-bold text-slate-900 text-sm block" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{datosEquipo.nombre}</span>
                </div>
                <div style={{ minHeight: 'auto', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  <span className="block font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-0.5">Marca</span>
                  <span className="text-slate-800 font-medium block" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{datosEquipo.marca}</span>
                </div>
                <div style={{ minHeight: 'auto', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  <span className="block font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-0.5">Modelo</span>
                  <span className="text-slate-800 font-medium block" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{datosEquipo.modelo}</span>
                </div>
                <div style={{ minHeight: 'auto', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  <span className="block font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-0.5">N° de Serie</span>
                  <span className="font-mono text-slate-800 font-medium block" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{datosEquipo.serie}</span>
                </div>
                <div className="col-span-3 border-t border-slate-100 pt-2 flex items-center gap-2" style={{ minHeight: 'auto', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider flex-shrink-0">Servicio Clínico / Ubicación:</span>
                  <span className="font-bold text-slate-900" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{datosEquipo.ubicacion}</span>
                </div>
              </div>
            </section>

            {/* SECCIÓN 2: ANTECEDENTES DEL SERVICIO */}
            <section
              className="mb-6 rounded-lg border border-slate-300 overflow-hidden break-inside-avoid print-avoid-break pdf-block"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  2. Antecedentes del Servicio (Orden de Trabajo)
                </h3>
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Trazabilidad OT</span>
              </div>
              <div className="p-4 grid grid-cols-3 gap-3.5 text-xs" style={{ minHeight: 'auto' }}>
                <div style={{ minHeight: 'auto', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  <span className="block font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-0.5">Código OT</span>
                  <span className="font-mono font-bold text-slate-900 text-sm block" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{mantenimiento.codigo}</span>
                </div>
                <div style={{ minHeight: 'auto', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  <span className="block font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-0.5">Tipo de Mantenimiento</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-900" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                    <Wrench className="h-3 w-3 text-slate-500 flex-shrink-0" />
                    <span>{mantenimiento.tipo_mantenimiento}</span>
                  </span>
                </div>
                <div style={{ minHeight: 'auto', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  <span className="block font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-0.5">Estado de la Orden</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                    <span>{mantenimiento.estado_mantenimiento}</span>
                  </span>
                </div>
                <div style={{ minHeight: 'auto', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  <span className="block font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-0.5">Solicitado Por</span>
                  <span className="text-slate-800 font-medium block" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{mantenimiento.solicitado_por || '—'}</span>
                </div>
                <div style={{ minHeight: 'auto', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  <span className="block font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-0.5">Fecha Requerimiento</span>
                  <span className="text-slate-800 font-medium block" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{mantenimiento.fecha_requerimiento || '—'}</span>
                </div>
                <div style={{ minHeight: 'auto', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  <span className="block font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-0.5">Fecha Cierre Técnico</span>
                  <span className="text-slate-800 font-medium block" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{mantenimiento.fecha_cierre || '—'}</span>
                </div>
              </div>
            </section>

            {/* SECCIÓN 3: INTERVENCIÓN TÉCNICA */}
            <section
              className="mb-6 rounded-lg border border-slate-300 overflow-hidden break-inside-avoid print-avoid-break pdf-block"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-300">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  3. Intervención Técnica
                </h3>
              </div>
              <div className="p-4 space-y-4">
                {/* Problema Reportado */}
                <div className="pdf-subblock w-full" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                  <span className="block font-bold text-slate-700 uppercase text-[10px] tracking-wider mb-1">
                    Problema Reportado / Motivo del Requerimiento:
                  </span>
                  <div
                    className="w-full rounded bg-slate-50 border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed font-sans"
                    style={{ fontSize: '13px', padding: '8px 12px', overflowWrap: 'break-word', wordBreak: 'break-word' }}
                  >
                    {mantenimiento.problema_reportado || 'No se detalló problema.'}
                  </div>
                </div>

                {/* Descripción del Trabajo Realizado */}
                <div className="pdf-subblock w-full" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                  <span className="block font-bold text-slate-700 uppercase text-[10px] tracking-wider mb-1">
                    Descripción del Trabajo Realizado:
                  </span>
                  <div
                    className="w-full rounded bg-slate-50 border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed font-sans"
                    style={{ fontSize: '13px', padding: '8px 12px', overflowWrap: 'break-word', wordBreak: 'break-word' }}
                  >
                    {mantenimiento.descripcion_trabajo_realizado || 'No registrado.'}
                  </div>
                </div>

                {/* Diagnóstico Final / Resultado de Pruebas */}
                <div className="pdf-subblock w-full" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                  <span className="block font-bold text-slate-700 uppercase text-[10px] tracking-wider mb-1">
                    Diagnóstico Final / Resultado de Pruebas de Operatividad:
                  </span>
                  <div
                    className="w-full rounded bg-emerald-50/70 border border-emerald-200 text-emerald-950 font-medium whitespace-pre-wrap leading-relaxed font-sans"
                    style={{ fontSize: '13px', padding: '8px 12px', overflowWrap: 'break-word', wordBreak: 'break-word' }}
                  >
                    {mantenimiento.diagnostico_final || 'Equipo verificado y aprobado para uso clínico.'}
                  </div>
                </div>
              </div>
            </section>

            {/* SECCIÓN 4: RECURSOS EMPLEADOS */}
            <section
              className="mb-6 rounded-lg border border-slate-300 overflow-hidden break-inside-avoid print-avoid-break pdf-block"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  4. Recursos Empleados
                </h3>
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Costos y Horas</span>
              </div>
              <div className="p-4 grid grid-cols-3 gap-3.5 text-xs" style={{ minHeight: 'auto' }}>
                <div style={{ minHeight: 'auto', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  <span className="block font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-0.5">
                    Repuestos / Materiales Utilizados
                  </span>
                  <span className="text-slate-800 font-medium block" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                    {mantenimiento.repuestos_utilizados || 'No se emplearon repuestos'}
                  </span>
                </div>
                <div style={{ minHeight: 'auto', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  <span className="block font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-0.5">
                    Horas Hombre Dedicadas
                  </span>
                  <span className="text-slate-800 font-medium block" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                    {mantenimiento.horas_hombre != null ? `${mantenimiento.horas_hombre} hrs` : '—'}
                  </span>
                </div>
                <div style={{ minHeight: 'auto', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  <span className="block font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-0.5">
                    Costo Asociado
                  </span>
                  <span className="text-slate-800 font-bold block" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                    {mantenimiento.costo != null
                      ? `$ ${Number(mantenimiento.costo).toLocaleString('es-CL')}`
                      : '—'}
                  </span>
                </div>
                {mantenimiento.accesorios_adicionales && (
                  <div className="col-span-3 border-t border-slate-100 pt-2" style={{ minHeight: 'auto', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                    <span className="block font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-0.5">
                      Accesorios o Aditamentos Entregados
                    </span>
                    <span className="text-slate-800 font-medium block" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                      {mantenimiento.accesorios_adicionales}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* SECCIÓN 5: EVIDENCIA FOTOGRÁFICA Y DOCUMENTOS ADJUNTOS (si existen) */}
            {((mantenimiento.fotos_url && mantenimiento.fotos_url.length > 0) ||
              (mantenimiento.documentos_url && mantenimiento.documentos_url.length > 0)) && (
              <section
                className="mb-6 rounded-lg border border-slate-300 overflow-hidden break-inside-avoid print-avoid-break pdf-block"
                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
              >
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    5. Evidencia Fotográfica y Documentación de Soporte
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Anexos Técnicos</span>
                </div>
                <div className="p-4 space-y-4">
                  {mantenimiento.fotos_url && mantenimiento.fotos_url.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                        <ImageIcon className="h-3.5 w-3.5 text-blue-600" />
                        <span>Registro Fotográfico ({mantenimiento.fotos_url.length})</span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {mantenimiento.fotos_url.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                            title="Ver fotografía en tamaño completo"
                          >
                            <img
                              src={url}
                              alt={`Evidencia ${idx + 1}`}
                              crossOrigin="anonymous"
                              className="h-20 w-full object-cover transition-transform group-hover:scale-105"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {mantenimiento.documentos_url && mantenimiento.documentos_url.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                        <FileText className="h-3.5 w-3.5 text-blue-600" />
                        <span>Documentos Externos Adjuntos ({mantenimiento.documentos_url.length})</span>
                      </div>
                      <div className="space-y-1.5">
                        {mantenimiento.documentos_url.map((url, idx) => {
                          const docName = getNombreArchivo(url);
                          return (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={docName}
                              className="flex items-center gap-2 text-xs text-blue-700 hover:text-blue-900 bg-slate-50 p-2 rounded border border-slate-200 hover:border-blue-300 transition-colors"
                            >
                              <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              <span className="truncate font-medium">{docName}</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* SECCIÓN 6: CONFORMIDAD Y FIRMAS DE RESPONSABILIDAD TÉCNICA (INDIVISIBLE) */}
            <section
              className="mt-8 pt-4 border-t-2 border-slate-300 break-inside-avoid print-avoid-break pdf-block"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-4 text-center">
                Conformidad y Firmas de Responsabilidad Técnica
              </div>
              <div className="grid grid-cols-2 gap-8" style={{ minHeight: 'auto' }}>
                {/* Firma Técnico responsable */}
                <div
                  className="border border-slate-300 rounded-lg p-4 flex flex-col justify-between min-h-[140px] text-center bg-slate-50/50 break-inside-avoid print-avoid-break"
                  style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                >
                  <div className="h-14 border-b border-dashed border-slate-400 flex items-end justify-center pb-1">
                    <span className="text-[11px] text-slate-400 italic">Firma del Técnico</span>
                  </div>
                  <div className="mt-2 text-xs">
                    <div className="font-bold text-slate-900" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                      {mantenimiento.completado_por || 'Técnico Responsable'}
                    </div>
                    <div className="text-[11px] text-slate-600">Técnico Responsable del Servicio</div>
                    <div className="text-[10px] text-slate-400">Unidad de Equipos Médicos</div>
                  </div>
                </div>

                {/* Firma Receptor del servicio */}
                <div
                  className="border border-slate-300 rounded-lg p-4 flex flex-col justify-between min-h-[140px] text-center bg-slate-50/50 break-inside-avoid print-avoid-break"
                  style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                >
                  <div className="h-14 border-b border-dashed border-slate-400 flex items-end justify-center pb-1">
                    <span className="text-[11px] text-slate-400 italic">Firma y Timbre Receptor</span>
                  </div>
                  <div className="mt-2 text-xs">
                    <div className="font-bold text-slate-900" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                      {mantenimiento.recibido_por || 'Receptor del Servicio'}
                    </div>
                    <div className="text-[11px] text-slate-600">Recepción Conforme del Equipo</div>
                    <div className="text-[10px] text-slate-400" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                      {datosEquipo.ubicacion !== '—' ? datosEquipo.ubicacion : 'Servicio Clínico Solicitante'}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* PIE DE PÁGINA IMPRESIÓN NATIVA */}
            <footer
              className="mt-8 pt-4 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500 break-inside-avoid print-avoid-break pdf-block"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              <span>Documento oficial de trazabilidad • Registro: {correlativo} • Emisión: {formatearFecha(fechaEmision, false)}</span>
              <span className="font-semibold text-slate-700">Informe Técnico Oficial</span>
            </footer>
          </div>
        </div>

        {/* Botonera inferior - oculta al imprimir */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5 print:hidden">
          <div className="text-xs text-slate-500">
            {mantenimiento.fecha_cierre && (
              <span>
                Cerrado el <strong className="text-slate-700">{mantenimiento.fecha_cierre}</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={generandoPDF}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95 disabled:opacity-75 disabled:cursor-wait"
              title="Exportar y descargar Informe Técnico en PDF"
            >
              {generandoPDF ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generando PDF...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Exportar a PDF</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
              title="Imprimir documento con diálogo del navegador"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
