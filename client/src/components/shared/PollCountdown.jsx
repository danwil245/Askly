import { useEffect, useState } from 'react';

function remainingSeconds(closesAt) {
  return Math.max(0, Math.ceil((new Date(closesAt).getTime() - Date.now()) / 1000));
}

/** A display-only countdown. The server's closesAt check remains authoritative. */
export function PollCountdown({ closesAt }) {
  const [remaining, setRemaining] = useState(() => remainingSeconds(closesAt));

  useEffect(() => {
    const update = () => setRemaining(remainingSeconds(closesAt));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [closesAt]);

  if (remaining === 0) return <>Closing…</>;
  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, '0');
  return (
    <>
      {minutes}:{seconds} left
    </>
  );
}
