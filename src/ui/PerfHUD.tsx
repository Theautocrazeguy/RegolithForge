import { useEffect, useState } from 'react';
import { useRegolithStore } from '../state/store';

export function PerfHUD({ visible }: { visible: boolean }) {
  const workerComputeMs = useRegolithStore((s) => s.workerComputeMs);
  const [fps, setFps] = useState(60);
  const [memMb, setMemMb] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    let frames = 0;
    let lastTime = performance.now();
    let rafId = 0;

    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - lastTime >= 500) {
        setFps(Math.round((frames * 1000) / (now - lastTime)));
        frames = 0;
        lastTime = now;
        const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        if (perfMem) {
          setMemMb(Math.round(perfMem.usedJSHeapSize / (1024 * 1024)));
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-12 z-40 flex -translate-x-1/2 items-center gap-3 rounded border border-[#1c2230] bg-[#06080d]/95 px-3 py-1 font-mono-num text-[10px] text-slate-300 shadow">
      <span className="text-emerald-400">{fps} FPS</span>
      <span className="text-slate-600">|</span>
      <span>Worker {workerComputeMs.toFixed(1)} ms</span>
      {memMb !== null && (
        <>
          <span className="text-slate-600">|</span>
          <span>Heap {memMb} MB</span>
        </>
      )}
    </div>
  );
}
