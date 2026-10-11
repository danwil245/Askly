import { Room } from '../models/Room.js';
import { Session } from '../models/Session.js';
import { Player } from '../models/Player.js';
import { PlayerAnswer } from '../models/PlayerAnswer.js';
import { pointsForCorrect, rankPlayers } from './quizScoring.js';
import { publicQuizQuestion } from './quizService.js';
import { env } from '../config/env.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { cleanText } from '../utils/sanitize.js';
import { log } from '../utils/logger.js';
import { getIo } from '../sockets/broadcast.js';
import * as qb from '../sockets/quizBroadcast.js';

// code -> in-memory game. Lost on restart (interrupted games are cleaned up on boot).
const games = new Map();

const io = () => getIo();

function currentQuestion(game) {
  return game.quiz.questions[game.currentIndex];
}

function distribution(game) {
  const dist = {};
  for (const q of currentQuestion(game).options) dist[q.id] = 0;
  for (const a of game.answers.values()) dist[a.optionId] = (dist[a.optionId] || 0) + 1;
  return dist;
}

function playersArray(game) {
  return [...game.players.values()].filter((p) => !p.kicked);
}

/** Lazily build the in-memory game from the room's active session snapshot. */
export async function getOrCreateGame(code) {
  if (games.has(code)) return games.get(code);

  const room = await Room.findOne({ code: String(code).toUpperCase() });
  if (!room || room.type !== 'quiz') throw appError(ERROR_CODES.ROOM_NOT_FOUND, 'Quiz not found');
  const session = await Session.findById(room.currentSessionId);
  if (!session) throw appError(ERROR_CODES.ROOM_NOT_FOUND, 'Quiz session not found');

  const ended = session.status === 'ended' || room.status === 'closed';
  const game = {
    code: room.code,
    roomId: room._id,
    sessionId: session._id,
    ownerId: String(room.ownerId),
    quiz: session.quizSnapshot,
    phase: ended ? 'finished' : 'lobby',
    currentIndex: -1,
    questionEndsAt: null,
    timer: null,
    players: new Map(), // clientId -> { playerId, clientId, nickname, nicknameLower, score, correctCount, connected, kicked }
    answers: new Map(), // clientId -> { optionId, correct, pointsEarned }
    finalLeaderboard: ended ? session.finalLeaderboard || [] : null,
  };
  games.set(code, game);
  return game;
}

export function peekGame(code) {
  return games.get(code);
}

function stateSnapshot(game, clientId) {
  const total = game.quiz.questions.length;
  const snap = { phase: game.phase, index: game.currentIndex, total };

  if (game.phase === 'question' || game.phase === 'reveal') {
    const q = currentQuestion(game);
    snap.question = publicQuizQuestion(q, game.currentIndex, total);
    snap.endsAt = game.questionEndsAt;
    snap.serverNow = Date.now();
    if (game.phase === 'reveal') {
      snap.reveal = { correctOptionId: q.correctOptionId, distribution: distribution(game) };
    }
  }
  if (game.phase === 'leaderboard') {
    snap.leaderboard = rankPlayers(playersArray(game)).slice(0, 5);
  }
  if (game.phase === 'finished') {
    snap.leaderboard = game.finalLeaderboard || rankPlayers(playersArray(game));
  }
  if (clientId) {
    const p = game.players.get(clientId);
    if (p) snap.me = { nickname: p.nickname, score: p.score, correctCount: p.correctCount };
  }
  return snap;
}

export function hostSnapshot(game) {
  return { ...stateSnapshot(game), players: qb.publicPlayers(game) };
}

function assertOwner(game, userId) {
  if (String(game.ownerId) !== String(userId)) {
    throw appError(ERROR_CODES.FORBIDDEN, 'Only the host can do that');
  }
}

// --- Player join / rejoin ---
export async function playerJoin(game, { nickname, clientId }, socket) {
  const nick = cleanText(nickname, { singleLine: true });
  if (nick.length < 2 || nick.length > 20) {
    throw appError(ERROR_CODES.VALIDATION_ERROR, 'Nickname must be 2–20 characters');
  }
  const nicknameLower = nick.toLowerCase();

  // Rejoin: an existing player for this clientId restores score/position.
  let existing = game.players.get(clientId);
  if (!existing) {
    const doc = await Player.findOne({ sessionId: game.sessionId, clientId });
    if (doc && !doc.kicked) {
      existing = {
        playerId: String(doc._id),
        clientId,
        nickname: doc.nickname,
        nicknameLower: doc.nicknameLower,
        score: doc.score,
        correctCount: doc.correctCount,
        connected: true,
        kicked: false,
      };
      game.players.set(clientId, existing);
    }
  }
  if (existing) {
    if (existing.kicked) throw appError(ERROR_CODES.KICKED, 'You have been removed from this game');
    existing.connected = true;
    socket.join(qb.playerRoom(game.code, clientId));
    socket.join(game.code);
    qb.emitPlayers(io(), game);
    return { player: { id: existing.playerId, nickname: existing.nickname }, state: stateSnapshot(game, clientId) };
  }

  // New player — only allowed in the lobby (unless rejoining, handled above).
  if (game.phase !== 'lobby') throw appError(ERROR_CODES.GAME_STARTED, 'The game has already started');
  if (playersArray(game).length >= env.quiz.maxPlayers) {
    throw appError(ERROR_CODES.GAME_FULL, 'This game is full');
  }

  let doc;
  try {
    doc = await Player.create({
      sessionId: game.sessionId,
      roomId: game.roomId,
      clientId,
      nickname: nick,
      nicknameLower,
    });
  } catch (err) {
    if (err?.code === 11000) throw appError(ERROR_CODES.NICKNAME_TAKEN, 'That nickname is taken');
    throw err;
  }

  const player = {
    playerId: String(doc._id),
    clientId,
    nickname: nick,
    nicknameLower,
    score: 0,
    correctCount: 0,
    connected: true,
    kicked: false,
  };
  game.players.set(clientId, player);
  socket.join(qb.playerRoom(game.code, clientId));
  socket.join(game.code);
  qb.emitPlayers(io(), game);
  return { player: { id: player.playerId, nickname: nick }, state: stateSnapshot(game, clientId) };
}

export function markDisconnected(game, clientId) {
  const p = game.players.get(clientId);
  if (!p) return;
  p.connected = false;
  qb.emitPlayers(io(), game);
  maybeAdvanceAfterAnswers(game);
}

// --- Answering ---
export async function submitAnswer(game, clientId, { questionId, optionId }) {
  if (game.phase !== 'question') throw appError(ERROR_CODES.WRONG_PHASE, 'Not accepting answers');
  const q = currentQuestion(game);
  if (q.id !== questionId) throw appError(ERROR_CODES.WRONG_PHASE, 'That question is no longer active');
  if (Date.now() >= game.questionEndsAt) throw appError(ERROR_CODES.TIME_UP, 'Time is up');
  const player = game.players.get(clientId);
  if (!player) throw appError(ERROR_CODES.FORBIDDEN, 'Join the game first');
  if (game.answers.has(clientId)) throw appError(ERROR_CODES.ALREADY_ANSWERED, 'You already answered');
  if (!q.options.some((o) => o.id === optionId)) {
    throw appError(ERROR_CODES.VALIDATION_ERROR, 'Unknown option');
  }

  const correct = optionId === q.correctOptionId;
  const pointsEarned = correct ? pointsForCorrect() : 0;

  // DB backstop against duplicates.
  try {
    await PlayerAnswer.create({
      sessionId: game.sessionId,
      playerId: player.playerId,
      questionId,
      optionId,
      correct,
    });
  } catch (err) {
    if (err?.code === 11000) throw appError(ERROR_CODES.ALREADY_ANSWERED, 'You already answered');
    throw err;
  }

  if (correct) {
    player.score += pointsEarned;
    player.correctCount += 1;
    await Player.updateOne(
      { _id: player.playerId },
      { $set: { score: player.score, correctCount: player.correctCount } }
    );
  }
  game.answers.set(clientId, { optionId, correct, pointsEarned });

  qb.emitAnswerCount(io(), game);
  maybeAdvanceAfterAnswers(game);
  return { received: true };
}

function maybeAdvanceAfterAnswers(game) {
  if (game.phase !== 'question') return;
  const connected = qb.connectedCount(game);
  if (connected > 0 && game.answers.size >= connected) {
    reveal(game);
  }
}

// --- Phase transitions ---
function clearTimer(game) {
  if (game.timer) {
    clearTimeout(game.timer);
    game.timer = null;
  }
}

function gotoQuestion(game, index) {
  game.currentIndex = index;
  game.phase = 'question';
  game.answers = new Map();
  const q = currentQuestion(game);
  game.questionEndsAt = Date.now() + q.timeLimitSec * 1000;

  clearTimer(game);
  game.timer = setTimeout(() => reveal(game), q.timeLimitSec * 1000 + 250);
  if (game.timer.unref) game.timer.unref();

  qb.emitQuestion(io(), game, {
    ...publicQuizQuestion(q, index, game.quiz.questions.length),
    endsAt: game.questionEndsAt,
    serverNow: Date.now(),
  });
  qb.emitAnswerCount(io(), game);
}

function reveal(game) {
  if (game.phase !== 'question') return;
  clearTimer(game);
  game.phase = 'reveal';
  const q = currentQuestion(game);

  qb.emitReveal(io(), game, { correctOptionId: q.correctOptionId, distribution: distribution(game) });

  // Personal result to every player (non-answerers get correct:false, 0 points).
  for (const p of game.players.values()) {
    if (p.kicked) continue;
    const a = game.answers.get(p.clientId);
    qb.emitResult(io(), game, p.clientId, {
      correct: !!a?.correct,
      pointsEarned: a?.pointsEarned || 0,
      totalScore: p.score,
    });
  }
}

function leaderboard(game) {
  game.phase = 'leaderboard';
  qb.emitLeaderboard(io(), game, rankPlayers(playersArray(game)));
}

export function start(game, userId) {
  assertOwner(game, userId);
  if (game.phase !== 'lobby') throw appError(ERROR_CODES.WRONG_PHASE, 'The game already started');
  if (playersArray(game).length < 1) throw appError(ERROR_CODES.VALIDATION_ERROR, 'Need at least one player');
  gotoQuestion(game, 0);
  return hostSnapshot(game);
}

export function skip(game, userId) {
  assertOwner(game, userId);
  if (game.phase !== 'question') throw appError(ERROR_CODES.WRONG_PHASE, 'No active question');
  reveal(game);
  return { ok: true };
}

export async function next(game, userId) {
  assertOwner(game, userId);
  if (game.phase === 'reveal') {
    leaderboard(game);
    return { phase: 'leaderboard' };
  }
  if (game.phase === 'leaderboard') {
    const nextIndex = game.currentIndex + 1;
    if (nextIndex < game.quiz.questions.length) {
      gotoQuestion(game, nextIndex);
      return { phase: 'question' };
    }
    await finish(game);
    return { phase: 'finished' };
  }
  throw appError(ERROR_CODES.WRONG_PHASE, 'Nothing to advance');
}

export async function kick(game, userId, playerId) {
  assertOwner(game, userId);
  const entry = [...game.players.values()].find((p) => p.playerId === playerId);
  if (!entry) throw appError(ERROR_CODES.NOT_FOUND, 'Player not found');
  entry.kicked = true;
  entry.connected = false;
  await Player.updateOne({ _id: playerId }, { $set: { kicked: true } });
  qb.emitKicked(io(), game, entry.clientId);
  qb.emitPlayers(io(), game);
  return { ok: true };
}

async function persistOutcome(game, { interrupted = false } = {}) {
  const board = rankPlayers(playersArray(game));
  game.finalLeaderboard = board;
  const topScore = board[0]?.score || 0;
  await Session.updateOne(
    { _id: game.sessionId },
    {
      $set: {
        status: 'ended',
        endedAt: new Date(),
        interrupted,
        finalLeaderboard: board,
        summary: {
          players: playersArray(game).length,
          questions: game.quiz.questions.length,
          topScore,
        },
      },
    }
  );
  await Room.updateOne({ _id: game.roomId }, { $set: { status: 'closed', currentSessionId: null } });
  return board;
}

async function finish(game) {
  clearTimer(game);
  game.phase = 'finished';
  const board = await persistOutcome(game);
  qb.emitFinished(io(), game, board);
}

export async function end(game, userId) {
  assertOwner(game, userId);
  clearTimer(game);
  game.phase = 'finished';
  const board = await persistOutcome(game, { interrupted: true });
  qb.emitFinished(io(), game, board);
  games.delete(game.code);
  return { ok: true };
}

/**
 * On boot, any quiz Session still 'active' belongs to a game whose in-memory state was
 * lost on restart. Mark them ended+interrupted and close their rooms (spec section 9).
 */
export async function cleanupInterruptedGamesOnBoot() {
  const activeQuizRooms = await Room.find({ type: 'quiz', status: 'open' }).lean();
  for (const room of activeQuizRooms) {
    if (!room.currentSessionId) continue;
    // eslint-disable-next-line no-await-in-loop
    await Session.updateOne(
      { _id: room.currentSessionId, status: 'active' },
      { $set: { status: 'ended', endedAt: new Date(), interrupted: true } }
    );
    // eslint-disable-next-line no-await-in-loop
    await Room.updateOne({ _id: room._id }, { $set: { status: 'closed', currentSessionId: null } });
  }
  if (activeQuizRooms.length) {
    log.info('quiz.boot.cleanup', { interrupted: activeQuizRooms.length });
  }
}
