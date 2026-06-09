export function CountdownRing({
  value,
  unit,
  size = 120,
  total = 61,
  tone = "amber",
}: {
  value: number;
  unit: string;
  size?: number;
  total?: number;
  tone?: "amber" | "green";
}) {
  const radius = size * 0.383;
  const circ = 2 * Math.PI * radius;
  const elapsed = Math.max(0, total - value);
  const arc = circ * Math.min(elapsed / total, 1);
  const stroke = tone === "green" ? "#46d39b" : "#ffa500";
  const glow = tone === "green" ? "#1d9e75aa" : "#f59e0baa";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle at 40% 35%, #1c1c35, #0b0b1a)" }}
      />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#26264a" strokeWidth={size * 0.075} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={size * 0.075}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - arc}
          style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">Starts In</span>
        <span
          className="font-display font-black leading-none"
          style={{ fontSize: size * 0.3, color: stroke, textShadow: `0 0 16px ${glow}` }}
        >
          {value}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">{unit}</span>
      </div>
    </div>
  );
}
