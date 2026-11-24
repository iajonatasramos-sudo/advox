import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Ampliação da interface (25%, igual ao BuildChat). Aplicada via `zoom` no
 * .bc-root, então TODA coordenada medida no DOM do WhatsApp (px reais) precisa
 * ser dividida por ZOOM antes de virar `left`/`top` dentro das raízes.
 */
export const ZOOM = 1.25;
export const emPx = (v: number) => v / ZOOM;

/** Altura visual da barra do topo e larguras da lateral (px reais). */
export const ALTURA_TOPBAR = 50;
export const LARGURA_TRILHO = 56;
export const LARGURA_GAVETA = 353;

export const CORES_CATEGORIA: string[] = [
  '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#f59e0b', '#ef4444', '#14b8a6', '#6366f1',
];

export const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const soDigitos = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');

/** Só dígitos com DDI → "+55 11 96478-8124". */
export function formatarTelefone(valor: string | null | undefined): string | null {
  const d = soDigitos(valor);
  if (!d) return null;
  if (!d.startsWith('55') || d.length < 12) return `+${d}`;
  const ddd = d.slice(2, 4);
  const resto = d.slice(4);
  const meio = resto.length > 8 ? resto.slice(0, 5) : resto.slice(0, 4);
  return `+55 ${ddd} ${meio}-${resto.slice(meio.length)}`;
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function formatarHora(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function dataHoraCurta(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
