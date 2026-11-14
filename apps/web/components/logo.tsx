/** HENSENG mark: two route paths meeting at one node — swap and bridge converge. */
export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
        <path d="M2 6c6 0 7 7 11 7" stroke="#2f6bff" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M2 20c6 0 7-7 11-7" stroke="#8b6cff" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M13 13h11" stroke="#eef2fa" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="13" cy="13" r="3" fill="#070b1a" stroke="#3fd0e0" strokeWidth="2" />
      </svg>
      {withWordmark && <span className="text-[15px] font-semibold tracking-[0.14em] text-ink">HENSENG</span>}
    </span>
  );
}
