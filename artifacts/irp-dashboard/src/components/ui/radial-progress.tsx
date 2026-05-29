import React from 'react';
import { cn } from '@/lib/utils';

interface RadialProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  size?: number;
  strokeWidth?: number;
  colorClass?: string;
  trackColorClass?: string;
  label?: string;
}

export function RadialProgress({
  value,
  size = 60,
  strokeWidth = 6,
  colorClass = "text-primary",
  trackColorClass = "text-secondary",
  label,
  className,
  ...props
}: RadialProgressProps) {
  const normalizedValue = Math.min(100, Math.max(0, value || 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (normalizedValue / 100) * circumference;

  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }} {...props}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          className={trackColorClass}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={cn(colorClass, "transition-all duration-1000 ease-out")}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none gap-0.5">
        <span className="font-black font-mono text-gray-900" style={{ fontSize: size * 0.18 }}>{Math.round(normalizedValue)}%</span>
        {label && <span className="text-gray-400 font-semibold" style={{ fontSize: size * 0.11 }}>{label}</span>}
      </div>
    </div>
  );
}
