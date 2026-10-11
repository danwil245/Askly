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
  const [rooms, setRooms] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [closing, setClosing] = useState(null);
  const [busyCode, setBusyCode] = useState(null);

  const chapter = useMemo(() => chapters.find((c) => c.id === id), [chapters, id]);

  const load = useCallback(async () => {
    try {
      const [{ chapters: chList }, { rooms: roomList }] = await Promise.all([
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

  const createRoom = async (title) => {
    await api.createRoom({ type: 'mentor', title, chapterId: id });
    await load();
  };

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

  const confirmClose = async (sessionName) => {
    try {
      await api.closeRoom(closing.code, sessionName);
      toast('Room closed', { variant: 'success' });
      await load();
    } catch (err) {
      toast(err.message || 'Could not close', { variant: 'error' });
    }
  };

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
