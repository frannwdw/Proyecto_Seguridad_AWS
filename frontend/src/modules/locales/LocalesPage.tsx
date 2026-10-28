/**
 * SalesIA Enterprise — Administración de Locales & Sucursales.
 *
 * Gestión de la red física de operativa: alta de locales con código interno y
 * series SUNAT autogenerados (F10x/B10x), designación de matriz, edición con
 * bloqueo de series cuando el local YA emitió comprobantes (contabilidad
 * inmutable) y desactivación sin borrado para preservar la trazabilidad.
 * Persistencia: localStorage vía mockDataService (la app corre sin BD).
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Plus, Pencil, Power, Star, MapPin, Phone, FileWarning,
  AlertTriangle, CheckCircle2, X, ShieldCheck
} from 'lucide-react';
import {
  getLocales, createLocal, updateLocal, activarLocal, desactivarLocal
} from '../../services/mockDataService';
import { useLocalActivo } from '../../services/localService';
import { Local } from '../../types';

interface FormularioLocal {
  nombre: string;
  direccion: string;
  telefono: string;
  es_principal: boolean;
}

const FORM_VACIO: FormularioLocal = { nombre: '', direccion: '', telefono: '', es_principal: false };

export const LocalesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { cambiar, localActivoId } = useLocalActivo();

  const [modalCrear, setModalCrear] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<FormularioLocal>(FORM_VACIO);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const { data: locales = [], isLoading } = useQuery<Local[]>({
    queryKey: ['locales'],
    queryFn: getLocales,
  });

  const cerrarModal = () => {
    setModalCrear(false);
    setEditandoId(null);
    setForm(FORM_VACIO);
  };

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['locales'] });
  };

  const crearMutation = useMutation({
    mutationFn: (payload: FormularioLocal) =>
      createLocal({
        nombre: payload.nombre,
        direccion: payload.direccion,
        telefono: payload.telefono,
        es_principal: payload.es_principal,
      }),
    onSuccess: (_local, variables) => {
      setAviso({ tipo: 'ok', texto: `Local "${variables.nombre}" creado con código y series SUNAT autogenerados.` });
      cerrarModal();
      refrescar();
    },
    onError: (e: any) => setAviso({ tipo: 'error', texto: e?.message || 'Error al crear el local.' }),
  });

  const editarMutation = useMutation({
    mutationFn: (p: { id: number; data: FormularioLocal }) =>
      updateLocal(p.id, {
        nombre: p.data.nombre,
        direccion: p.data.direccion,
        telefono: p.data.telefono,
        es_principal: p.data.es_principal,
      }),
    onSuccess: () => {
      setAviso({ tipo: 'ok', texto: 'Local actualizado correctamente.' });
      cerrarModal();
      refrescar();
    },
    onError: (e: any) => setAviso({ tipo: 'error', texto: e?.message || 'Error al actualizar el local.' }),
  });

  const alternarEstadoMutation = useMutation({
    mutationFn: (p: { id: number; activar: boolean }) =>
      p.activar ? activarLocal(p.id) : desactivarLocal(p.id),
    onSuccess: (_res, variables) => {
      setAviso({
        tipo: 'ok',
        texto: variables.activar
          ? 'Local reactivado: ya puede emitir comprobantes.'
          : 'Local desactivado: conserva sus ventas y su correlativo (nunca se borra).',
      });
      refrescar();
    },
    onError: (e: any) => setAviso({ tipo: 'error', texto: e?.message || 'Error al cambiar el estado del local.' }),
  });

  const abrirEdicion = (l: Local) => {
    setEditandoId(l.id);
    setForm({ nombre: l.nombre, direccion: l.direccion, telefono: l.telefono, es_principal: l.es_principal });
    setModalCrear(true);
  };

  const guardar = () => {
    if (!form.nombre.trim() || !form.direccion.trim()) {
      setAviso({ tipo: 'error', texto: 'El nombre y la dirección física del local son obligatorios.' });
      return;
    }
    if (editandoId) editarMutation.mutate({ id: editandoId, data: form });
    else crearMutation.mutate(form);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* ================= HEADER ================= */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-neutral-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
                <Building2 className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Locales &amp; Sucursales</h1>
            </div>
            <p className="text-xs text-neutral-500">
              Red física de operativa. Cada local emite comprobantes con su propia serie SUNAT y correlativo inmutable.
            </p>
          </div>
          <button
            onClick={() => { setForm(FORM_VACIO); setEditandoId(null); setModalCrear(true); }}
            className="inline-flex items-center gap-2 bg-neutral-900 hover:bg-neutral-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Nuevo Local</span>
          </button>
        </div>
      </div>

      {/* ================= AVISOS ================= */}
      {aviso && (
        <div className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${
          aviso.tipo === 'ok'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          {aviso.tipo === 'ok'
            ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{aviso.texto}</span>
          <button onClick={() => setAviso(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ================= LISTADO ================= */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[880px]">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Local</th>
                <th className="py-3 px-4">Ubicación</th>
                <th className="py-3 px-4">Series SUNAT</th>
                <th className="py-3 px-4 text-center">Operar</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Cargando red de locales...</td></tr>
              ) : locales.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">No hay locales registrados.</td></tr>
              ) : locales.map((l) => (
                <tr key={l.id} className={`hover:bg-slate-50/60 transition-colors ${!l.is_active ? 'opacity-60' : ''}`}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900">{l.nombre}</span>
                      {l.es_principal && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Star className="w-2.5 h-2.5" /> MATRIZ
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">Código interno: {l.codigo}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-start gap-1.5 text-slate-600">
                      <MapPin className="w-3 h-3 mt-0.5 text-slate-300 shrink-0" />
                      <span className="text-[11px] leading-snug">{l.direccion}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 mt-0.5">
                      <Phone className="w-3 h-3 shrink-0" />
                      <span className="text-[10px] font-mono">{l.telefono || 'Sin teléfono'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex w-fit px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-900 text-white">FACTURA {l.series_factura}</span>
                      <span className="inline-flex w-fit px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-amber-600 text-white">BOLETA {l.series_boleta}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {l.is_active ? (
                      localActivoId === l.id ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                          <CheckCircle2 className="w-3 h-3" /> EN OPERATIVA
                        </span>
                      ) : (
                        <button
                          onClick={() => cambiar(l.id)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 hover:bg-sky-600 hover:text-white text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                        >
                          Trabajar aquí
                        </button>
                      )
                    ) : <span className="text-[10px] text-slate-400">N/D</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {l.is_active ? (
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">ACTIVO</span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">DESACTIVADO</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                    <button
                      onClick={() => abrirEdicion(l)}
                      className="p-1.5 text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded"
                      title="Editar nombre, dirección y contacto"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {!l.es_principal && (
                      <button
                        onClick={() => alternarEstadoMutation.mutate({ id: l.id, activar: !l.is_active })}
                        className={`p-1.5 rounded ${l.is_active ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                        title={l.is_active ? 'Desactivar local (conserva su contabilidad)' : 'Reactivar local'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center gap-2 text-[10px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Trazabilidad SUNAT: los locales con comprobantes emitidos nunca se eliminan; se desactivan preservando sus series y correlativos.</span>
        </div>
      </div>

      {/* ================= MODAL CREAR / EDITAR ================= */}
      {modalCrear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-full overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sky-600" />
                {editandoId ? 'Editar Local' : 'Registrar Nuevo Local'}
              </h3>
              <button onClick={cerrarModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Nombre del local *</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: SalesIA Arequipa Plaza Mayor"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Dirección física (impresa en comprobantes) *</label>
                <input
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  placeholder="Ej: Calle Real 125, Arequipa - Perú"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Teléfono del local</label>
                <input
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="Ej: +51 (054) 555-3200"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
              <label className="flex items-start gap-2 p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.es_principal}
                  onChange={(e) => setForm({ ...form, es_principal: e.target.checked })}
                  className="mt-0.5 cursor-pointer"
                />
                <span className="text-[11px] text-amber-800 leading-snug">
                  <span className="font-semibold">Designar como MATRIZ</span> — será el local por defecto de la operativa y de las vistas consolidadas.
                  {editandoId ? null : ' El código y las series SUNAT (F/B) se generan automáticamente.'}
                </span>
              </label>

              <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-500">
                <FileWarning className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Regla de contabilidad inmutable: una serie asignada no se reutiliza ni se renumera; heredará el correlativo SUNAT del local.</span>
              </div>

              <div className={`flex justify-end gap-2 pt-2 ${editandoId ? '' : 'hidden'}`}>
                <span className="text-[10px] text-slate-400">
                  La serie actual no es editable si el local ya emitió comprobantes.
                </span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={cerrarModal}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={crearMutation.isPending || editarMutation.isPending}
                className="px-3.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-700 disabled:opacity-50 text-white text-xs font-semibold"
              >
                {editandoId ? 'Guardar Cambios' : 'Registrar Local'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocalesPage;
