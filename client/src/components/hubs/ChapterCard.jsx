import { Link } from 'react-router-dom';
import { Button } from '../shared/Button.jsx';
import { Icon } from '../shared/icons.jsx';

/** A chapter tile in the mentor hub. */
export function ChapterCard({ chapter, onArchiveToggle, busy }) {
  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <Link to={`/mentor/chapters/${chapter.id}`} className="min-w-0 flex-1">
          <h3 className="truncate font-heading text-lg font-semibold hover:text-primary">
            {chapter.name}
          </h3>
        </Link>
        {chapter.archived && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">Archived</span>
        )}
      </div>
      {chapter.description && (
        <p className="mt-1 line-clamp-2 text-sm text-muted">{chapter.description}</p>
      )}
      <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
        <Icon.Cap width={14} height={14} />
        {chapter.roomCount} {chapter.roomCount === 1 ? 'room' : 'rooms'}
      </p>
      <div className="mt-4 flex items-center gap-2">
        <Link to={`/mentor/chapters/${chapter.id}`}>
          <Button variant="outline" size="sm">
            Open
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          loading={busy}
          onClick={() => onArchiveToggle(chapter)}
        >
          {chapter.archived ? 'Unarchive' : 'Archive'}
        </Button>
      </div>
    </div>
  );
}
