import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../shared/Button.jsx';
import { Icon } from '../shared/icons.jsx';

/** Projector-friendly join panel: giant code, QR of the join URL, copy-link. */
export function JoinCodeCard({ code, joinPath = '/r/' }) {
  const [copied, setCopied] = useState(false);
  const audienceUrl = `${window.location.origin}${joinPath}${code}`;

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
    <section className="card" aria-label="Join information">
      <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 p-6">
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-sm font-medium uppercase tracking-wide text-muted">
            Join at <span className="font-semibold text-fg">{window.location.host}</span>
          </p>
          <p
            className="mt-1 font-mono text-4xl sm:text-5xl lg:text-6xl font-bold tracking-[0.12em] text-primary break-all"
            aria-label={`Join code ${code.split('').join(' ')}`}
          >
            {code}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2">
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

        <div className="shrink-0 rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-black/5 flex flex-col items-center">
          <QRCodeSVG
            value={audienceUrl}
            size={136}
            level="M"
            includeMargin={false}
            className="block"
          />
          <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Scan to join
          </span>
        </div>
      </div>
    </section>
  );
}
