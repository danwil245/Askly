import { Link } from 'react-router-dom';
import { Button } from '../components/shared/Button.jsx';
import { Logo } from '../components/shared/Logo.jsx';
import { Icon } from '../components/shared/icons.jsx';

export function RoomNotFound({ code }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
      <Logo className="mb-8" />
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-muted">
        <Icon.X width={28} height={28} />
      </span>
      <h1 className="font-heading text-2xl font-bold">Room not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        {code ? (
          <>
            We couldn’t find a room with the code{' '}
            <span className="font-mono font-semibold">{code}</span>. Double-check it and try again.
          </>
        ) : (
          'That room doesn’t exist.'
        )}
      </p>
      <Link to="/" className="mt-6">
        <Button variant="outline">Back to home</Button>
      </Link>
    </div>
  );
}
