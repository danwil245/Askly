/**
 * Live audience presence: count sockets in a room that are NOT host sockets.
 * Uses the Socket.io adapter's room membership as the source of truth so it stays
 * correct across reconnects.
 */
export async function presenceCount(io, code) {
  const all = await io.in(code).fetchSockets();
  return all.filter((s) => !s.data?.isHost).length;
}

/** Count sockets from a given IP currently in a room (for the connection cap). */
export async function socketsFromIpInRoom(io, code, ip) {
  const all = await io.in(code).fetchSockets();
  return all.filter((s) => s.data?.ip === ip).length;
}
