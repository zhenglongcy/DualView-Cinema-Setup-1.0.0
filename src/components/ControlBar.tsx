import React from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Minimize, ChevronDown } from 'lucide-react';

interface ControlBarProps {
  isPlaying: boolean;
  isFullscreen: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  onMuteAll: () => void;
  onUnmuteAll: () => void;
  onToggleFullscreen: () => void;
  onCollapse: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isPlaying,
  isFullscreen,
  onPlayPause,
  onReset,
  onMuteAll,
  onUnmuteAll,
  onToggleFullscreen,
  onCollapse
}) => {
  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 fixed bottom-0 left-0 right-0 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] transition-all">
      <div className="flex items-center gap-2">
        <button
          onClick={onReset}
          className="p-3 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white transition-all active:scale-95"
          title="重置进度"
        >
          <RotateCcw size={20} />
        </button>

        <button
          onClick={onPlayPause}
          className="p-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition-all active:scale-95 flex items-center justify-center min-w-[64px]"
          title={isPlaying ? "暂停所有" : "同步播放"}
        >
          {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
        </button>

        <div className="w-px h-8 bg-slate-300 dark:bg-slate-600 mx-2"></div>

        <button
          onClick={onUnmuteAll}
          className="p-3 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white transition-all active:scale-95"
          title="全部取消静音"
        >
          <Volume2 size={20} />
        </button>
        <button
          onClick={onMuteAll}
          className="p-3 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white transition-all active:scale-95"
          title="全部静音"
        >
          <VolumeX size={20} />
        </button>

        <div className="w-px h-8 bg-slate-300 dark:bg-slate-600 mx-2"></div>

        <button
          onClick={onToggleFullscreen}
          className="p-3 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white transition-all active:scale-95"
          title={isFullscreen ? "退出应用全屏" : "应用全屏"}
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
      </div>

      {/* Collapse Button */}
      <button 
        onClick={onCollapse}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
        title="隐藏控制栏"
      >
        <ChevronDown size={24} />
      </button>
    </div>
  );
};