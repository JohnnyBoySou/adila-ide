import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SAMPLE_MS = 500;

function fpsClass(fps: number): string {
  if (fps >= 55) return "text-green-400";
  if (fps >= 40) return "text-amber-400";
  return "text-red-400";
}

export function FpsMeter() {
  const [fps, setFps] = useState(0);
  const [min, setMin] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);
  const framesRef = useRef(0);
  const lastSampleRef = useRef(performance.now());
  const minRef = useRef<number | null>(null);

  useEffect(() => {
    function tick(now: number) {
      framesRef.current += 1;
      const elapsed = now - lastSampleRef.current;
      if (elapsed >= SAMPLE_MS) {
        const sample = Math.round((framesRef.current * 1000) / elapsed);
        setFps(sample);
        if (minRef.current === null || sample < minRef.current) {
          minRef.current = sample;
          setMin(sample);
        }
        framesRef.current = 0;
        lastSampleRef.current = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      className="fixed top-2 right-2 z-[100] pointer-events-none rounded-md bg-background/85 backdrop-blur border border-border/60 px-2 py-1 font-mono text-[10px] tabular-nums shadow-md"
      role="status"
      aria-label={`${fps} FPS`}
    >
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-sm font-semibold leading-none", fpsClass(fps))}>{fps}</span>
        <span className="text-muted-foreground">fps</span>
      </div>
      <div className="text-muted-foreground/70 text-[9px] mt-0.5">min {min}</div>
    </div>
  );
}
