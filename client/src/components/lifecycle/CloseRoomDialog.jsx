import { useState } from 'react';
import { Modal } from '../shared/Modal.jsx';
import { Button } from '../shared/Button.jsx';

/**
 * Close-room flow (spec section 11.3): asks for a session name. "Skip" keeps the
 * default name. Confirms that open polls will close and the room stops accepting items.
 */
export function CloseRoomDialog({ open, onClose, onConfirm }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (sessionName) => {
    setBusy(true);
    try {
      await onConfirm(sessionName);
      setName('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Close this room?">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Closing ends the current session. Open polls will close and the room will stop
          accepting new questions and votes. Everyone keeps read access, and you can reopen it
          later with all content intact.
        </p>
        <div>
          <label htmlFor="session-name" className="mb-1 block text-sm font-medium text-fg">
            Name this session <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="session-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 100))}
            placeholder="e.g. Week 1 — Intro"
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:bg-surface"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => run(undefined)} loading={busy}>
            Skip &amp; close
          </Button>
          <Button variant="danger" onClick={() => run(name.trim() || undefined)} loading={busy}>
            Close room
          </Button>
        </div>
      </div>
    </Modal>
  );
}
