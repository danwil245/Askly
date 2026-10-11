import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/http.js';
import { HubLayout } from '../components/hubs/HubLayout.jsx';
import { ChapterCard } from '../components/hubs/ChapterCard.jsx';
import { CreateChapterModal } from '../components/hubs/CreateChapterModal.jsx';
import { Button } from '../components/shared/Button.jsx';
import { EmptyState } from '../components/shared/EmptyState.jsx';
import { Icon } from '../components/shared/icons.jsx';
import { useToast } from '../hooks/useToast.jsx';

export function MentorHub() {
  const { toast } = useToast();
  const [chapters, setChapters] = useState(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const { chapters: list } = await api.chapters({ includeArchived });
      setChapters(list);
    } catch (err) {
      toast(err.message || 'Could not load chapters', { variant: 'error' });
      setChapters([]);
    }
  }, [includeArchived, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (payload) => {
    await api.createChapter(payload);
    await load();
  };

  const archiveToggle = async (chapter) => {
    setBusyId(chapter.id);
    try {
      await api.patchChapter(chapter.id, { archived: !chapter.archived });
      await load();
    } catch (err) {
      toast(err.message || 'Could not update chapter', { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <HubLayout
      title="Mentor Rooms"
      subtitle="Organize reusable course rooms into chapters. Reopen a room anytime — all content stays."
      action={
        <Button onClick={() => setShowCreate(true)}>
          <Icon.Plus width={16} height={16} />
          New chapter
        </Button>
      }
    >
      <label className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(e) => setIncludeArchived(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Show archived
      </label>

      {chapters === null ? (
        <p className="py-10 text-center text-sm text-muted">Loading…</p>
      ) : chapters.length === 0 ? (
        <EmptyState icon={Icon.Cap} title="No chapters yet">
          Create a chapter (e.g. a course) to hold your reusable mentor rooms.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chapters.map((c) => (
            <ChapterCard
              key={c.id}
              chapter={c}
              busy={busyId === c.id}
              onArchiveToggle={archiveToggle}
            />
          ))}
        </div>
      )}

      <CreateChapterModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={create}
      />
    </HubLayout>
  );
}
