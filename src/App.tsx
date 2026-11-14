import { useEffect } from 'react';
import { LunarScene } from './scene/LunarScene';
import { useRegolithStore } from './state/store';
import { MissionHUD } from './ui/planner/MissionHUD';

export function App() {
  const loaded = useRegolithStore((s) => s.loaded);
  const loadingStatus = useRegolithStore((s) => s.loadingStatus);
  const error = useRegolithStore((s) => s.error);
  const loadAssets = useRegolithStore((s) => s.loadAssets);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#06080d]">
      {!loaded ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#f5b041] border-t-transparent" />
          <div className="text-sm font-semibold tracking-wider text-slate-200">
            REGOLITH<span className="text-[#f5b041]">FORGE</span>
          </div>
          <div className="font-mono-num text-xs text-slate-400">
            {error ? `ERROR: ${error}` : loadingStatus}
          </div>
        </div>
      ) : (
        <>
          <LunarScene />
          <MissionHUD />
        </>
      )}
    </main>
  );
}

export default App;
