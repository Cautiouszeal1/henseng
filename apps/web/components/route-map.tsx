import type { PublicChain, RegistryResult } from "@/lib/registry";

/**
 * Hero visual: the real state of the HENSENG network registry, drawn as routes
 * into a single hub. Mainnet chains sit above the hub, testnets below. A route
 * is solid only when the chain is genuinely live; otherwise it is dashed.
 * This is the one animated moment on the homepage (routes draw in once).
 */
export function RouteMap({ registry }: { registry: RegistryResult }) {
  const W = 560;
  const H = 440;
  const hub = { x: 420, y: H / 2 };
  const chains: PublicChain[] = registry.status === "ok" ? registry.chains : [];
  const mainnet = chains.filter((c) => c.environment === "MAINNET");
  const testnet = chains.filter((c) => c.environment === "TESTNET");

  const place = (list: PublicChain[], top: boolean) =>
    list.map((c, i) => {
      const span = top ? [52, 180] : [272, 400];
      const step = list.length > 1 ? (span[1]! - span[0]!) / (list.length - 1) : 0;
      return { chain: c, x: 28, y: list.length > 1 ? span[0]! + step * i : (span[0]! + span[1]!) / 2 };
    });
  const nodes = [...place(mainnet, true), ...place(testnet, false)];
  const liveCount = chains.filter((c) => c.supported).length;

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="route-map-title route-map-desc">
        <title id="route-map-title">HENSENG network status</title>
        <desc id="route-map-desc">
          {registry.status === "ok"
            ? `${chains.length} networks in the registry, ${liveCount} live.`
            : "The network registry is currently unavailable."}
        </desc>
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#1e2a4d" strokeDasharray="2 6" />
        <text x="28" y="18" fill="#5d6a8c" fontSize="12">Mainnet</text>
        <text x="28" y={H / 2 + 26} fill="#5d6a8c" fontSize="12">Testnet</text>

        {nodes.map(({ chain, x, y }, i) => {
          const color = chain.environment === "MAINNET" ? "#2f6bff" : "#8b6cff";
          const startX = x + 150;
          const d = `M ${startX} ${y} C ${startX + 120} ${y}, ${hub.x - 110} ${hub.y}, ${hub.x - 18} ${hub.y}`;
          return (
            <g key={chain.id}>
              <path
                d={d}
                fill="none"
                stroke={chain.supported ? color : "#2c3b68"}
                strokeWidth={chain.supported ? 2 : 1.25}
                strokeDasharray={chain.supported ? undefined : "4 6"}
                className="route-draw"
                style={{ animationDelay: `${120 + i * 90}ms` }}
              />
              <rect x={x} y={y - 17} width="150" height="34" rx="6" fill="#0e1530" stroke={chain.supported ? color : "#1e2a4d"} />
              <circle cx={x + 16} cy={y} r="4" fill={chain.supported ? "#3fd0e0" : "#2c3b68"} />
              <text x={x + 30} y={y + 4.5} fill={chain.supported ? "#eef2fa" : "#8d99b8"} fontSize="13">
                {chain.name}
              </text>
            </g>
          );
        })}

        <circle cx={hub.x} cy={hub.y} r="18" fill="#070b1a" stroke="#3fd0e0" strokeWidth="2" />
        <circle cx={hub.x} cy={hub.y} r="5" fill="#3fd0e0" />
        <path d={`M ${hub.x + 18} ${hub.y} H ${W - 8}`} stroke="#eef2fa" strokeWidth="2" strokeLinecap="round" className="route-draw" style={{ animationDelay: "700ms" }} />
        <text x={hub.x - 24} y={hub.y + 42} fill="#8d99b8" fontSize="12">HENSENG</text>

        {registry.status !== "ok" && (
          <text x="28" y={H / 2 + 4} fill="#f2b84b" fontSize="13">Network registry unavailable</text>
        )}
      </svg>
      <figcaption className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-muted">
        <span className="flex items-center gap-2">
          <svg width="28" height="4" aria-hidden><line x1="0" x2="28" y1="2" y2="2" stroke="#2f6bff" strokeWidth="2" /></svg>
          Live
        </span>
        <span className="flex items-center gap-2">
          <svg width="28" height="4" aria-hidden><line x1="0" x2="28" y1="2" y2="2" stroke="#2c3b68" strokeWidth="1.25" strokeDasharray="4 6" /></svg>
          In the registry, not live yet
        </span>
        <span className="text-ink-faint">
          {registry.status === "ok" ? `${liveCount} of ${chains.length} networks live` : "Status unknown"}
        </span>
      </figcaption>
      <style>{`
        .route-draw { stroke-dashoffset: 0; animation: route-in 900ms cubic-bezier(.2,.7,.2,1) both; }
        @keyframes route-in { from { opacity: 0; clip-path: inset(0 100% 0 0); } to { opacity: 1; clip-path: inset(0 0 0 0); } }
      `}</style>
    </figure>
  );
}
