/**
 * CreateChapterModal — modal form for creating a new chapter in the Mentor Rooms hub.
 *
 * Responsibilities:
 *   - Collect chapter name (required, max 80 chars) and optional description (max 300).
 *   - Client-side character limits are enforced via `.slice()` in onChange to mirror the
 *     server-side schema constraints.
 *   - On submit: trim, validate name is non-empty, call `onCreate(payload)` (provided by
 *     MentorHub which calls api.createChapter), then reset fields and close the modal.
 *   - Display API error messages (e.g. duplicate name) in an inline error paragraph.
 *   - Disable the submit button while the name field is empty; show a loading spinner
 *     during the async create request.
 *
 * Props:
 *   open     — boolean controlling modal visibility.
 *   onClose  — callback invoked when the user cancels or after successful creation.
 *   onCreate — async callback(payload) that performs the API call; any thrown error
 *              is caught here and displayed to the user.
 */
import { useState } from 'react';
import { Modal } from '../shared/Modal.jsx';
import { Button } from '../shared/Button.jsx';

export function CreateChapterModal({ open, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError('Give the chapter a name.');
    setBusy(true);
    setError('');
    try {
      await onCreate({ name: n, description: description.trim() });
      // Reset form fields on success before closing.
      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      setError(err.message || 'Could not create the chapter.');
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:bg-surface';

  return (
    <Modal open={open} onClose={onClose} title="Create a chapter">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="chapter-name" className="mb-1 block text-sm font-medium text-fg">
            Name
          </label>
          <input
            id="chapter-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 80))}
            placeholder="e.g. Data Structures"
            autoFocus
            className={field}
          />
        </div>
        <div>
          <label htmlFor="chapter-desc" className="mb-1 block text-sm font-medium text-fg">
            Description <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="chapter-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 300))}
            rows={2}
            placeholder="What this chapter covers"
            className={`${field} resize-none`}
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
          <Button type="submit" loading={busy} disabled={!name.trim()}>
            Create chapter
          </Button>
        </div>
      </form>
    </Modal>
  );
}
