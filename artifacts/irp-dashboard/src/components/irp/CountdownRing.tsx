const TONES = {
  blue: { from: "#818cf8", to: "#a855f7", track: "rgba(139,92,246,0.12)", text: "#8b5cf6" },
  teal: { from: "#22d3ee", to: "#a855f7", track: "rgba(34,211,238,0.14)", text: "#06b6d4" },
  pink: { from: "#f472b6", to: "#ec4899", track: "rgba(236,72,153,0.14)", text: "#ec4899" },
  neon: { from: "#22d3ee", to: "#ec4899", track: "rgba(232,121,249,0.14)", text: "#d946ef" },
} as const;

export function CountdownRing({
  value,
  unit,
  size = 120,
  total = 61,
  tone = "blue",
  showUnit = false,
}: {
  value: number;
  unit: string;
  size?: number;
  total?: number;
  tone?: keyof typeof TONES;
  showUnit?: boolean;
}) {
  const radius = size * 0.383;
  const circ = 2 * Math.PI * radius;
  const elapsed = Math.max(0, total - value);
  const arc = circ * Math.min(elapsed / total, 1);
  const t = TONES[tone];
  const gid = `cd-${tone}`;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={t.from} />
            <stop offset="100%" stopColor={t.to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={t.track} strokeWidth={size * 0.07} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={size * 0.07}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - arc}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display font-black leading-none"
          style={{ fontSize: size * (showUnit ? 0.3 : 0.34), color: t.text }}
        >
          {value}
        </span>
        {showUnit && (
          <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#6e6a8a]">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
