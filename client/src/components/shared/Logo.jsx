// Askly wordmark: a speech/poll glyph + the name in the display face.
export function Logo({ className = '', showWord = true }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-card">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 19V9M12 19V5M19 19v-6"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {showWord && (
        <span className="font-heading text-xl font-bold tracking-tight text-fg">Askly</span>
      )}
    </span>
  );
}
