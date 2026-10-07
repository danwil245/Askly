import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../shared/Button.jsx';
import { Icon } from '../shared/icons.jsx';

/** Projector-friendly join panel: giant code, QR of the audience URL, copy-link. */
export function JoinCodeCard({ code }) {
  const [copied, setCopied] = useState(false);
  const audienceUrl = `${window.location.origin}/r/${code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(audienceUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked; the URL is visible below regardless */
    }
  };

  return (
    <section className="card overflow-hidden" aria-label="Join information">
      <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted">
            Join at <span className="text-fg">{window.location.host}</span>
          </p>
          <p
            className="mt-1 font-mono text-6xl font-bold tracking-[0.15em] text-primary sm:text-7xl"
            aria-label={`Join code ${code.split('').join(' ')}`}
          >
            {code}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? (
                <Icon.Check width={16} height={16} />
              ) : (
                <Icon.Link width={16} height={16} />
              )}
              {copied ? 'Copied!' : 'Copy audience link'}
            </Button>
          </div>
        </div>

        <div className="justify-self-center rounded-2xl bg-white p-3 shadow-card">
          <QRCodeSVG value={audienceUrl} size={148} level="M" includeMargin={false} />
        </div>
      </div>
    </section>
  );
}
