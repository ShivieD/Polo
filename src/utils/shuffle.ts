/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/* Fisher-Yates. The sort(() => Math.random() - 0.5) trick used before is
   measurably biased — with six options it left the correct answer in its
   original slot far too often (the "answer is always the first one" bug). */
export function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
