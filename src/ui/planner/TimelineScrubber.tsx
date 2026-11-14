import { FastForward, Pause, Play, Radio, Sunrise, Sunset } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useRegolithStore } from '../../state/store';

export function TimelineScrubber() {
  const ephemeris = useRegolithStore((s) => s.ephemeris);
  const activeEphemerisKey = useRegolithStore((s) => s.activeEphemerisKey);
  const stepIndex = useRegolithStore((s) => s.stepIndex);
  const isPlaying = useRegolithStore((s) => s.isPlaying);
  const playbackSpeed = useRegolithStore((s) => s.playbackSpeed);
  const powerStats = useRegolithStore((s) => s.powerStats);
  const dteStats = useRegolithStore((s) => s.dteStats);
  const colorBlindSafe = useRegolithStore((s) => s.colorBlindSafe);

  const setStepIndex = useRegolithStore((s) => s.setStepIndex);
  const setIsPlaying = useRegolithStore((s) => s.setIsPlaying);
  const setPlaybackSpeed = useRegolithStore((s) => s.setPlaybackSpeed);

  const steps = ephemeris?.sites[activeEphemerisKey]?.ephemeris ?? [];
  const maxStep = Math.max(0, steps.length - 1);
  const currentStep = steps[stepIndex];

  useEffect(() => {
    if (!isPlaying || steps.length === 0) return;
    const intervalMs = Math.max(40, Math.round(1000 / playbackSpeed));
    const timer = setInterval(() => {
      setStepIndex(useRegolithStore.getState().stepIndex + 1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, steps.length, setStepIndex]);

  // Jump-to helpers
  const jumpToNextEvent = (type: 'sunrise' | 'sunset' | 'dte') => {
    if (!powerStats || !dteStats || steps.length === 0) return;
    for (let offset = 1; offset <= steps.length; offset++) {
      const idx = (stepIndex + offset) % steps.length;
      const prevIdx = (idx - 1 + steps.length) % steps.length;

      if (type === 'sunrise') {
        if (powerStats.hourlyIllumination[prevIdx] <= 0.05 && powerStats.hourlyIllumination[idx] > 0.05) {
          setStepIndex(idx);
          return;
        }
      } else if (type === 'sunset') {
        if (powerStats.hourlyIllumination[prevIdx] > 0.05 && powerStats.hourlyIllumination[idx] <= 0.05) {
          setStepIndex(idx);
          return;
        }
      } else if (type === 'dte') {
        if (dteStats.hourlyVisible[prevIdx] === 0 && dteStats.hourlyVisible[idx] === 1) {
          setStepIndex(idx);
          return;
        }
      }
    }
  };

  // Downsampled 180-segment event strip (4-hour blocks) for crisp rendering
  const eventBlocks = useMemo(() => {
    if (!powerStats || !dteStats) return [];
    const blocks: { sunlit: boolean; dte: boolean }[] = [];
    for (let i = 0; i < powerStats.hourlyIllumination.length; i += 4) {
      blocks.push({
        sunlit: powerStats.hourlyIllumination[i] > 0.1,
        dte: dteStats.hourlyVisible[i] === 1,
      });
    }
    return blocks;
  }, [powerStats, dteStats]);

  return (
    <div className="flex flex-col gap-1.5 border-t border-[#1c2230] bg-[#06080d]/95 px-4 py-2">
      {/* Top row: Playback controls + UTC readout + Jump buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex h-7 w-7 items-center justify-center rounded border border-[#1c2230] bg-[#0e131d] text-slate-200 hover:border-[#f5b041]/60 hover:text-[#f5b041]"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>

          <div className="flex items-center rounded border border-[#1c2230] bg-[#0e131d] text-[10px] font-mono-num">
            {[1, 6, 24].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-2 py-1 ${
                  playbackSpeed === spd
                    ? 'bg-[#f5b041]/20 text-[#f5b041]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
            <FastForward className="mx-1.5 h-3 w-3 text-slate-500" />
          </div>

          <div className="ml-2 flex items-baseline gap-2">
            <span className="text-xs font-mono-num font-medium text-slate-100">
              {currentStep ? currentStep.utc_time : '2026-Oct-01 00:00'} UTC
            </span>
            <span className="text-[10px] font-mono-num text-slate-400">
              T+{stepIndex}h / {maxStep}h (Day {(stepIndex / 24).toFixed(1)})
            </span>
          </div>
        </div>

        {/* Jump-to event buttons */}
        <div className="flex items-center gap-1.5 text-[10px]">
          <button
            onClick={() => jumpToNextEvent('sunrise')}
            className="flex items-center gap-1 rounded border border-[#1c2230] bg-[#0e131d] px-2 py-1 text-slate-300 hover:border-[#f5b041]/50 hover:text-[#f5b041]"
          >
            <Sunrise className="h-3 w-3 text-[#f5b041]" /> Next Sunrise
          </button>
          <button
            onClick={() => jumpToNextEvent('sunset')}
            className="flex items-center gap-1 rounded border border-[#1c2230] bg-[#0e131d] px-2 py-1 text-slate-300 hover:border-slate-500"
          >
            <Sunset className="h-3 w-3 text-amber-500" /> Next Sunset
          </button>
          <button
            onClick={() => jumpToNextEvent('dte')}
            className="flex items-center gap-1 rounded border border-[#1c2230] bg-[#0e131d] px-2 py-1 text-slate-300 hover:border-[#93c5fd]/50 hover:text-[#93c5fd]"
          >
            <Radio className="h-3 w-3 text-[#93c5fd]" /> Next DTE
          </button>
        </div>
      </div>

      {/* Event Strip: Sunlit & DTE bands */}
      <div className="flex flex-col gap-0.5">
        <div className="flex h-1.5 w-full overflow-hidden rounded-sm bg-[#0e131d]" title="Solar Illumination Band (Gold = Sunlit)">
          {eventBlocks.map((b, i) => (
            <div
              key={i}
              className="h-full flex-1"
              style={{
                backgroundColor: b.sunlit ? '#f5b041' : '#111827',
                opacity: b.sunlit ? 0.85 : 1,
              }}
            />
          ))}
        </div>
        <div className="flex h-1.5 w-full overflow-hidden rounded-sm bg-[#0e131d]" title="DTE Geometric LOS Band (Blue = Earth Visible, Red = Blackout)">
          {eventBlocks.map((b, i) => (
            <div
              key={i}
              className="h-full flex-1"
              style={{
                backgroundColor: b.dte
                  ? '#93c5fd'
                  : colorBlindSafe
                  ? '#9a3412'
                  : '#7f1d1d',
                opacity: b.dte ? 0.85 : 0.55,
              }}
            />
          ))}
        </div>
      </div>

      {/* Range Slider */}
      <input
        type="range"
        min={0}
        max={maxStep}
        value={stepIndex}
        onChange={(e) => setStepIndex(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-[#f5b041]"
        aria-label="Mission timeline hour scrubber"
      />
    </div>
  );
}
