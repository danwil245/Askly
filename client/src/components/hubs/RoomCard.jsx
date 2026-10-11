import { Link } from 'react-router-dom';
import { Button } from '../shared/Button.jsx';
import { Icon } from '../shared/icons.jsx';

const TYPE_LABEL = { qa: 'Q&A', mentor: 'Mentor', quiz: 'Quiz' };

const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

/** A room row in a hub: title, type/status, current session, lifecycle actions. */
export function RoomCard({ room, onReopen, onCloseClick, busy, chapters, onMove }) {
  const open = room.status === 'open';
  return (
    <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-heading text-base font-semibold">{room.title}</h3>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
            {TYPE_LABEL[room.type] || room.type}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              open ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-success' : 'bg-muted'}`} />
            {open ? 'Open' : 'Closed'}
          </span>
        </div>
        <p className="mt-1 flex items-center gap-2 text-xs text-muted">
          <span className="font-mono tracking-wide text-fg">{room.code}</span>
          {room.currentSession?.name && open && <span>· {room.currentSession.name}</span>}
          {room.lastActivityAt && (
            <span className="inline-flex items-center gap-1">
              · <Icon.Clock width={12} height={12} /> {timeAgo(room.lastActivityAt)}
            </span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {chapters && onMove && (
          <select
            value={room.chapterId || ''}
            onChange={(e) => onMove(room.code, e.target.value)}
            aria-label="Move to chapter"
            className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs text-fg"
          >
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <Link to={`/history/${room.code}`}>
          <Button variant="ghost" size="sm">
            History
          </Button>
        </Link>
        {open ? (
          <>
            <Link to={`/host/${room.code}`}>
              <Button variant="outline" size="sm">
                Open dashboard
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => onCloseClick(room)}>
              <Icon.Lock width={14} height={14} />
              Close
            </Button>
          </>
        ) : (
          <Button size="sm" loading={busy} onClick={() => onReopen(room.code)}>
            Reopen
          </Button>
        )}
      </div>
    </div>
  );
}
