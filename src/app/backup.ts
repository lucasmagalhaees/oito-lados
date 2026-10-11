import { blurField, isCurrency } from './format';
import { render, toast } from './render';
import { S, applyTheme, saveS, setCurrency, setS, settingsOf, ui, validState } from './state';
import { sync } from './sync';
import type { AppState, Currency } from '../core';

/* ================= backup: the person's data as a text or as a file ================= */
/** The backup as text: everything that is saved about the person, stamped with when it was taken. */
export const backupText = (now: number): string => JSON.stringify({ ...S, app: 'oito-lados', savedAt: now });
/** The name of a backup file, with the day and the hour it was taken: files sent around are told apart by it. */
export function backupName(now: number): string {
  const d = new Date(now), p = (n: number): string => String(n).padStart(2, '0');
  return `oito-lados-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}
/** What a backup holds, to be shown before it replaces anything. Null when the text is not a backup. */
export interface BackupInfo { bets: number; open: number; deposited: number; cur: Currency; savedAt: number | null }
export function peekBackup(text: string): { state: AppState; info: BackupInfo } | null {
  let s: unknown = null; try { s = JSON.parse(text || ''); } catch (err) { /* not JSON: not a backup */ }
  if (!validState(s)) return null;
  const bets = s.bets.filter(x => x && Array.isArray(x.legs) && x.stake > 0), at = (s as { savedAt?: unknown }).savedAt;
  return { state: s, info: { bets: bets.length, open: bets.filter(b => b.status === 'open').length, deposited: s.deposits.reduce((a, d) => a + (d && d.v > 0 ? d.v : 0), 0), cur: isCurrency(s.cur) ? s.cur : 'BRL', savedAt: typeof at === 'number' && at > 0 ? at : null } };
}
/** Replaces everything with what a backup holds. False, and nothing changes, when the text is not a backup. */
export function restoreFrom(text: string): boolean {
  const got = peekBackup(text); if (!got) return false;
  const s = got.state;
  setS({ v: 1, deposits: s.deposits.filter(x => x && x.v > 0 && x.t), bets: s.bets.filter(x => x && Array.isArray(x.legs) && x.stake > 0), ...settingsOf(s), seen: Date.now() });
  if (Array.isArray(s.conv)) S.conv = s.conv.filter(c => c && isCurrency(c.from) && isCurrency(c.to) && c.rate > 0 && c.t && typeof c.date === 'string').slice(-20);
  setCurrency(s.cur); applyTheme(); saveS();
  ui.restore = false; ui.restoreFile = null; blurField(); render(); toast('Backup restaurado.'); sync(true);
  return true;
}
/** Hands the backup over as a file. On a phone it goes through the share sheet, straight to a chat or to the files of
 *  the device; where a page cannot share a file, it is downloaded. Giving up on the share sheet does nothing. */
export async function saveBackupFile(): Promise<void> {
  const now = Date.now(), name = backupName(now), text = backupText(now);
  let file: File | null = null;
  try { file = new File([text], name, { type: 'application/json' }); } catch (err) { /* a browser that cannot make a file downloads it below */ }
  if (file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Backup do Oito Lados' }); toast('Backup salvo em arquivo.'); return; }
    catch (err) { if (err && (err as { name?: string }).name === 'AbortError') return; }      // the person closed the sheet; any other failure falls back to a download
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), a = document.createElement('a');
  a.href = url; a.download = name; a.hidden = true; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast(`Backup baixado: ${name}`);
}
/** Reads a backup file that was picked and shows what it holds; nothing is replaced until the person confirms. */
export async function pickBackupFile(file: File | undefined): Promise<void> {
  if (!file) return;
  let text = ''; try { text = await file.text(); } catch (err) { /* handled as not a backup */ }
  const got = peekBackup(text);
  if (!got) { ui.restoreFile = null; render(); toast('Esse arquivo não é um backup do Oito Lados.'); return; }
  ui.restoreFile = { name: file.name, text, ...got.info }; ui.restore = false; render();
}
