import React, { useState, useRef, useEffect } from 'react';
import { VideoPlayer } from './components/VideoPlayer';
import { ControlBar } from './components/ControlBar';
import type { PlayerRef, VideoSource } from './types';
import { MonitorPlay, Sun, Moon, Monitor, EyeOff, X, ChevronUp, ChevronDown } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

export default function App() {
  const [video1, setVideo1] = useState<VideoSource | null>(null);
  const [video2, setVideo2] = useState<VideoSource | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Immersive Mode State (Hides Header & Footer completely)
  const [immersiveMode, setImmersiveMode] = useState(false);
  
  // Visibility States (User togglable)
  const [showControls, setShowControls] = useState(true);
  const [showHeader, setShowHeader] = useState(true);

  // Independent Vertical Fullscreen States
  const [leftMaximized, setLeftMaximized] = useState(false);
  const [rightMaximized, setRightMaximized] = useState(false);

  // Theme State
  const [theme, setTheme] = useState<Theme>('system');
  
  // Split Pane State
  const [splitPercent, setSplitPercent] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const player1Ref = useRef<PlayerRef>(null);
  const player2Ref = useRef<PlayerRef>(null);

  // Apply Theme Effect
  useEffect(() => {
    const root = window.document.documentElement;
    const applyDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (applyDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Listen for system theme changes if in system mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const root = window.document.documentElement;
      if (mediaQuery.matches) root.classList.add('dark');
      else root.classList.remove('dark');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const handleSourceLoad = (slot: 1 | 2, data: { url: string, type: 'file' | 'url' | 'embed', name: string }) => {
    const currentVideo = slot === 1 ? video1 : video2;
    
    // Cleanup previous blob URL if it exists and was a file
    if (currentVideo?.type === 'file') {
      URL.revokeObjectURL(currentVideo.url);
    }

    const newSource: VideoSource = {
      id: crypto.randomUUID(),
      url: data.url,
      name: data.name,
      type: data.type
    };

    if (slot === 1) {
      setVideo1(newSource);
    } else {
      setVideo2(newSource);
    }
    
    // Pause when loading a new video
    setIsPlaying(false);
  };

  const handleRemove = (slot: 1 | 2) => {
    const currentVideo = slot === 1 ? video1 : video2;
    
    if (currentVideo?.type === 'file') {
      URL.revokeObjectURL(currentVideo.url);
    }

    if (slot === 1) {
      setVideo1(null);
    } else {
      setVideo2(null);
    }
    setIsPlaying(false);
  };

  const togglePlayPause = () => {
    const newState = !isPlaying;
    setIsPlaying(newState);

    // Only control native players, embed players handle themselves
    if (newState) {
      player1Ref.current?.play();
      player2Ref.current?.play();
    } else {
      player1Ref.current?.pause();
      player2Ref.current?.pause();
    }
  };

  const resetAll = () => {
    player1Ref.current?.seek(0);
    player2Ref.current?.seek(0);
    if (isPlaying) {
      player1Ref.current?.play();
      player2Ref.current?.play();
    }
  };

  const muteAll = () => {
    player1Ref.current?.mute(true);
    player2Ref.current?.mute(true);
  };

  const unmuteAll = () => {
    player1Ref.current?.mute(false);
    player2Ref.current?.mute(false);
  };

  // Fullscreen Logic
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Error toggling fullscreen:", err);
    }
  };

  const toggleLeftMax = () => {
    setLeftMaximized(!leftMaximized);
  };

  const toggleRightMax = () => {
    setRightMaximized(!rightMaximized);
  };

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      if (video1?.type === 'file') URL.revokeObjectURL(video1.url);
      if (video2?.type === 'file') URL.revokeObjectURL(video2.url);
    };
  }, []);

  // Drag Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const isMobileLayout = window.innerWidth < 768; // Matches md breakpoint

      let newPercent;
      if (isMobileLayout) {
         // Vertical split (top/bottom)
         newPercent = ((e.clientY - rect.top) / rect.height) * 100;
      } else {
         // Horizontal split (left/right)
         newPercent = ((e.clientX - rect.left) / rect.width) * 100;
      }

      // Clamp between 10% and 90% to prevent one side from disappearing
      setSplitPercent(Math.min(90, Math.max(10, newPercent)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none'; // Prevent text selection while dragging
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'auto';
    };
  }, [isDragging]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col text-slate-900 dark:text-slate-100 transition-colors duration-300 overflow-hidden relative">
      
      {/* Floating Exit Immersive Button */}
      {immersiveMode && (
        <button
          onClick={() => setImmersiveMode(false)}
          className="fixed top-2 right-2 z-50 p-2 bg-black/50 hover:bg-indigo-600 text-white/50 hover:text-white rounded-full backdrop-blur-sm transition-all shadow-lg group"
          title="退出沉浸模式"
        >
          <X size={20} />
          <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
            退出沉浸模式
          </span>
        </button>
      )}

      {/* Expand Header Button (Visible only when header hidden + NOT immersive) */}
      {!immersiveMode && !showHeader && (
        <div className="fixed top-0 left-1/2 -translate-x-1/2 z-50">
           <button
             onClick={() => setShowHeader(true)}
             className="bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 rounded-b-xl px-6 py-1 shadow-[0_2px_10px_rgba(0,0,0,0.1)] backdrop-blur-sm border-b border-x border-slate-200 dark:border-slate-700 transition-transform hover:translate-y-1"
             title="显示顶部栏"
           >
             <ChevronDown size={20} />
           </button>
        </div>
      )}

      {/* Header (Hidden in Immersive Mode or User Hidden) */}
      {!immersiveMode && showHeader && (
        <header className="h-16 border-b border-slate-200 dark:border-slate-700 flex items-center px-6 bg-white dark:bg-slate-800 shadow-sm z-10 flex-shrink-0 transition-colors">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <MonitorPlay size={24} />
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">双视影院</h1>
          </div>
          
          <div className="ml-auto flex items-center gap-4">
            <div className="text-sm text-slate-500 dark:text-slate-400 hidden lg:block border-r border-slate-300 dark:border-slate-600 pr-4 mr-2">
              支持 Chaturbate, YouTube, 本地文件
            </div>

            {/* Immersive Mode Toggle */}
            <button
              onClick={() => setImmersiveMode(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-sm font-medium"
              title="隐藏界面，只看视频"
            >
              <EyeOff size={16} />
              <span className="hidden sm:inline">沉浸模式</span>
            </button>

            {/* Theme Selector */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1 transition-colors">
              <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded-md transition-all ${theme === 'light' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                title="浅色模式"
              >
                <Sun size={16} />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded-md transition-all ${theme === 'dark' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                title="深色模式"
              >
                <Moon size={16} />
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`p-1.5 rounded-md transition-all ${theme === 'system' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                title="跟随系统"
              >
                <Monitor size={16} />
              </button>
            </div>

            {/* Hide Header Button */}
            <button 
              onClick={() => setShowHeader(false)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 ml-2"
              title="隐藏顶部栏"
            >
              <ChevronUp size={20} />
            </button>
          </div>
        </header>
      )}

      {/* Main Content - Resizable Split Screen */}
      <main 
        ref={containerRef} 
        className="flex-1 flex flex-col md:flex-row overflow-hidden relative"
      >
        {/* Left/Top Panel */}
        <div 
          style={{ 
            flexBasis: `${splitPercent}%`,
            position: leftMaximized ? 'fixed' : 'relative',
            top: leftMaximized ? 0 : 'auto',
            left: leftMaximized ? 0 : 'auto',
            bottom: leftMaximized ? 0 : 'auto',
            width: leftMaximized ? (window.innerWidth < 768 ? '100%' : `${splitPercent}vw`) : 'auto',
            height: leftMaximized ? '100%' : 'auto',
            zIndex: leftMaximized ? 50 : 'auto'
          }}
          className="relative flex-shrink-0 min-h-[10%] min-w-[10%]"
        >
          <VideoPlayer
            ref={player1Ref}
            id="player-1"
            label="播放器 1"
            source={video1}
            onLoad={(data) => handleSourceLoad(1, data)}
            onRemove={() => handleRemove(1)}
            onToggleMax={toggleLeftMax}
            isMaximized={leftMaximized}
          />
          {/* Transparent overlay to catch mouse events over iframes/videos while dragging */}
          {isDragging && <div className="absolute inset-0 z-50 bg-transparent cursor-move" />}
        </div>

        {/* Resizer Handle (Hide if maximized) */}
        {!leftMaximized && !rightMaximized && (
          <div 
            className={`
              z-20 flex items-center justify-center bg-slate-200 dark:bg-slate-800 hover:bg-indigo-500 dark:hover:bg-indigo-500 transition-colors
              border-slate-300 dark:border-slate-700
              /* Desktop: Vertical Bar */
              md:w-2 md:h-full md:border-l md:border-r md:cursor-col-resize 
              /* Mobile: Horizontal Bar */
              w-full h-3 border-t border-b cursor-row-resize
              ${isDragging ? 'bg-indigo-500 dark:bg-indigo-500' : ''}
            `}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDragging(true);
              // Force cursor immediately for better feedback
              document.body.style.cursor = window.innerWidth < 768 ? 'row-resize' : 'col-resize';
            }}
          >
            {/* Handle Grip Icon */}
            <div className="bg-slate-400 dark:bg-slate-600 rounded-full md:w-1 md:h-8 w-8 h-1" />
          </div>
        )}

        {/* Right/Bottom Panel */}
        <div 
          style={{ 
            position: rightMaximized ? 'fixed' : 'relative',
            top: rightMaximized ? 0 : 'auto',
            right: rightMaximized ? 0 : 'auto',
            bottom: rightMaximized ? 0 : 'auto',
            // If right is maximized, calculate its width as (100 - split) vw
            width: rightMaximized ? (window.innerWidth < 768 ? '100%' : `${100 - splitPercent}vw`) : 'auto',
            height: rightMaximized ? '100%' : 'auto',
            zIndex: rightMaximized ? 50 : 'auto'
          }}
          className="flex-1 relative min-h-[10%] min-w-[10%]"
        >
          <VideoPlayer
            ref={player2Ref}
            id="player-2"
            label="播放器 2"
            source={video2}
            onLoad={(data) => handleSourceLoad(2, data)}
            onRemove={() => handleRemove(2)}
            onToggleMax={toggleRightMax}
            isMaximized={rightMaximized}
          />
          {isDragging && <div className="absolute inset-0 z-50 bg-transparent" />}
        </div>
      </main>

      {/* Controls Spacer - only present if controls are visible AND not immersive */}
      {showControls && !immersiveMode && (
        <div className="h-24 flex-shrink-0" />
      )}

      {/* Control Bar */}
      {showControls && !immersiveMode && (
        <ControlBar
          isPlaying={isPlaying}
          isFullscreen={isFullscreen}
          onPlayPause={togglePlayPause}
          onReset={resetAll}
          onMuteAll={muteAll}
          onUnmuteAll={unmuteAll}
          onToggleFullscreen={toggleFullscreen}
          onCollapse={() => setShowControls(false)}
        />
      )}

      {/* Expand Controls Button (Visible only when controls hidden + NOT immersive) */}
      {!showControls && !immersiveMode && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50">
           <button
             onClick={() => setShowControls(true)}
             className="bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 rounded-t-xl px-6 py-1 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] backdrop-blur-sm border-t border-x border-slate-200 dark:border-slate-700 transition-transform hover:-translate-y-1"
             title="显示控制栏"
           >
             <ChevronUp size={20} />
           </button>
        </div>
      )}
    </div>
  );
}