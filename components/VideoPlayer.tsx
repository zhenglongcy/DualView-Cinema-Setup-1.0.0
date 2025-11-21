import React, { useRef, useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Upload, X, PictureInPicture, Volume2, VolumeX, Link as LinkIcon, Globe, Radio } from 'lucide-react';
import { PlayerRef, VideoSource } from '../types';
import Hls from 'hls.js';

interface VideoPlayerProps {
  id: string;
  source: VideoSource | null;
  onLoad: (data: { url: string; type: 'file' | 'url'; name: string }) => void;
  onRemove: () => void;
  label: string;
}

export const VideoPlayer = forwardRef<PlayerRef, VideoPlayerProps>(({ source, onLoad, onRemove, label }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHls, setIsHls] = useState(false);

  useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play().catch(() => {}),
    pause: () => videoRef.current?.pause(),
    seek: (time: number) => {
      if (videoRef.current) videoRef.current.currentTime = time;
    },
    mute: (muted: boolean) => {
      if (videoRef.current) {
        videoRef.current.muted = muted;
        setIsMuted(muted);
      }
    },
    togglePiP: async () => {
      if (!videoRef.current) return;
      try {
        if (document.pictureInPictureElement === videoRef.current) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      } catch (err) {
        console.error("PiP failed", err);
      }
    },
    get currentTime() {
      return videoRef.current?.currentTime || 0;
    }
  }));

  // Handle Source Loading (File vs URL vs HLS)
  useEffect(() => {
    if (!source || !videoRef.current) return;

    let hls: Hls | null = null;
    const isStream = source.url.includes('.m3u8');
    setIsHls(isStream);

    const loadSource = () => {
      if (isStream) {
        if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(source.url);
          hls.attachMedia(videoRef.current!);
        } else if (videoRef.current!.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS support (Safari)
          videoRef.current!.src = source.url;
        }
      } else {
        // Standard File or MP4
        videoRef.current!.src = source.url;
      }
    };

    loadSource();

    return () => {
      if (hls) hls.destroy();
      // We don't clear src on unmount immediately to prevent flashing, 
      // but React will handle the component removal.
    };
  }, [source]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onLoad({ url, type: 'file', name: file.name });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return;
    
    // Basic name extraction from URL
    let name = 'Web Video';
    try {
      const urlObj = new URL(urlInput);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      if (filename) {
         name = filename;
      } else if (urlInput.includes('.m3u8')) {
         name = 'Live Stream';
      }
    } catch (e) {
      // Fallback if invalid URL logic
    }

    onLoad({ url: urlInput, type: 'url', name });
    setUrlInput('');
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const togglePiP = async () => {
      if (!videoRef.current) return;
      try {
        if (document.pictureInPictureElement === videoRef.current) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      } catch (err) {
        console.error("PiP failed", err);
        alert("Picture-in-Picture failed. Your browser might restrict this.");
      }
  };

  return (
    <div className="w-full h-full relative group bg-black flex items-center justify-center overflow-hidden">
      {!source ? (
        <div className="w-full max-w-md p-6 mx-4 bg-white/90 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/50 backdrop-blur-sm shadow-2xl transition-colors">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">{label}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Select a source to begin</p>
          </div>

          {/* File Upload Section */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-lg p-6 cursor-pointer transition-all group/upload"
          >
            <Upload className="mx-auto h-10 w-10 text-slate-400 group-hover/upload:text-indigo-500 dark:group-hover/upload:text-indigo-400 mb-3 transition-colors" />
            <p className="text-center text-slate-600 dark:text-slate-300 font-medium">Upload Local File</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase">Or via URL / Stream</span>
            <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
          </div>

          {/* URL Input Section */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                <LinkIcon size={16} />
              </div>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://... (.mp4, .m3u8)"
                className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
              />
            </div>
            <button
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Load
            </button>
          </div>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            crossOrigin="anonymous"
            playsInline
            controls 
          />
          
          {/* Header Overlay */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-start z-20 pointer-events-none">
            <div className="flex items-center gap-2">
              {isHls ? (
                <div className="flex items-center gap-1 bg-red-600/80 text-white px-2 py-1 rounded backdrop-blur-sm">
                   <Radio size={14} className="animate-pulse" />
                   <span className="text-xs font-bold tracking-wider">LIVE</span>
                </div>
              ) : source.type === 'url' ? (
                <Globe size={14} className="text-indigo-400" />
              ) : null}
              
              <span className="text-sm font-medium text-white/90 drop-shadow-md bg-black/40 px-2 py-1 rounded backdrop-blur-sm truncate max-w-[200px]">
                {source.name}
              </span>
            </div>
            <button 
              onClick={onRemove}
              className="pointer-events-auto p-2 rounded-full bg-black/40 hover:bg-red-500/80 text-white transition-all backdrop-blur-sm"
              title="Remove Video"
            >
              <X size={16} />
            </button>
          </div>

          {/* Local Controls Overlay */}
          <div className="absolute bottom-16 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 pointer-events-none">
            <button
              onClick={togglePiP}
              className="pointer-events-auto p-2 rounded-full bg-black/60 hover:bg-indigo-600 text-white transition-colors backdrop-blur-md shadow-lg"
              title="Picture in Picture"
            >
              <PictureInPicture size={20} />
            </button>
            
            <button
              onClick={toggleMute}
              className="pointer-events-auto p-2 rounded-full bg-black/60 hover:bg-indigo-600 text-white transition-colors backdrop-blur-md shadow-lg"
              title={isMuted ? "Unmute" : "Mute"}
            >
               {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>
        </>
      )}
    </div>
  );
});