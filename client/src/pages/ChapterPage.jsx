/**
 * ChapterPage — detail view for a single chapter, listing its mentor rooms.
 *
 * Route: /mentor/chapters/:id  (authentication required)
 *
 * Responsibilities:
 *   - Load the current chapter's metadata (name, description) and its mentor rooms
 *     in parallel via Promise.all. All chapters are fetched (includeArchived: true)
 *     so the chapter selector in RoomCard can offer any chapter for room moves.
 *   - Allow creating new mentor rooms inside this chapter via CreateRoomModal.
 *   - Support room lifecycle actions:
 *       reopen  — POST /api/rooms/:code/open   (starts a new session)
 *       close   — POST /api/rooms/:code/close  (via CloseRoomDialog for optional naming)
 *   - Support moving a room to a different chapter via PATCH /api/rooms/:code
 *     { chapterId }. Rooms are not moved when the target chapter matches the current
 *     one (guarded by `if (chapterId === id) return`).
 *   - Show the chapter name as the page title once chapters are loaded; falls back to
 *     the string "Chapter" while loading.
 *
 * State:
 *   chapters  — full chapter list used to populate the move-to-chapter selector.
 *   rooms     — mentor rooms in this chapter (null = loading).
 *   closing   — the room object for which the CloseRoomDialog is open, or null.
 *   busyCode  — the room code currently being reopened (shows loading on its button).
 *
 * Data flow:
 *   mount / id change → load() → api.chapters() + api.myRooms() → set state
 *   create → api.createRoom({ type: 'mentor', chapterId: id }) → load()
 *   reopen → api.openRoom(code)              → load()
 *   close  → api.closeRoom(code, name)       → load()
 *   move   → api.patchRoom(code, {chapterId}) → load()
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/http.js';
import { HubLayout } from '../components/hubs/HubLayout.jsx';
import { RoomCard } from '../components/hubs/RoomCard.jsx';
import { CreateRoomModal } from '../components/hubs/CreateRoomModal.jsx';
import { CloseRoomDialog } from '../components/lifecycle/CloseRoomDialog.jsx';
import { Button } from '../components/shared/Button.jsx';
import { EmptyState } from '../components/shared/EmptyState.jsx';
import { Icon } from '../components/shared/icons.jsx';
import { useToast } from '../hooks/useToast.jsx';

export function ChapterPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const [chapters, setChapters] = useState([]);
  const [rooms, setRooms] = useState(null); // null = loading
  const [showCreate, setShowCreate] = useState(false);
  const [closing, setClosing] = useState(null); // room object pending close confirmation
  const [busyCode, setBusyCode] = useState(null); // room code currently being reopened

  // Derive the current chapter from the full list to avoid a separate fetch.
  const chapter = useMemo(() => chapters.find((c) => c.id === id), [chapters, id]);

  const load = useCallback(async () => {
    try {
      const [{ chapters: chList }, { rooms: roomList }] = await Promise.all([
        // Fetch all chapters (including archived) so the move-to-chapter select is complete.
        api.chapters({ includeArchived: true }),
        api.myRooms({ type: 'mentor', chapterId: id }),
      ]);
      setChapters(chList);
      setRooms(roomList);
    } catch (err) {
      toast(err.message || 'Could not load chapter', { variant: 'error' });
      setRooms([]);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  /** Create a new mentor room under the current chapter. */
  const createRoom = async (title) => {
    await api.createRoom({ type: 'mentor', title, chapterId: id });
    await load();
  };

  /** Reopen a closed room: calls POST /api/rooms/:code/open. */
  const reopen = async (code) => {
    setBusyCode(code);
    try {
      await api.openRoom(code);
      toast('Room reopened', { variant: 'success' });
      await load();
    } catch (err) {
      toast(err.message || 'Could not reopen', { variant: 'error' });
    } finally {
      setBusyCode(null);
    }
  };

  /** Confirm closing the room with an optional session name from CloseRoomDialog. */
  const confirmClose = async (sessionName) => {
    try {
      await api.closeRoom(closing.code, sessionName);
      toast('Room closed', { variant: 'success' });
      await load();
    } catch (err) {
      toast(err.message || 'Could not close', { variant: 'error' });
    }
  };

  /**
   * Move a room to a different chapter by PATCHing chapterId.
   * Short-circuits when the selected chapter is the current one.
   */
  const move = async (code, chapterId) => {
    if (chapterId === id) return;
    try {
      await api.patchRoom(code, { chapterId });
      toast('Room moved', { variant: 'success' });
      await load();
    } catch (err) {
      toast(err.message || 'Could not move room', { variant: 'error' });
    }
  };

  return (
    <HubLayout
      title={chapter?.name || 'Chapter'}
      subtitle={chapter?.description || 'Course rooms in this chapter'}
      action={
        <Button onClick={() => setShowCreate(true)}>
          <Icon.Plus width={16} height={16} />
          New room
        </Button>
      }
    >
      {rooms === null ? (
        <p className="py-10 text-center text-sm text-muted">Loading…</p>
      ) : rooms.length === 0 ? (
        <EmptyState icon={Icon.Cap} title="No rooms in this chapter">
          Create a course room (e.g. “Lists”) — reopen it any week with all history intact.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {rooms.map((room) => (
            <RoomCard
              key={room.code}
              room={room}
              busy={busyCode === room.code}
              onReopen={reopen}
              onCloseClick={setClosing}
              // Exclude fully archived chapters from the move selector, unless it is the
              // current chapter (so the room's existing home is always visible in the list).
              chapters={chapters.filter((c) => !c.archived || c.id === id)}
              onMove={move}
            />
          ))}
        </div>
      )}

      <CreateRoomModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={createRoom}
        kind="mentor"
      />
      <CloseRoomDialog
        open={!!closing}
        onClose={() => setClosing(null)}
        onConfirm={confirmClose}
      />
    </HubLayout>
  );
}
