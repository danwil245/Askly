/**
 * Live audience presence: count sockets in a room that are NOT host sockets.
 * Uses the Socket.io adapter's room membership as the source of truth so it stays
 * correct across reconnects.
 */
export async function presenceCount(io, code) {
  const all = await io.in(code).fetchSockets();
  return all.filter((s) => !s.data?.isHost).length;
}

/**
 * Person 3 — Anti-Spamming Security: socketsFromIpInRoom
 * IP-based connection tracking for flood protection and campus Wi-Fi connection caps.
 * Count sockets from a given IP currently in a room.
 */
export async function socketsFromIpInRoom(io, code, ip) {
  const all = await io.in(code).fetchSockets();
  return all.filter((s) => s.data?.ip === ip).length;
}
