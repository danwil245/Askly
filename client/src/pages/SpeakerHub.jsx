import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/http.js';
import { HubLayout } from '../components/hubs/HubLayout.jsx';
import { RoomCard } from '../components/hubs/RoomCard.jsx';
import { CreateRoomModal } from '../components/hubs/CreateRoomModal.jsx';
import { CloseRoomDialog } from '../components/lifecycle/CloseRoomDialog.jsx';
import { Button } from '../components/shared/Button.jsx';
import { EmptyState } from '../components/shared/EmptyState.jsx';
import { Icon } from '../components/shared/icons.jsx';
import { useToast } from '../hooks/useToast.jsx';

export function SpeakerHub() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rooms, setRooms] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [closing, setClosing] = useState(null); // room pending close
  const [busyCode, setBusyCode] = useState(null);

  const load = useCallback(async () => {
    try {
      const { rooms: list } = await api.myRooms({ type: 'qa' });
      setRooms(list);
    } catch (err) {
      toast(err.message || 'Could not load rooms', { variant: 'error' });
      setRooms([]);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const createRoom = async (title) => {
    const { room } = await api.createRoom({ type: 'qa', title });
    navigate(`/host/${room.code}`);
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

  return (
    <HubLayout
      title="Speaker & Audience"
      subtitle="Live Q&A and polls. Create a room, share the code, and moderate in real time."
      action={
        <Button onClick={() => setShowCreate(true)}>
          <Icon.Plus width={16} height={16} />
          Create a room
        </Button>
      }
    >
      {rooms === null ? (
        <p className="py-10 text-center text-sm text-muted">Loading your rooms…</p>
      ) : rooms.length === 0 ? (
        <EmptyState icon={Icon.Mic} title="No rooms yet">
          Create your first Q&A room to start collecting questions and running polls.
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
            />
          ))}
        </div>
      )}

      <CreateRoomModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={createRoom}
        kind="Q&A"
      />
      <CloseRoomDialog
        open={!!closing}
        onClose={() => setClosing(null)}
        onConfirm={confirmClose}
      />
    </HubLayout>
  );
}
