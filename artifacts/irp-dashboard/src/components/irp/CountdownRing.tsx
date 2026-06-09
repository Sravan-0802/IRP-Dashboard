const TONES = {
  blue: { from: "#3b82f6", to: "#6741d9", track: "rgba(59,91,219,0.1)", text: "#3b5bdb" },
  teal: { from: "#0ca678", to: "#2f9e44", track: "rgba(12,166,120,0.12)", text: "#0ca678" },
  pink: { from: "#e64980", to: "#9c36b5", track: "rgba(230,73,128,0.12)", text: "#e64980" },
} as const;

export function CountdownRing({
  value,
  unit,
  size = 120,
  total = 61,
  tone = "blue",
  label = "Starts In",
}: {
  value: number;
  unit: string;
  size?: number;
  total?: number;
  tone?: keyof typeof TONES;
  label?: string;
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
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-display font-black leading-none"
          style={{ fontSize: size * 0.34, color: t.text }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
