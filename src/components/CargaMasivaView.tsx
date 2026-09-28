import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import {
  UploadCloud,
  Boxes,
  FileText,
  Wrench,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  ShieldAlert,
  Loader2,
  Check,
  ChevronRight,
  HelpCircle,
  Database,
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import {
  supabase,
  type Equipo,
  type Convenio,
  type Mantenimiento,
} from '@/lib/supabase';
import {
  PLANTILLAS_CARGA,
  descargarPlantillaCSV,
  type PlantillaConfig,
} from '@/utils/cargaMasivaTemplates';

type PasoCarga = 'equipos' | 'convenios' | 'mantenimientos';

interface FilaValidada {
  indiceFila: number; // 1-indexed (fila en el archivo excel/csv)
  datos: Record<string, string>;
  errores: { columna: string; mensaje: string }[];
  esValida: boolean;
}

interface CargaMasivaViewProps {
  onNavigateToTab?: (tab: 'inventario' | 'convenios' | 'mantenimiento') => void;
  onDataImported?: () => void;
}

export default function CargaMasivaView({
  onNavigateToTab,
  onDataImported,
}: CargaMasivaViewProps) {
  const { usuarioActivo, esAdmin, esModoSimulacion } = useAuth();

  // 1. RESTRICCIÓN ESTRICTA DE ACCESO Y RBAC
  // Exclusivo para Administrador activo. Si está en simulación o no es admin, se bloquea.
  const rolActivo = usuarioActivo?.rol || '';
  const esAdminActivo = esAdmin && !esModoSimulacion && rolActivo.includes('Administrador');

  // Estado del Asistente
  const [pasoActivo, setPasoActivo] = useState<PasoCarga>('equipos');

  // Base de datos previa para validación de claves primarias e integridad referencial
  const [equiposDB, setEquiposDB] = useState<Equipo[]>([]);
  const [conveniosDB, setConveniosDB] = useState<Convenio[]>([]);
  const [mantenimientosDB, setMantenimientosDB] = useState<Mantenimiento[]>([]);
  const [cargandoDB, setCargandoDB] = useState(false);

  // Archivo y Parseo
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string>('');
  const [parseando, setParseando] = useState(false);
  const [filasValidadas, setFilasValidadas] = useState<FilaValidada[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Ejecución por lotes
  const [ejecutandoCarga, setEjecutandoCarga] = useState(false);
  const [progresoPorcentaje, setProgresoPorcentaje] = useState(0);
  const [mensajeProgreso, setMensajeProgreso] = useState('');
  const [resumenExito, setResumenExito] = useState<{
    totalInsertados: number;
    totalOmitidos: number;
    entidad: string;
  } | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const mostrarToast = (tipo: 'exito' | 'error', mensaje: string) => {
    setToast({ tipo, mensaje });
    setTimeout(() => {
      setToast((curr) => (curr?.mensaje === mensaje ? null : curr));
    }, 4500);
  };

  // Cargar registros existentes para validaciones referenciales y duplicados
  const cargarSnapshotDB = useCallback(async () => {
    setCargandoDB(true);
    try {
      const [resEq, resConv, resMant] = await Promise.all([
        supabase.from('equipos').select('id, codigo, nombre, marca, modelo, ubicacion'),
        supabase.from('convenios').select('id, codigo, nombre, empresa'),
        supabase.from('mantenimientos').select('id, codigo, equipo_id'),
      ]);

      if (resEq.data) setEquiposDB(resEq.data as Equipo[]);
      if (resConv.data) setConveniosDB(resConv.data as Convenio[]);
      if (resMant.data) setMantenimientosDB(resMant.data as Mantenimiento[]);
    } catch (err) {
      console.error('Error al cargar datos previos de validación:', err);
    } finally {
      setCargandoDB(false);
    }
  }, []);

  useEffect(() => {
    if (esAdminActivo) {
      cargarSnapshotDB();
    }
  }, [esAdminActivo, cargarSnapshotDB]);

  // Si cambia de paso, reiniciar archivo y preview
  const handleCambiarPaso = (nuevoPaso: PasoCarga) => {
    setPasoActivo(nuevoPaso);
    setArchivoSeleccionado(null);
    setNombreArchivo('');
    setFilasValidadas([]);
    setResumenExito(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Configuración de la plantilla actual
  const plantillaActual: PlantillaConfig = PLANTILLAS_CARGA[pasoActivo];

  // 3. MOTOR DE VALIDACIÓN PREVIA (CLIENT-SIDE VALIDATION)
  const validarFilas = useCallback(
    (filasLeidas: Record<string, string>[]): FilaValidada[] => {
      const config = PLANTILLAS_CARGA[pasoActivo];
      const obligatorios = config.obligatorios;

      // Conjuntos para detección de duplicados en el mismo archivo
      const codigosVistosEnArchivo = new Set<string>();

      // Conjuntos de códigos existentes en DB
      const codigosEquiposDB = new Set(equiposDB.map((e) => (e.codigo || '').trim().toUpperCase()));
      const codigosConveniosDB = new Set(conveniosDB.map((c) => (c.codigo || '').trim().toUpperCase()));
      const codigosMantenimientosDB = new Set(mantenimientosDB.map((m) => (m.codigo || '').trim().toUpperCase()));

      return filasLeidas.map((fila, idx) => {
        const errores: { columna: string; mensaje: string }[] = [];
        const numFilaArchivo = idx + 2; // +1 por 1-indexed, +1 por fila de encabezado

        // A. Celdas obligatorias vacías
        obligatorios.forEach((col) => {
          const val = (fila[col] || '').trim();
          if (!val) {
            errores.push({
              columna: col,
              mensaje: `El campo obligatorio "${config.headersLabels[col] || col}" está vacío en la Fila ${numFilaArchivo}.`,
            });
          }
        });

        // B. Validaciones específicas según el paso (Duplicados e Integridad Referencial)
        if (pasoActivo === 'equipos') {
          const codigo = (fila.codigo || '').trim().toUpperCase();
          if (codigo) {
            if (codigosVistosEnArchivo.has(codigo)) {
              errores.push({
                columna: 'codigo',
                mensaje: `Código "${codigo}" duplicado dentro de este mismo archivo.`,
              });
            } else {
              codigosVistosEnArchivo.add(codigo);
            }

            if (codigosEquiposDB.has(codigo)) {
              errores.push({
                columna: 'codigo',
                mensaje: `El código "${codigo}" ya existe en el Catastro de Equipos. Se omitirá para evitar duplicidad.`,
              });
            }
          }
        } else if (pasoActivo === 'convenios') {
          const codConv = (fila.codigo_convenio || '').trim().toUpperCase();
          if (codConv) {
            if (codigosVistosEnArchivo.has(codConv)) {
              errores.push({
                columna: 'codigo_convenio',
                mensaje: `Código de convenio "${codConv}" duplicado dentro del archivo.`,
              });
            } else {
              codigosVistosEnArchivo.add(codConv);
            }

            if (codigosConveniosDB.has(codConv)) {
              errores.push({
                columna: 'codigo_convenio',
                mensaje: `El convenio "${codConv}" ya está registrado previamente en el sistema.`,
              });
            }
          }

          // Integridad Referencial: Verificar que el equipo amparado exista en el Catastro
          const codEqAsoc = (fila.codigo_equipo_asociado || '').trim().toUpperCase();
          if (codEqAsoc && !codigosEquiposDB.has(codEqAsoc)) {
            errores.push({
              columna: 'codigo_equipo_asociado',
              mensaje: `Error Fila ${numFilaArchivo}: El equipo "${codEqAsoc}" no está registrado en el Catastro. Registre el equipo en el Paso 1 antes de ampararlo.`,
            });
          }
        } else if (pasoActivo === 'mantenimientos') {
          const codOt = (fila.codigo_ot || '').trim().toUpperCase();
          if (codOt) {
            if (codigosVistosEnArchivo.has(codOt)) {
              errores.push({
                columna: 'codigo_ot',
                mensaje: `Código de OT "${codOt}" duplicado en el archivo.`,
              });
            } else {
              codigosVistosEnArchivo.add(codOt);
            }

            if (codigosMantenimientosDB.has(codOt)) {
              errores.push({
                columna: 'codigo_ot',
                mensaje: `La OT "${codOt}" ya existe registrada en el historial.`,
              });
            }
          }

          // Integridad Referencial: Verificar que el equipo intervenido exista en el Catastro
          const codEq = (fila.codigo_equipo || '').trim().toUpperCase();
          if (codEq && !codigosEquiposDB.has(codEq)) {
            errores.push({
              columna: 'codigo_equipo',
              mensaje: `Error Fila ${numFilaArchivo}: El equipo "${codEq}" no está registrado en el Catastro. Debe existir previamente en inventario.`,
            });
          }
        }

        return {
          indiceFila: numFilaArchivo,
          datos: fila,
          errores,
          esValida: errores.length === 0,
        };
      });
    },
    [pasoActivo, equiposDB, conveniosDB, mantenimientosDB]
  );

  // Procesar archivo con PapaParse
  const procesarArchivo = (file: File) => {
    setArchivoSeleccionado(file);
    setNombreArchivo(file.name);
    setParseando(true);
    setResumenExito(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      complete: (results) => {
        setParseando(false);
        if (results.errors && results.errors.length > 0 && results.data.length === 0) {
          mostrarToast('error', `Error al leer el archivo: ${results.errors[0].message}`);
          return;
        }

        // Sanitizar claves (trim headers) y filtrar filas vacías
        const datosLimpios = results.data
          .map((row) => {
            const cleanRow: Record<string, string> = {};
            Object.keys(row).forEach((k) => {
              const cleanKey = k.trim().replace(/^[\uFEFF]/, ''); // remover BOM
              cleanRow[cleanKey] = (row[k] !== null && row[k] !== undefined ? String(row[k]) : '').trim();
            });
            return cleanRow;
          })
          .filter((row) => Object.values(row).some((val) => val !== ''));

        if (datosLimpios.length === 0) {
          mostrarToast('error', 'El archivo no contiene filas de datos para procesar.');
          setFilasValidadas([]);
          return;
        }

        const validadas = validarFilas(datosLimpios);
        setFilasValidadas(validadas);

        const validasCount = validadas.filter((f) => f.esValida).length;
        const erroresCount = validadas.length - validasCount;

        if (erroresCount === 0) {
          mostrarToast('exito', `Archivo validado: ${validasCount} fila(s) listas para importar.`);
        } else {
          mostrarToast(
            'error',
            `Se encontraron anomalías en ${erroresCount} fila(s). Revisa el panel de validación.`
          );
        }
      },
      error: (err) => {
        setParseando(false);
        mostrarToast('error', `Error procesando CSV: ${err.message}`);
      },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      procesarArchivo(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      procesarArchivo(file);
    }
  };

  // Métricas calculadas del archivo
  const totalFilas = filasValidadas.length;
  const filasValidas = useMemo(() => filasValidadas.filter((f) => f.esValida), [filasValidadas]);
  const filasConError = useMemo(() => filasValidadas.filter((f) => !f.esValida), [filasValidadas]);

  // Primeras 10 filas para la previsualización
  const previewFilas = useMemo(() => filasValidadas.slice(0, 10), [filasValidadas]);

  // 4. EJECUCIÓN DE LA CARGA POR LOTES (BATCH INSERT EN CHUNKS DE 100)
  const handleConfirmarImportacion = async () => {
    if (filasValidas.length === 0) {
      mostrarToast('error', 'No hay filas válidas para importar.');
      return;
    }

    if (filasConError.length > 0) {
      const confirmar = confirm(
        `Hay ${filasConError.length} fila(s) con errores que serán OMITIDAS.\n\n¿Deseas continuar e importar únicamente las ${filasValidas.length} fila(s) válidas?`
      );
      if (!confirmar) return;
    }

    setEjecutandoCarga(true);
    setProgresoPorcentaje(0);
    setMensajeProgreso('Iniciando procesamiento por lotes...');

    const CHUNK_SIZE = 100;
    const filasAProcesar = filasValidas.map((f) => f.datos);
    const totalAProcesar = filasAProcesar.length;
    let totalInsertados = 0;
    const totalOmitidos = filasConError.length;

    try {
      const chunks: Record<string, string>[][] = [];
      for (let i = 0; i < totalAProcesar; i += CHUNK_SIZE) {
        chunks.push(filasAProcesar.slice(i, i + CHUNK_SIZE));
      }

      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunk = chunks[chunkIdx];
        const numLote = chunkIdx + 1;
        setMensajeProgreso(`Insertando lote ${numLote} de ${chunks.length} (${chunk.length} registros)...`);

        if (pasoActivo === 'equipos') {
          // Transformar datos a modelo Equipo
          const payloadEquipos = chunk.map((r) => ({
            codigo: r.codigo.trim(),
            nombre: r.nombre.trim(),
            marca: r.marca?.trim() || null,
            modelo: r.modelo?.trim() || null,
            serie: r.serie?.trim() || 'S/N',
            ubicacion: r.ubicacion?.trim() || 'Sin Asignar',
            estado: (r.estado?.trim() || 'Operativo') as Equipo['estado'],
            inventario: r.inventario?.trim() || null,
            anio_adquisicion: r.anio_adquisicion ? parseInt(r.anio_adquisicion, 10) : new Date().getFullYear(),
            orden_compra: r.orden_compra?.trim() || null,
            acta_entrega: r.acta_entrega?.trim() || null,
            vida_util: r.vida_util ? parseInt(r.vida_util, 10) : 10,
            vida_util_residual: r.vida_util_residual ? parseInt(r.vida_util_residual, 10) : 7,
            modalidad_adquisicion: (r.modalidad_adquisicion?.trim() || 'Propio') as Equipo['modalidad_adquisicion'],
          }));

          const { error } = await supabase.from('equipos').insert(payloadEquipos);
          if (error) throw error;
          totalInsertados += payloadEquipos.length;
        } else if (pasoActivo === 'convenios') {
          // Inserción en convenios, convenio_equipos y convenio_cuotas_mensuales
          for (const r of chunk) {
            const codConv = r.codigo_convenio.trim();
            const codEq = (r.codigo_equipo_asociado || '').trim().toUpperCase();

            // Buscar equipo en DB
            const eqEncontrado = equiposDB.find((e) => (e.codigo || '').toUpperCase() === codEq);

            // 1. Insertar Convenio
            const payloadConvenio = {
              codigo: codConv,
              nombre: r.nombre_convenio.trim(),
              empresa: r.empresa_proveedor.trim(),
              rut_empresa: r.rut_empresa?.trim() || null,
              tipo_convenio: r.tipo_convenio?.trim() || 'Arriendo',
              fecha_inicio: r.fecha_inicio?.trim() || new Date().toISOString().split('T')[0],
              fecha_termino: r.fecha_termino?.trim() || new Date().toISOString().split('T')[0],
              monto_total_comprometido: r.monto_total_comprometido ? parseFloat(r.monto_total_comprometido) : 0,
              moneda: 'CLP',
              orden_compra_madre: r.orden_compra?.trim() || null,
              estado: 'Vigente',
              responsable: 'Admin UEM',
              descripcion: 'Carga masiva oficial UEM1.3',
            };

            const { data: convCreado, error: errConv } = await supabase
              .from('convenios')
              .insert(payloadConvenio)
              .select();

            if (errConv) throw errConv;

            const convId = convCreado && convCreado[0] ? (convCreado[0] as Convenio).id : null;

            // 2. Vincular equipo si existe
            if (convId && eqEncontrado) {
              await supabase.from('convenio_equipos').insert({
                convenio_id: convId,
                equipo_id: eqEncontrado.id,
                fecha_incorporacion: payloadConvenio.fecha_inicio,
                estado_vinculo: 'Activo',
                observaciones: `Amparado vía carga masiva. Ref: ${codEq}`,
              });
            }

            // 3. Registrar Cuota si viene especificada
            if (convId && r.mes && r.anio) {
              await supabase.from('convenio_cuotas_mensuales').insert({
                convenio_id: convId,
                estado_uic: r.estado_uic?.trim() || 'En Trámite',
                numero_guia: r.numero_guia?.trim() || '',
                fecha_guia: r.fecha_guia?.trim() || '',
                codigo_mi_ssvq: r.codigo_mi_ssvq?.trim() || '',
                fecha_entrega_abastecimiento: '',
                empresa: payloadConvenio.empresa,
                equipo_servicio: r.nombre_convenio.trim(),
                orden_compra: r.orden_compra?.trim() || '',
                fecha_oc: r.fecha_oc?.trim() || '',
                mes: r.mes.trim(),
                anio: parseInt(r.anio, 10) || new Date().getFullYear(),
                cuota: r.cuota?.trim() || '1/12',
                valor_clp: r.valor_cuota_clp ? parseFloat(r.valor_cuota_clp) : 0,
                estado_mercado_publico: r.estado_mercado_publico?.trim() || 'Recepcionado Conforme',
                numero_factura: r.numero_factura?.trim() || '',
                fecha_factura: r.fecha_factura?.trim() || '',
              });
            }

            totalInsertados++;
          }
        } else if (pasoActivo === 'mantenimientos') {
          // Insertar en mantenimientos vinculando equipo_id
          const payloadMants = chunk.map((r) => {
            const codEq = (r.codigo_equipo || '').trim().toUpperCase();
            const eqEncontrado = equiposDB.find((e) => (e.codigo || '').toUpperCase() === codEq);

            return {
              codigo: r.codigo_ot.trim(),
              equipo_id: eqEncontrado ? eqEncontrado.id : null,
              equipo_identificacion: eqEncontrado
                ? `${eqEncontrado.codigo} — ${eqEncontrado.nombre}`
                : codEq,
              problema_reportado: r.problema_reportado.trim(),
              solicitado_por: r.solicitado_por?.trim() || 'Admin UEM',
              asignado_a: r.asignado_a?.trim() || null,
              fecha_requerimiento: r.fecha_requerimiento?.trim() || new Date().toISOString().split('T')[0],
              tipo_mantenimiento: r.tipo_mantenimiento?.trim() || 'Correctivo',
              estado_mantenimiento: r.estado_mantenimiento?.trim() || 'Completado',
              descripcion_trabajo_realizado: r.descripcion_trabajo?.trim() || null,
              fecha_cierre: r.fecha_cierre?.trim() || null,
              horas_hombre: r.horas_hombre ? parseFloat(r.horas_hombre) : null,
              costo: r.costo_repuestos ? parseFloat(r.costo_repuestos) : 0,
            };
          });

          const { error } = await supabase.from('mantenimientos').insert(payloadMants);
          if (error) throw error;
          totalInsertados += payloadMants.length;
        }

        // Actualizar barra de progreso interactiva
        const pct = Math.round(((chunkIdx + 1) / chunks.length) * 100);
        setProgresoPorcentaje(pct);
      }

      setResumenExito({
        totalInsertados,
        totalOmitidos,
        entidad: plantillaActual.titulo,
      });

      mostrarToast('exito', `¡Carga masiva completada! ${totalInsertados} registro(s) agregados.`);
      await cargarSnapshotDB();
      onDataImported?.();
    } catch (err: unknown) {
      console.error('Error durante la inserción por lotes:', err);
      mostrarToast('error', `Error durante la carga: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setEjecutandoCarga(false);
    }
  };

  // PANTALLA DE ACCESO DENEGADO SI NO ES ADMINISTRADOR REAL ACTIVO
  if (!esAdminActivo) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-8 text-center max-w-2xl mx-auto shadow-sm my-12 animate-in fade-in duration-200">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 ring-8 ring-rose-50 mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-rose-950">
          Acceso Denegado: Esta función requiere privilegios de Administrador del Sistema
        </h2>
        <p className="mt-2 text-sm text-rose-800 leading-relaxed">
          {esModoSimulacion
            ? `Te encuentras en Modo Simulación activa bajo el rol "${rolActivo}". La Carga Masiva de Datos altera registros clave del Catastro, Convenios y Órdenes de Trabajo, por lo cual se bloquea automáticamente durante la simulación de perfiles.`
            : `Tu perfil institucional actual es "${rolActivo}". Única y exclusivamente el Administrador (Jefe de Unidad) tiene autorización para ejecutar cargas masivas de datos.`}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigateToTab?.('inventario')}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition active:scale-95 cursor-pointer"
          >
            <Boxes className="h-4 w-4" />
            <span>Volver al Catastro de Equipos</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl p-4 shadow-xl border backdrop-blur-md animate-in fade-in duration-200 max-w-md ${
            toast.tipo === 'exito'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200 ring-1 ring-emerald-500/30'
              : 'bg-rose-50 text-rose-900 border-rose-200 ring-1 ring-rose-500/30'
          }`}
        >
          {toast.tipo === 'exito' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          )}
          <span className="text-xs font-semibold flex-1 leading-snug">{toast.mensaje}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm ring-4 ring-indigo-100">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Motor de Carga Masiva de Datos
                </h2>
                <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800 ring-1 ring-inset ring-purple-500/20">
                  Exclusivo Administrador
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Importación por lotes de Catastro, Contratos UIC e Historial de Mantenimientos con validación previa de integridad
              </p>
            </div>
          </div>
        </div>

        {/* Botón Descarga Plantilla Oficial del paso activo */}
        <button
          type="button"
          id="btn-descargar-plantilla-csv-oficial"
          onClick={() => {
            const ok = descargarPlantillaCSV(pasoActivo);
            if (ok) mostrarToast('exito', `Plantilla descargada: ${plantillaActual.nombreArchivo}`);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-400 transition active:scale-95 cursor-pointer"
        >
          <Download className="h-4 w-4 text-indigo-600" />
          <span>Descargar Plantilla CSV Oficial</span>
        </button>
      </div>

      {/* 2. SELECTOR DE PESTAÑAS CON ORDEN ESTRICTO DE PRECEDENCIA */}
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* Paso 1: Catastro de Equipos */}
          <button
            type="button"
            id="tab-paso-1-equipos"
            onClick={() => handleCambiarPaso('equipos')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition cursor-pointer ${
              pasoActivo === 'equipos'
                ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-2xs'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
            }`}
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 font-bold text-xs ${
                pasoActivo === 'equipos'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              1
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-xs text-slate-900">Catastro de Equipos</span>
                <span className="rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.2">
                  Entidad Base
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                Obligatorio primero. Códigos UEM únicos.
              </p>
              <div className="mt-1 text-[10px] text-slate-400 font-mono">
                {cargandoDB ? 'Actualizando base de datos...' : `${equiposDB.length} equipos registrados`}
              </div>
            </div>
          </button>

          {/* Paso 2: Convenios Marco */}
          <button
            type="button"
            id="tab-paso-2-convenios"
            onClick={() => handleCambiarPaso('convenios')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition cursor-pointer ${
              pasoActivo === 'convenios'
                ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-2xs'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
            }`}
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 font-bold text-xs ${
                pasoActivo === 'convenios'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              2
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-xs text-slate-900">Convenios y Cuotas UIC</span>
                <span className="rounded bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.2">
                  Depende de Equipos
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                Vincula equipos amparados y matriz.
              </p>
              <div className="mt-1 text-[10px] text-slate-400 font-mono">
                {cargandoDB ? 'Actualizando...' : `${conveniosDB.length} convenios registrados`}
              </div>
            </div>
          </button>

          {/* Paso 3: Historial de OTs */}
          <button
            type="button"
            id="tab-paso-3-mantenimientos"
            onClick={() => handleCambiarPaso('mantenimientos')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition cursor-pointer ${
              pasoActivo === 'mantenimientos'
                ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-2xs'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
            }`}
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 font-bold text-xs ${
                pasoActivo === 'mantenimientos'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              3
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-xs text-slate-900">Historial de OTs</span>
                <span className="rounded bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.2">
                  Depende de Equipos
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                Requiere códigos de inventario existentes.
              </p>
              <div className="mt-1 text-[10px] text-slate-400 font-mono">
                {cargandoDB ? 'Actualizando...' : `${mantenimientosDB.length} OTs registradas`}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Grid Central: Área de Carga / Previsualización (8 cols) + Guía de Orden de Carga (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Asistente y Vista Previa (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Zona de Arrastre / Subida de Archivo */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
              dragOver
                ? 'border-indigo-500 bg-indigo-50/70 ring-4 ring-indigo-500/20 scale-[0.99]'
                : archivoSeleccionado
                ? 'border-emerald-300 bg-emerald-50/30'
                : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, .txt, text/csv, application/vnd.ms-excel"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3 shadow-2xs">
              {parseando ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : archivoSeleccionado ? (
                <FileSpreadsheet className="h-7 w-7 text-emerald-600" />
              ) : (
                <UploadCloud className="h-7 w-7" />
              )}
            </div>

            {archivoSeleccionado ? (
              <div>
                <span className="rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 border border-emerald-200">
                  Archivo cargado
                </span>
                <h4 className="mt-2 text-sm font-bold text-slate-900 font-mono">
                  {nombreArchivo}
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Haz clic o arrastra otro archivo para reemplazar
                </p>
              </div>
            ) : (
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Arrastra aquí tu archivo CSV para {plantillaActual.titulo.split(':')[1]?.trim() || 'este paso'}
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Soporta archivos <strong>.csv</strong> con delimitador de coma (,) o punto y coma (;)
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 transition">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Seleccionar archivo desde el equipo</span>
                </div>
              </div>
            )}
          </div>

          {/* Resumen de Validación Previa */}
          {filasValidadas.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Motor de Validación Previa (Data Preview)</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-bold text-slate-700">
                      {totalFilas} filas detectadas
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Se muestran las primeras {Math.min(10, totalFilas)} filas evaluadas en memoria antes de tocar la base de datos
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{filasValidas.length} Válidas</span>
                  </span>

                  {filasConError.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800 border border-rose-200">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                      <span>{filasConError.length} con Error</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Alerta de Errores Detectados (si existen) */}
              {filasConError.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-900 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-rose-950">
                    <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                    <span>Se detectaron anomalías en {filasConError.length} fila(s):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 max-h-36 overflow-y-auto pr-1 text-[11px] text-rose-800">
                    {filasConError.slice(0, 8).map((f) => (
                      <li key={f.indiceFila}>
                        <strong>Fila {f.indiceFila}:</strong>{' '}
                        {f.errores.map((e) => e.mensaje).join(' | ')}
                      </li>
                    ))}
                    {filasConError.length > 8 && (
                      <li className="font-semibold text-rose-900">
                        ... y {filasConError.length - 8} error(es) adicionales en otras filas.
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Tabla de Previsualización con resaltado de sintaxis */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs whitespace-nowrap min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700">
                      <th className="px-3 py-2.5 text-center w-14">FILA</th>
                      <th className="px-3 py-2.5 text-center w-20">ESTADO</th>
                      {plantillaActual.headers.slice(0, 6).map((h) => (
                        <th key={h} className="px-3 py-2.5 uppercase tracking-wider">
                          {h}
                          {plantillaActual.obligatorios.includes(h) && (
                            <span className="text-rose-500 ml-0.5">*</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {previewFilas.map((f) => {
                      const tieneError = !f.esValida;
                      return (
                        <tr
                          key={f.indiceFila}
                          className={`transition-colors ${
                            tieneError ? 'bg-rose-50/50 hover:bg-rose-50' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="px-3 py-2 text-center text-slate-500 font-bold">
                            {f.indiceFila}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {f.esValida ? (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                <Check className="h-3 w-3" /> OK
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 cursor-help"
                                title={f.errores.map((e) => e.mensaje).join('\n')}
                              >
                                <XCircle className="h-3 w-3" /> Error
                              </span>
                            )}
                          </td>
                          {plantillaActual.headers.slice(0, 6).map((h) => {
                            const val = f.datos[h] || '';
                            const errorEnCelda = f.errores.find((e) => e.columna === h);
                            return (
                              <td
                                key={h}
                                className={`px-3 py-2 ${
                                  errorEnCelda
                                    ? 'bg-rose-100/90 text-rose-950 font-bold border-l-2 border-rose-500'
                                    : 'text-slate-700'
                                }`}
                                title={errorEnCelda ? errorEnCelda.mensaje : undefined}
                              >
                                {val || <span className="text-slate-300 italic font-sans">—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Botón de Ejecución de la Carga por Lotes */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  {filasConError.length === 0 ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Todas las filas superaron los controles de integridad.
                    </span>
                  ) : (
                    <span className="text-amber-700 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" /> Se omitirán las {filasConError.length} fila(s) con error.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setArchivoSeleccionado(null);
                      setFilasValidadas([]);
                    }}
                    disabled={ejecutandoCarga}
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                  >
                    Descartar Archivo
                  </button>

                  <button
                    type="button"
                    id="btn-confirmar-e-importar"
                    onClick={handleConfirmarImportacion}
                    disabled={ejecutandoCarga || filasValidas.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {ejecutandoCarga ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Importando en lotes...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-4 w-4" />
                        <span>Confirmar e Importar {filasValidas.length} Registros</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Barra de Progreso Interactiva */}
              {ejecutandoCarga && (
                <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-indigo-950">{mensajeProgreso}</span>
                    <span className="font-mono font-extrabold text-indigo-700">
                      {progresoPorcentaje}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-indigo-200/80">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                      style={{ width: `${progresoPorcentaje}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal / Card de Resumen de Carga Exitosa */}
          {resumenExito && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-sm space-y-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-emerald-950">
                    Carga Masiva Ejecutada Exitosamente
                  </h3>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Se han insertado <strong>{resumenExito.totalInsertados}</strong> registros en Supabase para {resumenExito.entidad}.
                    {resumenExito.totalOmitidos > 0 && ` (${resumenExito.totalOmitidos} filas omitidas por anomalías).`}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    {pasoActivo === 'equipos' && (
                      <button
                        type="button"
                        onClick={() => onNavigateToTab?.('inventario')}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition cursor-pointer"
                      >
                        <Boxes className="h-4 w-4" />
                        <span>Ver Catastro de Equipos</span>
                      </button>
                    )}

                    {pasoActivo === 'convenios' && (
                      <button
                        type="button"
                        onClick={() => onNavigateToTab?.('convenios')}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition cursor-pointer"
                      >
                        <FileText className="h-4 w-4" />
                        <span>Ver Convenios y Matriz UIC</span>
                      </button>
                    )}

                    {pasoActivo === 'mantenimientos' && (
                      <button
                        type="button"
                        onClick={() => onNavigateToTab?.('mantenimiento')}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition cursor-pointer"
                      >
                        <Wrench className="h-4 w-4" />
                        <span>Ver Historial de Mantenimientos</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setResumenExito(null);
                        setArchivoSeleccionado(null);
                        setFilasValidadas([]);
                      }}
                      className="rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 transition cursor-pointer"
                    >
                      Importar Otro Lote
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Columna Derecha: 5. INSTRUCTIVO INTEGRADO (Guía de Orden de Carga) (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Database className="h-4 w-4 text-indigo-600" />
              <h3>Guía de Orden de Carga y Precedencia</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Para garantizar la <strong>integridad referencial</strong> y evitar errores de claves foráneas en la base de datos Supabase, es <strong>estrictamente obligatorio</strong> respetar el orden secuencial:
            </p>

            <div className="space-y-3 pt-2">
              {/* Etapa 1 */}
              <div
                className={`p-3 rounded-xl border text-xs transition ${
                  pasoActivo === 'equipos'
                    ? 'border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-500/20'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white font-mono">
                      1
                    </span>
                    Catastro de Equipos
                  </span>
                  <span className="text-[10px] font-mono text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                    Obligatorio
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-600 leading-normal">
                  Crea los registros físicos y correlativos de inventario (código, marca, modelo, serie, servicio clínico).
                </p>
              </div>

              {/* Conector */}
              <div className="flex justify-center text-slate-300">
                <ChevronRight className="h-4 w-4 rotate-90" />
              </div>

              {/* Etapa 2 */}
              <div
                className={`p-3 rounded-xl border text-xs transition ${
                  pasoActivo === 'convenios'
                    ? 'border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-500/20'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white font-mono">
                      2
                    </span>
                    Convenios y Pagos UIC
                  </span>
                  <span className="text-[10px] font-mono text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                    FK: equipo_id
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-600 leading-normal">
                  Los contratos de arriendo o comodato requieren vincular los equipos amparados previamente ingresados en el Paso 1.
                </p>
              </div>

              {/* Conector */}
              <div className="flex justify-center text-slate-300">
                <ChevronRight className="h-4 w-4 rotate-90" />
              </div>

              {/* Etapa 3 */}
              <div
                className={`p-3 rounded-xl border text-xs transition ${
                  pasoActivo === 'mantenimientos'
                    ? 'border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-500/20'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-[10px] text-white font-mono">
                      3
                    </span>
                    Historial de OTs
                  </span>
                  <span className="text-[10px] font-mono text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                    FK: equipo_id
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-600 leading-normal">
                  Cada orden técnica o mantenimiento histórico debe pertenecer a un equipo registrado para conformar su Hoja de Vida.
                </p>
              </div>
            </div>

            {/* Consejos de Formato Excel y CSV */}
            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                <span>Recomendaciones Técnicas</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-500">
                <li>
                  Utiliza la <strong>Plantilla Oficial</strong> descargable para asegurar que los encabezados coincidan exactamente.
                </li>
                <li>
                  El delimitador estándar en Windows/Excel es <strong>punto y coma (;)</strong> o <strong>coma (,)</strong>.
                </li>
                <li>
                  Las fechas deben expresarse en formato ISO: <strong>AAAA-MM-DD</strong> (ej. 2026-08-15).
                </li>
                <li>
                  Los montos en pesos se ingresan como enteros numéricos sin símbolos ni puntos (ej. <strong>2500000</strong>).
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
