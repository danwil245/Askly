import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/http.js';
import { HubLayout } from '../components/hubs/HubLayout.jsx';
import { Button } from '../components/shared/Button.jsx';
import { EmptyState } from '../components/shared/EmptyState.jsx';
import { Icon } from '../components/shared/icons.jsx';
import { useToast } from '../hooks/useToast.jsx';

const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

function SummaryChips({ summary }) {
  if (!summary) return null;
  const entries = Object.entries(summary);
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {entries.map(([k, v]) => (
        <span key={k} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
          <span className="tabular font-semibold text-fg">{v}</span> {k}
        </span>
      ))}
    </div>
  );
}

function SessionRow({ session, onRename }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(session.name);

  const save = async () => {
    const clean = name.trim();
    if (clean && clean !== session.name) await onRename(session.id, clean);
    setEditing(false);
  };

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 100))}
                className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm"
                autoFocus
              />
              <Button size="sm" onClick={save}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-base font-semibold">{session.name}</h3>
              <button
                onClick={() => {
                  setName(session.name);
                  setEditing(true);
                }}
                className="text-xs text-muted hover:text-fg hover:underline"
              >
                Rename
              </button>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  session.status === 'active'
                    ? 'bg-success/15 text-success'
                    : 'bg-surface-2 text-muted'
                }`}
              >
                {session.status}
              </span>
            </div>
          )}
          <p className="mt-1 text-xs text-muted">
            {fmt(session.startedAt)} → {session.endedAt ? fmt(session.endedAt) : 'ongoing'}
          </p>
          <SummaryChips summary={session.summary} />
        </div>
        <Link to={`/history/session/${session.id}`}>
          <Button variant="outline" size="sm">
            View report
          </Button>
        </Link>
      </div>
    </li>
  );
}

export function History() {
  const { roomCode } = useParams();
  const { toast } = useToast();
  const [sessions, setSessions] = useState(null);

  const load = useCallback(async () => {
    try {
      const { sessions: list } = await api.roomSessions(roomCode);
      setSessions(list);
    } catch (err) {
      toast(err.message || 'Could not load history', { variant: 'error' });
      setSessions([]);
    }
  }, [roomCode, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const rename = async (id, name) => {
    try {
      await api.renameSession(id, name);
      toast('Session renamed', { variant: 'success' });
      await load();
    } catch (err) {
      toast(err.message || 'Could not rename', { variant: 'error' });
    }
  };

  return (
    <HubLayout title="Session history" subtitle={`Room ${roomCode}`}>
      {sessions === null ? (
        <p className="py-10 text-center text-sm text-muted">Loading…</p>
      ) : sessions.length === 0 ? (
        <EmptyState icon={Icon.Clock} title="No sessions yet">
          Sessions appear here once the room has been opened.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} onRename={rename} />
          ))}
        </ul>
      )}
    </HubLayout>
  );
}
