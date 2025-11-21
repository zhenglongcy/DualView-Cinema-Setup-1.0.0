import React from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

interface ControlBarProps {
  isPlaying: boolean;
  isFullscreen: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  onMuteAll: () => void;
  onUnmuteAll: () => void;
  onToggleFullscreen: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isPlaying,
  isFullscreen,
  onPlayPause,
  onReset,
  onMuteAll,
  onUnmuteAll,
  onToggleFullscreen
}) => {
  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-white/80 dark:bg-slate-800/50 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 fixed bottom-0 left-0 right-0 z-50 shadow-xl transition-colors">
      <div className="flex items-center gap-2">
        <button
          onClick={onReset}
          className="p-3 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white transition-all active:scale-95"
          title="Reset Both"
        >
          <RotateCcw size={20} />
        </button>

        <button
          onClick={onPlayPause}
          className="p-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition-all active:scale-95 flex items-center justify-center min-w-[64px]"
          title={isPlaying ? "Pause Both" : "Play Both"}
        >
          {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
        </button>

        <div className="w-px h-8 bg-slate-300 dark:bg-slate-600 mx-2"></div>

        <button
          onClick={onUnmuteAll}
          className="p-3 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white transition-all active:scale-95"
          title="Unmute Both"
        >
          <Volume2 size={20} />
        </button>
        <button
          onClick={onMuteAll}
          className="p-3 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white transition-all active:scale-95"
          title="Mute Both"
        >
          <VolumeX size={20} />
        </button>

        <div className="w-px h-8 bg-slate-300 dark:bg-slate-600 mx-2"></div>

        <button
          onClick={onToggleFullscreen}
          className="p-3 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white transition-all active:scale-95"
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
      </div>
    </div>
  );
};