import { useState } from 'react';
import { Modal } from '../shared/Modal.jsx';
import { Button } from '../shared/Button.jsx';

/**
 * Create a qa/mentor room. For mentor rooms the chapter is fixed by the caller
 * (passed via `chapterId`), so only the title is collected here.
 */
export function CreateRoomModal({ open, onClose, onCreate, kind = 'Q&A' }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return setError('Give your room a title.');
    setBusy(true);
    setError('');
    try {
      await onCreate(t);
      setTitle('');
      onClose();
    } catch (err) {
      setError(err.message || 'Could not create the room.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Create a ${kind} room`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="new-room-title" className="mb-1 block text-sm font-medium text-fg">
            Room title
          </label>
          <input
            id="new-room-title"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder="e.g. Q3 All-Hands"
            autoFocus
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:bg-surface"
          />
        </div>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!title.trim()}>
            Create room
          </Button>
        </div>
      </form>
    </Modal>
  );
}
