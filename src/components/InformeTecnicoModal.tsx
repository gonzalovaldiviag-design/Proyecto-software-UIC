import { useEffect, useRef, useState } from 'react';
import {
  X,
  FileText,
  RotateCcw,
  CheckCircle2,
  Calendar,
  User,
  Wrench,
  Clock,
  DollarSign,
  Package,
  Loader2,
  Download,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Mantenimiento, Equipo } from '@/lib/supabase';

interface InformeTecnicoModalProps {
  open: boolean;
  onClose: () => void;
  mantenimiento: Mantenimiento | null;
  equipos: Equipo[];
  onReabrir?: (mantenimiento: Mantenimiento) => void;
}

export default function InformeTecnicoModal({
  open,
  onClose,
  mantenimiento,
  equipos,
  onReabrir,
}: InformeTecnicoModalProps) {
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState<{ tipo: 'exito' | 'info'; texto: string } | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

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

  const eq = equipos.find((e) => e.id === mantenimiento.equipo_id);

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

  const correlativo = mantenimiento.numero_informe || `INF-${mantenimiento.codigo}`;

  const handleDownloadPDF = async () => {
    if (generandoPDF || !reportRef.current) return;
    setGenerandoPDF(true);
    setMensajeEstado({ tipo: 'info', texto: 'Generando archivo PDF con todas las páginas y secciones del informe...' });

    let staging: HTMLElement | null = null;

    try {
      const sourceReport = reportRef.current;

      if (document.fonts) {
        await document.fonts.ready;
      }

      staging = document.createElement('div');
      staging.id = 'pdf-pages-staging-tecnico';
      staging.style.position = 'fixed';
      staging.style.top = '-99999px';
      staging.style.left = '0';
      staging.style.width = '816px';
      staging.style.backgroundColor = '#ffffff';
      staging.style.zIndex = '-9999';
      staging.style.opacity = '0';
      staging.style.pointerEvents = 'none';
      document.body.appendChild(staging);

      const PAGE_WIDTH_PX = 816;
      const PAGE_HEIGHT_PX = 1056;
      const PAD_TOP_PX = 57;
      const PAD_BOTTOM_PX = 57;
      const PAD_X_PX = 45;

      const directChildren = Array.from(sourceReport.children) as HTMLElement[];
      const origHeader = directChildren[0];
      const contentBlocks = directChildren.slice(1, directChildren.length - 1);
      const origFooter = directChildren[directChildren.length - 1];

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

        const headerEl = document.createElement('div');
        headerEl.className = 'pdf-page-header';
        headerEl.style.width = '100%';
        headerEl.style.marginBottom = '14px';
        headerEl.style.flexShrink = '0';

        if (pageNum === 1 && origHeader) {
          const hClone = origHeader.cloneNode(true) as HTMLElement;
          hClone.classList.remove('pb-5');
          hClone.classList.add('pb-3.5', 'mb-0');
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
                <span>UNIDAD DE EQUIPOS MÉDICOS • INFORME TÉCNICO</span>
              </div>
              <div class="font-mono font-black text-slate-900 text-xs">
                N° ${correlativo}
              </div>
            </div>
          `;
        }
        pageEl.appendChild(headerEl);

        const contentEl = document.createElement('div');
        contentEl.className = 'pdf-page-body';
        contentEl.style.display = 'flex';
        contentEl.style.flexDirection = 'column';
        contentEl.style.gap = '14px';
        contentEl.style.width = '100%';
        pageEl.appendChild(contentEl);

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
          <span>${origFooter?.textContent || 'Documento Oficial de Registro Clínico'}</span>
          <span class="pdf-page-num font-semibold text-slate-700">Página ${pageNum}</span>
        `;
        pageEl.appendChild(footerEl);

        const pageNumEl = footerEl.querySelector('.pdf-page-num') as HTMLElement;

        staging!.appendChild(pageEl);

        const getUsableHeight = () => {
          const headerH = headerEl.offsetHeight || (pageNum === 1 ? 130 : 38);
          return PAGE_HEIGHT_PX - PAD_TOP_PX - headerH - 14 - 36 - PAD_BOTTOM_PX;
        };

        return { pageEl, headerEl, contentEl, footerEl, pageNumEl, getUsableHeight };
      };

      let currentPage = createNewPage(1);
      pages.push(currentPage);

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

        if (currentContentH > usableH && currentPage.contentEl.children.length > 1) {
          currentPage.contentEl.removeChild(card);
          currentPage = createNewPage(pages.length + 1);
          pages.push(currentPage);
          currentPage.contentEl.appendChild(card);
        }
      };

      contentBlocks.forEach((block) => {
        addCard(block.cloneNode(true) as HTMLElement);
      });

      const totalPages = pages.length;
      pages.forEach((p, idx) => {
        p.pageNumEl.textContent = `Página ${idx + 1} de ${totalPages}`;
      });

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
        texto: `¡Informe completo generado con éxito! Archivo "${nombreArchivo}" descargado en su equipo.`,
      });
      setTimeout(() => setMensajeEstado(null), 6000);
    } catch (err) {
      console.error('Error al generar PDF completo:', err);
      setMensajeEstado({
        tipo: 'info',
        texto: 'No se pudo completar la generación del PDF. Por favor, intente nuevamente.',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 print-modal-overlay">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity print:hidden"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80 overflow-hidden print-modal-container">
        {/* Top bar (Hidden on Print) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-3.5 print:hidden">
          <div className="flex items-center gap-2 text-slate-700">
            <FileText className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-semibold">Vista Previa de Informe Técnico</span>
            <span className="rounded-md bg-blue-100 px-2 py-0.5 font-mono text-xs font-semibold text-blue-700">
              {correlativo}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={generandoPDF}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 shadow-sm transition hover:bg-blue-100 active:scale-95 disabled:opacity-75"
              title="Descargar informe completo en archivo PDF"
            >
              {generandoPDF ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
              ) : (
                <Download className="h-3.5 w-3.5 text-blue-600" />
              )}
              <span>{generandoPDF ? 'Generando PDF...' : 'Descargar PDF'}</span>
            </button>
            {onReabrir && (
              <button
                onClick={() => onReabrir(mantenimiento)}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100 active:scale-95"
                title="Reabrir este mantenimiento para corregir datos"
              >
                <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
                <span>Reabrir Orden</span>
              </button>
            )}
            <button
              onClick={onClose}
              type="button"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {mensajeEstado && (
          <div
            className={`flex items-center justify-between px-6 py-2.5 text-xs font-medium border-b transition-all print:hidden ${
              mensajeEstado.tipo === 'exito'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {mensajeEstado.tipo === 'exito' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600 flex-shrink-0" />
              )}
              <span>{mensajeEstado.texto}</span>
            </div>
            <button
              type="button"
              onClick={() => setMensajeEstado(null)}
              className="text-slate-400 hover:text-slate-600 ml-4"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Printable Document Content */}
        <div
          id="printable-report"
          ref={reportRef}
          className="overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-800 bg-white print-modal-scroll"
        >
          {/* Header Institucional */}
          <div className="border-b-2 border-slate-800 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white font-bold text-sm shadow-sm print:bg-slate-900">
                    UEM
                  </div>
                  <div>
                    <h1 className="text-sm font-bold tracking-wider text-slate-900 uppercase">
                      Unidad de Equipos Médicos e Ingeniería Clínica
                    </h1>
                    <p className="text-xs text-slate-500">
                      Sistema Integrado de Control y Mantenimiento Hospitalario
                    </p>
                  </div>
                </div>
                <h2 className="mt-4 text-xl font-extrabold text-slate-900 tracking-tight">
                  INFORME TÉCNICO DE MANTENIMIENTO
                </h2>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-right print:bg-white print:border-slate-300">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  N° Correlativo de Informe
                </div>
                <div className="font-mono text-lg font-bold text-blue-700 print:text-slate-900">
                  {correlativo}
                </div>
                <div className="mt-1 flex items-center justify-end gap-2 text-xs text-slate-600">
                  <span>Orden de Trabajo:</span>
                  <span className="font-mono font-semibold text-slate-800">{mantenimiento.codigo}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  Emisión: {formatearFecha(mantenimiento.fecha_emision_informe || mantenimiento.created_at, true)}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800 ring-1 ring-emerald-600/20">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mantenimiento Certificado y Completado
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-700 ring-1 ring-slate-300">
                Tipo: <strong className="font-semibold">{mantenimiento.tipo_mantenimiento}</strong>
              </span>
              {mantenimiento.costo != null && mantenimiento.costo > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 font-medium text-blue-800 ring-1 ring-blue-300">
                  <DollarSign className="h-3.5 w-3.5" />
                  Costo Total: ${mantenimiento.costo.toLocaleString('es-CL')}
                </span>
              )}
            </div>
          </div>

          {/* Sección 1: Datos del Equipo */}
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              1. Identificación del Equipo Médico
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
              <div>
                <span className="block text-slate-400">Equipo:</span>
                <span className="font-semibold text-slate-900">{eq?.nombre || mantenimiento.equipo_identificacion}</span>
              </div>
              <div>
                <span className="block text-slate-400">Código Institucional:</span>
                <span className="font-mono font-semibold text-blue-700">{eq?.codigo || '—'}</span>
              </div>
              <div>
                <span className="block text-slate-400">Marca:</span>
                <span className="font-medium text-slate-800">{eq?.marca || '—'}</span>
              </div>
              <div>
                <span className="block text-slate-400">Modelo:</span>
                <span className="font-medium text-slate-800">{eq?.modelo || '—'}</span>
              </div>
              <div>
                <span className="block text-slate-400">N° Serie:</span>
                <span className="font-mono font-medium text-slate-800">{eq?.serie || '—'}</span>
              </div>
              <div>
                <span className="block text-slate-400">Ubicación / Servicio:</span>
                <span className="font-medium text-slate-800">{eq?.ubicacion || '—'}</span>
              </div>
              <div>
                <span className="block text-slate-400">N° Inventario:</span>
                <span className="font-mono font-medium text-slate-800">{eq?.inventario || '—'}</span>
              </div>
              <div>
                <span className="block text-slate-400">Modalidad:</span>
                <span className="font-medium text-slate-800">{eq?.modalidad_adquisicion || '—'}</span>
              </div>
            </div>
          </div>

          {/* Sección 2: Trazabilidad y Datos de la Orden */}
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              2. Trazabilidad del Servicio Técnico
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-slate-200 bg-white p-4 text-xs">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <span className="block text-slate-400">Fecha Requerimiento:</span>
                  <span className="font-medium text-slate-800">{formatearFecha(mantenimiento.fecha_requerimiento)}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-emerald-600 mt-0.5" />
                <div>
                  <span className="block text-slate-400">Fecha de Realización:</span>
                  <span className="font-semibold text-emerald-700">{formatearFecha(mantenimiento.fecha_cierre)}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <span className="block text-slate-400">Horas Hombre:</span>
                  <span className="font-medium text-slate-800">{mantenimiento.horas_hombre ? `${mantenimiento.horas_hombre} hrs` : '—'}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <span className="block text-slate-400">Solicitado Por:</span>
                  <span className="font-medium text-slate-800">{mantenimiento.solicitado_por}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sección 3: Descripción Técnica y Diagnóstico */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              3. Detalle Técnico de la Intervención
            </h3>

            {/* Problema Reportado */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <div className="font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                <Wrench className="h-3.5 w-3.5 text-slate-500" />
                Problema / Causa Reportada:
              </div>
              <p className="text-slate-700 whitespace-pre-wrap">{mantenimiento.problema_reportado}</p>
            </div>

            {/* Descripción del Trabajo Realizado */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3.5 text-xs">
              <div className="font-semibold text-blue-900 flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                Descripción del Trabajo Realizado:
              </div>
              <p className="text-slate-800 whitespace-pre-wrap font-sans">
                {mantenimiento.descripcion_trabajo_realizado || 'Mantenimiento ejecutado según protocolo estándar.'}
              </p>
            </div>

            {/* Diagnóstico Final y Estado de Operatividad */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-xs">
              <div className="font-semibold text-emerald-900 flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                Diagnóstico Final y Resultado Técnico:
              </div>
              <p className="text-emerald-950 whitespace-pre-wrap font-medium">
                {mantenimiento.diagnostico_final || 'Equipo verificado y liberado para uso clínico operativo.'}
              </p>
            </div>

            {/* Repuestos o Accesorios (si existen) */}
            {(mantenimiento.repuestos_utilizados || mantenimiento.accesorios_adicionales) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {mantenimiento.repuestos_utilizados && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                      <Package className="h-3.5 w-3.5 text-slate-500" />
                      Repuestos / Insumos Utilizados:
                    </div>
                    <p className="text-slate-600">{mantenimiento.repuestos_utilizados}</p>
                  </div>
                )}
                {mantenimiento.accesorios_adicionales && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                      <Package className="h-3.5 w-3.5 text-slate-500" />
                      Accesorios Adicionales:
                    </div>
                    <p className="text-slate-600">{mantenimiento.accesorios_adicionales}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sección 4: Firmas Técnicas y Recepción */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              4. Conformidad y Firmas Técnicas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs pt-6 pb-2">
              {/* Firma Técnico */}
              <div className="flex flex-col items-center text-center">
                <div className="w-64 border-b border-dashed border-slate-400 pb-8 mb-2">
                  <div className="font-mono text-[11px] text-slate-400 italic">
                    [Firma / Timbre Digital o Manuscrito]
                  </div>
                </div>
                <div className="font-bold text-slate-900">
                  {mantenimiento.completado_por || mantenimiento.asignado_a || 'Técnico Responsable'}
                </div>
                <div className="text-slate-500 text-[11px]">
                  Ingeniería Clínica / Mantenimiento
                </div>
                <div className="text-slate-400 text-[10px] mt-0.5">
                  Fecha: {formatearFecha(mantenimiento.fecha_cierre)}
                </div>
              </div>

              {/* Firma Recepción */}
              <div className="flex flex-col items-center text-center">
                <div className="w-64 border-b border-dashed border-slate-400 pb-8 mb-2">
                  <div className="font-mono text-[11px] text-slate-400 italic">
                    [Firma / Timbre de Recepción]
                  </div>
                </div>
                <div className="font-bold text-slate-900">
                  {mantenimiento.recibido_por || mantenimiento.solicitado_por || 'Recepción Conforme'}
                </div>
                <div className="text-slate-500 text-[11px]">
                  Servicio Clínico Usuario / Responsable
                </div>
                <div className="text-slate-400 text-[10px] mt-0.5">
                  Fecha: {formatearFecha(mantenimiento.fecha_cierre)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions (Hidden on Print) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 print:hidden">
          <p className="text-xs text-slate-500">
            Documento oficial de trazabilidad técnica emitido electrónicamente.
          </p>
          <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={generandoPDF}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition disabled:opacity-75"
              title="Descargar informe completo en archivo PDF"
            >
              {generandoPDF ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{generandoPDF ? 'Generando PDF...' : 'Descargar PDF'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
