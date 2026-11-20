import { NIGHT_1 } from './n1.js';
import { NIGHT_2 } from './n2.js';
import { NIGHT_3 } from './n3.js';

export const NIGHTS = { 1: NIGHT_1, 2: NIGHT_2, 3: NIGHT_3 };

export function getNight(id) {
  const n = NIGHTS[id];
  if (!n) throw new Error(`Đêm không hợp lệ: ${id} (chỉ hỗ trợ 1, 2, 3)`);
  return n;
}
