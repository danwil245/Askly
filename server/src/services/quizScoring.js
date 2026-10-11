import { env } from '../config/env.js';

/** Flat points per correct answer (no speed bonus) — spec section 9. */
export const pointsForCorrect = () => env.quiz.pointsPerCorrect;

/**
 * Rank players by score desc. Ties share a rank (standard competition ranking: 1,2,2,4).
 * @param {Array<{nickname,score,correctCount}>} players
 */
export function rankPlayers(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
  let lastScore = null;
  let lastRank = 0;
  return sorted.map((p, i) => {
    const rank = p.score === lastScore ? lastRank : i + 1;
    lastScore = p.score;
    lastRank = rank;
    return { nickname: p.nickname, score: p.score, correctCount: p.correctCount, rank };
  });
}
