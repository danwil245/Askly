// Socket rooms for a quiz game:
//   code              → everyone (host + players)
//   `${code}:host`    → host only
//   `q:${code}:<cid>` → a single player (survives reconnect; rejoined on reconnect)
export const hostRoom = (code) => `${code}:host`;
export const playerRoom = (code, clientId) => `q:${code}:${clientId}`;

export function publicPlayers(game) {
  return [...game.players.values()]
    .filter((p) => !p.kicked)
    .map((p) => ({ id: p.playerId, nickname: p.nickname, score: p.score, connected: p.connected }));
}

export const connectedCount = (game) =>
  [...game.players.values()].filter((p) => p.connected && !p.kicked).length;

/** Host gets the full player list; everyone gets the count. */
export function emitPlayers(io, game) {
  const players = publicPlayers(game);
  io.to(hostRoom(game.code)).emit('quiz:players', { count: players.length, players });
  io.to(game.code).except(hostRoom(game.code)).emit('quiz:players', { count: players.length });
}

export function emitQuestion(io, game, payload) {
  io.to(game.code).emit('quiz:question', payload);
}

export function emitAnswerCount(io, game) {
  io.to(hostRoom(game.code)).emit('quiz:answer-count', {
    answered: game.answers.size,
    total: connectedCount(game),
  });
}

export function emitReveal(io, game, payload) {
  io.to(game.code).emit('quiz:reveal', payload);
}

export function emitResult(io, game, clientId, payload) {
  io.to(playerRoom(game.code, clientId)).emit('quiz:result', payload);
}

export function emitLeaderboard(io, game, board) {
  const top = board.slice(0, 5);
  const total = board.length;
  io.to(hostRoom(game.code)).emit('quiz:leaderboard', { top, total });
  for (const p of game.players.values()) {
    const mine = board.find((b) => b.nickname === p.nickname);
    io.to(playerRoom(game.code, p.clientId)).emit('quiz:leaderboard', {
      top,
      total,
      yourRank: mine?.rank ?? null,
      yourScore: p.score,
    });
  }
}

export function emitFinished(io, game, leaderboard) {
  io.to(game.code).emit('quiz:finished', { leaderboard });
}

export function emitKicked(io, game, clientId) {
  io.to(playerRoom(game.code, clientId)).emit('quiz:kicked', {});
}
