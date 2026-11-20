// Lưu trữ & xuất Bảng xếp hạng cục bộ trên đĩa (TICKET-04 Phần 3).
// Đặt ngoài src/ để giữ lõi src/ 100% thuần JS (không fs/Date).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_LB_PATH = join(root, 'data', 'leaderboard.json');
export const MAX_ENTRIES = 10;

// Tên 3-12 ký tự [A-Za-z0-9_] + hỗ trợ chữ cái tiếng Việt có dấu
const NAME_RE = /^[\p{L}\p{N}_]{3,12}$/u;

export function getLeaderboardPath() {
  return process.env.DDL_LEADERBOARD_PATH || DEFAULT_LB_PATH;
}

export function validatePlayerName(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'Tên phải là chuỗi.' };
  const name = raw.trim();
  if (name.length < 3 || name.length > 12) {
    return { ok: false, error: 'Tên phải dài từ 3 đến 12 ký tự.' };
  }
  if (!NAME_RE.test(name)) {
    return { ok: false, error: 'Tên chỉ được gồm chữ cái (có dấu hoặc không dấu), chữ số và dấu gạch dưới (_).' };
  }
  return { ok: true, name };
}

export function formatIsoWithTimezone(date = new Date()) {
  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const tzMin = -date.getTimezoneOffset();
  const sign = tzMin >= 0 ? '+' : '-';
  const hh = pad(Math.floor(Math.abs(tzMin) / 60));
  const mm = pad(Math.abs(tzMin) % 60);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hh}:${mm}`;
}

export function sortAndTrimEntries(entries) {
  return entries
    .slice()
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = Date.parse(a.achieved_at) || 0;
      const tb = Date.parse(b.achieved_at) || 0;
      return ta - tb; // bằng điểm: ai đạt trước đứng trên
    })
    .slice(0, MAX_ENTRIES);
}

export function loadLeaderboard(filePath = getLeaderboardPath()) {
  if (!existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    const list = Array.isArray(parsed?.entries) ? parsed.entries : [];
    return sortAndTrimEntries(list.filter((e) => e && typeof e.name === 'string' && Number.isFinite(e.score)));
  } catch {
    return [];
  }
}

export function saveLeaderboard(entries, filePath = getLeaderboardPath()) {
  const sorted = sortAndTrimEntries(entries);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify({ entries: sorted }, null, 2) + '\n', 'utf8');
  return sorted;
}

export function addLeaderboardEntry({ name, score, nights_won, achieved_at, seed }, filePath = getLeaderboardPath()) {
  const check = validatePlayerName(name);
  if (!check.ok) throw new Error(check.error);
  const cleanScore = Math.max(0, Math.floor(Number(score) || 0));
  const cleanNights = Math.max(0, Math.min(3, Math.floor(Number(nights_won) || 0)));
  const cleanSeed = Number.isInteger(Number(seed)) ? Number(seed) : 1;
  const iso = (typeof achieved_at === 'string' && !Number.isNaN(Date.parse(achieved_at)) && /(Z|[+-]\d{2}:\d{2})$/.test(achieved_at))
    ? achieved_at
    : formatIsoWithTimezone(new Date());

  const entry = {
    name: check.name,
    score: cleanScore,
    nights_won: cleanNights,
    achieved_at: iso,
    seed: cleanSeed,
  };
  const current = loadLeaderboard(filePath);
  current.push(entry);
  const entries = saveLeaderboard(current, filePath);
  return { entry, entries };
}

export function exportLeaderboard(outPath, filePath = getLeaderboardPath()) {
  const entries = loadLeaderboard(filePath);
  const parent = dirname(outPath);
  if (parent && parent !== '.') mkdirSync(parent, { recursive: true });
  writeFileSync(outPath, JSON.stringify({ entries }, null, 2) + '\n', 'utf8');
  return entries;
}
