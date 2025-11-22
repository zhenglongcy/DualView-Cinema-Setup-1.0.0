import React, { useRef, useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Upload, X, PictureInPicture, Volume2, VolumeX, Link as LinkIcon, Globe, Radio, Maximize2, Minimize2, Play, Pause, Disc, Square, Settings, Crop, Check } from 'lucide-react';
import type { PlayerRef, VideoSource } from '../types';
import Hls from 'hls.js';

interface VideoPlayerProps {
  id: string;
  source: VideoSource | null;
  onLoad: (data: { url: string; type: 'file' | 'url' | 'embed'; name: string }) => void;
  onRemove: () => void;
  onToggleMax: () => void;
  label: string;
  isMaximized: boolean;
}

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const VideoPlayer = forwardRef<PlayerRef, VideoPlayerProps>(({ source, onLoad, onRemove, onToggleMax, label, isMaximized }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1); // 0.0 to 1.0 internally
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHls, setIsHls] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordConfig, setRecordConfig] = useState({
    type: 'original' as 'original' | 'custom' | 'crop',
    width: 1920,
    height: 1080
  });

  // Cropping State
  const [isSelectingCrop, setIsSelectingCrop] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);

  useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play().catch(() => {}),
    pause: () => videoRef.current?.pause(),
    seek: (time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
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

  // Handle Source Loading
  useEffect(() => {
    if (!source || source.type === 'embed' || !videoRef.current) return;

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
          videoRef.current!.src = source.url;
        }
      } else {
        videoRef.current!.src = source.url;
      }
      // Apply volume
      if(videoRef.current) videoRef.current.volume = volume;
    };

    loadSource();

    return () => {
      if (hls) hls.destroy();
    };
  }, [source]);

  // Cleanup recorder on unmount
  useEffect(() => {
    return () => {
      stopRecordingCleanup();
    };
  }, []);

  const stopRecordingCleanup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (hiddenVideoRef.current) {
      const stream = hiddenVideoRef.current.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      hiddenVideoRef.current.srcObject = null;
      hiddenVideoRef.current = null;
    }
    canvasRef.current = null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onLoad({ url, type: 'file', name: file.name });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Smart URL Parser
  const parseUrl = (input: string): { url: string, type: 'url' | 'embed', name: string } => {
    const trimmed = input.trim();
    let name = 'Web Video';
    
    // --- 1. Chaturbate ---
    const ignoredPaths = ['in', 'auth', 'tags', 'terms', 'privacy', 'dmca', 'jobs', 'support', 'apps', 'contest', 'tipping', 'external_link'];
    const cbMatch = trimmed.match(/(?:[\w-]+\.)?chaturbate\.com\/(?:in\/|p\/|b\/)?([a-zA-Z0-9_\-]+)/i);
    if (cbMatch && !trimmed.includes('.m3u8')) {
      const possibleUser = cbMatch[1];
      if (possibleUser && !ignoredPaths.includes(possibleUser)) {
        return {
          url: `https://chaturbate.com/embed/${possibleUser}/?bgcolor=black&wm=0&disable_sound=0`,
          type: 'embed',
          name: `CB: ${possibleUser}`
        };
      }
    }

    // --- 2. NudeVista ---
    const nvMatch = trimmed.match(/(?:[\w-]+\.)?nudevista\.com/i);
    if (nvMatch) {
      return { url: trimmed, type: 'embed', name: 'NudeVista' };
    }

    // --- 3. YouTube ---
    const ytMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w\-]+)/i);
    if (ytMatch) {
      return {
        url: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&controls=0&modestbranding=1&rel=0`,
        type: 'embed',
        name: 'YouTube'
      };
    }

    // --- 4. Twitch ---
    const twitchMatch = trimmed.match(/twitch\.tv\/([\w\-]+)/i);
    if (twitchMatch) {
      const username = twitchMatch[1];
      const parent = window.location.hostname || 'localhost';
      return {
        url: `https://player.twitch.tv/?channel=${username}&parent=${parent}&muted=false`,
        type: 'embed',
        name: `Twitch: ${username}`
      };
    }

    // --- 5. Bilibili ---
    const biliMatch = trimmed.match(/bilibili\.com\/video\/(BV\w+)/i);
    if (biliMatch) {
      return {
        url: `https://player.bilibili.com/player.html?bvid=${biliMatch[1]}&high_quality=1&danmaku=0&autoplay=1`,
        type: 'embed',
        name: `Bilibili: ${biliMatch[1]}`
      };
    }

    // --- 6. Tencent Video (QQ) ---
    const qqMatch = trimmed.match(/v\.qq\.com\/.*\/([a-zA-Z0-9]+)\.html/i);
    if (qqMatch) {
      return {
        url: `https://v.qq.com/txp/iframe/player.html?vid=${qqMatch[1]}&autoplay=true`,
        type: 'embed',
        name: '腾讯视频'
      };
    }

    // --- 7. Youku ---
    const youkuMatch = trimmed.match(/id_([a-zA-Z0-9=]+)/i);
    if (youkuMatch) {
       return {
         url: `https://player.youku.com/embed/${youkuMatch[1]}?autoplay=true`,
         type: 'embed',
         name: '优酷'
       };
    }

    // --- 8. Telegram ---
    const tgMatch = trimmed.match(/t\.me\/([^\/]+)\/(\d+)/i);
    if (tgMatch) {
      return {
        url: `https://t.me/${tgMatch[1]}/${tgMatch[2]}?embed=1&mode=tme`,
        type: 'embed',
        name: `TG: ${tgMatch[1]}`
      };
    }

    // --- 9. iQIYI ---
    if (trimmed.includes('iqiyi.com')) {
       return {
         url: trimmed,
         type: 'embed',
         name: '爱奇艺'
       };
    }

    // --- 10. Standard Files / HLS ---
    try {
      const urlObj = new URL(trimmed);
      const filename = urlObj.pathname.split('/').pop();
      if (filename) name = filename;
      if (trimmed.includes('.m3u8')) name = 'Live Stream';
    } catch (e) {}

    return { url: trimmed, type: 'url', name };
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return;
    const result = parseUrl(urlInput);
    onLoad(result);
    setUrlInput('');
  };

  // --- Crop Selection Handlers ---
  const startSelectingCrop = () => {
    setIsSelectingCrop(true);
    setCropRect(null);
    setShowRecordModal(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSelectingCrop || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDragStart({ x, y });
    setCropRect({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelectingCrop || !dragStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const width = Math.abs(currentX - dragStart.x);
    const height = Math.abs(currentY - dragStart.y);
    const x = Math.min(currentX, dragStart.x);
    const y = Math.min(currentY, dragStart.y);

    setCropRect({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (isSelectingCrop) {
      setDragStart(null);
    }
  };

  const confirmCrop = () => {
    setIsSelectingCrop(false);
    setShowRecordModal(true);
  };

  // --- Recording Logic ---
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const initiateRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      setShowRecordModal(true);
    }
  };

  const startRecordingProcess = async () => {
    setShowRecordModal(false);
    chunksRef.current = [];
    let stream: MediaStream | null = null;
    let inputStream: MediaStream | null = null;

    try {
      if (source?.type === 'embed') {
        try {
          const constraints: any = {
            video: { displaySurface: 'browser' },
            audio: true
          };
          
          if (recordConfig.type === 'custom') {
            constraints.video.width = { ideal: recordConfig.width };
            constraints.video.height = { ideal: recordConfig.height };
          }

          inputStream = await navigator.mediaDevices.getDisplayMedia(constraints);
          stream = inputStream;

          if (recordConfig.type === 'crop' && cropRect) {
            stream = await startCroppedTabStream(inputStream, cropRect);
          }

        } catch (err) {
          console.error("Screen sharing cancelled", err);
          return;
        }
      } else if (videoRef.current) {
        if (recordConfig.type === 'custom' || recordConfig.type === 'crop') {
          stream = startCanvasRecording();
        } else {
          // @ts-ignore
          if (videoRef.current.captureStream) {
            // @ts-ignore
            stream = videoRef.current.captureStream();
          } else if ((videoRef.current as any).mozCaptureStream) {
             // @ts-ignore
            stream = (videoRef.current as any).mozCaptureStream();
          } else {
            alert("您的浏览器不支持直接视频捕获。");
            return;
          }
        }
      }

      if (!stream) return;

      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') 
        ? 'video/webm; codecs=vp9' 
        : 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        saveRecording();
        stream?.getTracks().forEach(track => track.stop());
        if (inputStream && inputStream !== stream) {
          inputStream.getTracks().forEach(track => track.stop());
        }
        stopRecordingCleanup();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Recording init failed", err);
      alert("录制启动失败，请确保授予了浏览器相应权限。");
    }
  };

  const startCroppedTabStream = async (inputStream: MediaStream, rect: CropRect): Promise<MediaStream> => {
    return new Promise((resolve) => {
       const hiddenVideo = document.createElement('video');
       hiddenVideoRef.current = hiddenVideo;
       hiddenVideo.srcObject = inputStream;
       hiddenVideo.muted = true;
       hiddenVideo.play();
       
       hiddenVideo.onloadedmetadata = () => {
          const streamWidth = hiddenVideo.videoWidth;
          const domWidth = window.innerWidth;
          const scaleFactor = streamWidth / domWidth; 

          if (!containerRef.current) { resolve(inputStream); return; }
          const containerRect = containerRef.current.getBoundingClientRect();
          
          const absoluteX = containerRect.left + rect.x;
          const absoluteY = containerRect.top + rect.y;
          
          const sx = absoluteX * scaleFactor;
          const sy = absoluteY * scaleFactor;
          const sw = rect.width * scaleFactor;
          const sh = rect.height * scaleFactor;

          const canvas = document.createElement('canvas');
          canvas.width = sw;
          canvas.height = sh;
          
          const ctx = canvas.getContext('2d');
          canvasRef.current = canvas;

          const draw = () => {
             if (!canvasRef.current || !hiddenVideoRef.current) return;
             ctx?.drawImage(hiddenVideo, sx, sy, sw, sh, 0, 0, sw, sh);
             animationFrameRef.current = requestAnimationFrame(draw);
          };
          draw();
          
          const outputStream = canvas.captureStream(30);
          const audioTracks = inputStream.getAudioTracks();
          if (audioTracks.length > 0) {
             outputStream.addTrack(audioTracks[0]);
          }
          
          resolve(outputStream);
       };
    });
  }

  const startCanvasRecording = (): MediaStream | null => {
    if (!videoRef.current || !containerRef.current) return null;

    let width = videoRef.current.videoWidth;
    let height = videoRef.current.videoHeight;
    let sx = 0, sy = 0, sWidth = width, sHeight = height;

    if (recordConfig.type === 'crop' && cropRect) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const videoRatio = videoRef.current.videoWidth / videoRef.current.videoHeight;
        const containerRatio = containerRect.width / containerRect.height;
        
        let renderW = containerRect.width;
        let renderH = containerRect.height;
        let offsetX = 0;
        let offsetY = 0;

        if (containerRatio > videoRatio) {
           renderW = renderH * videoRatio;
           offsetX = (containerRect.width - renderW) / 2;
        } else {
           renderH = renderW / videoRatio;
           offsetY = (containerRect.height - renderH) / 2;
        }

        const relativeX = cropRect.x - offsetX;
        const relativeY = cropRect.y - offsetY;
        const scaleX = videoRef.current.videoWidth / renderW;
        const scaleY = videoRef.current.videoHeight / renderH;
        
        sx = Math.max(0, relativeX * scaleX);
        sy = Math.max(0, relativeY * scaleY);
        sWidth = Math.min(videoRef.current.videoWidth - sx, cropRect.width * scaleX);
        sHeight = Math.min(videoRef.current.videoHeight - sy, cropRect.height * scaleY);
        
        width = cropRect.width;
        height = cropRect.height;
    } else if (recordConfig.type === 'custom') {
        width = recordConfig.width;
        height = recordConfig.height;
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    canvasRef.current = canvas;

    if (!ctx) return null;

    const draw = () => {
      if (!videoRef.current || !canvasRef.current) return;
      if (recordConfig.type === 'custom') {
          ctx.drawImage(videoRef.current, 0, 0, width, height);
      } else if (recordConfig.type === 'crop') {
          ctx.drawImage(videoRef.current, sx, sy, sWidth, sHeight, 0, 0, width, height);
      } else {
         ctx.drawImage(videoRef.current, 0, 0, width, height);
      }
      animationFrameRef.current = requestAnimationFrame(draw);
    };
    draw();

    const canvasStream = canvas.captureStream(30); 
    // @ts-ignore
    const videoStream = videoRef.current.captureStream ? videoRef.current.captureStream() : (videoRef.current as any).mozCaptureStream();
    const audioTracks = videoStream.getAudioTracks();
    if (audioTracks.length > 0) canvasStream.addTrack(audioTracks[0]);
    return canvasStream;
  };

  const saveRecording = async () => {
    if (chunksRef.current.length === 0) return;

    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    const date = new Date();
    const timestamp = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}_${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}${String(date.getSeconds()).padStart(2,'0')}`;
    const filename = `DualView_Record_${timestamp}.webm`;

    if ('showSaveFilePicker' in window) {
      try {
        // @ts-ignore
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'WebM Video File',
            accept: { 'video/webm': ['.webm'] },
          }],
        });
        
        // @ts-ignore
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return; 
      } catch (err: any) {
        if (err.name === 'AbortError') return; 
        console.error('File Picker failed', err);
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    setTimeout(() => document.body.removeChild(a), 100);
  };

  const togglePlayInternal = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolumeInt = parseInt(e.target.value, 10);
    const newVolume = newVolumeInt / 100;
    
    setVolume(newVolume);
    
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      
      if (newVolume > 0 && isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
      if (newVolume === 0 && !isMuted) {
         videoRef.current.muted = true;
         setIsMuted(true);
      }
    }
  };

  const togglePiPLocal = async () => {
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
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };
  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  const getEmbedStyle = (url: string) => {
    if (url.includes('chaturbate.com')) {
      return "scale-[1.9] origin-center translate-x-[20%] translate-y-[25%]";
    }
    if (url.includes('nudevista.com')) {
      return "scale-[1.1] origin-center";
    }
    if (url.includes('bilibili.com')) {
      return "scale-[1.02] origin-center"; 
    }
    if (url.includes('iqiyi.com')) {
      return "scale-[1.1] origin-top"; 
    }
    if (url.includes('t.me')) {
      return "scale-[1.5] origin-center"; 
    }
    return "scale-[1.15] origin-center"; 
  };

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full relative group bg-black flex items-center justify-center overflow-hidden ${isMaximized ? 'rounded-none' : ''} ${isSelectingCrop ? 'cursor-crosshair' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Crop Overlay */}
      {isSelectingCrop && (
        <div className="absolute inset-0 z-50 bg-black/50">
           {cropRect && (
             <div 
               className="absolute border-2 border-red-500 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
               style={{
                 left: cropRect.x,
                 top: cropRect.y,
                 width: cropRect.width,
                 height: cropRect.height
               }}
             >
               <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex gap-2">
                 <button onClick={confirmCrop} className="bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1 shadow-lg">
                   <Check size={14} /> 确认
                 </button>
                 <button onClick={() => setIsSelectingCrop(false)} className="bg-slate-600 text-white px-3 py-1 rounded text-sm shadow-lg">
                   取消
                 </button>
               </div>
             </div>
           )}
           {!cropRect && (
             <div className="absolute top-10 left-1/2 -translate-x-1/2 text-white bg-black/60 px-4 py-2 rounded backdrop-blur pointer-events-none">
               按住鼠标左键拖拽选择录制区域
             </div>
           )}
        </div>
      )}

      {/* Recording Settings Modal */}
      {showRecordModal && (
        <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl w-80 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">录制设置</h3>
              <button onClick={() => setShowRecordModal(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setRecordConfig(prev => ({ ...prev, type: 'original' }))}
                  className={`py-2 rounded-lg text-xs font-medium transition-colors ${recordConfig.type === 'original' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                >
                  原始
                </button>
                <button
                  onClick={() => setRecordConfig(prev => ({ ...prev, type: 'custom' }))}
                  className={`py-2 rounded-lg text-xs font-medium transition-colors ${recordConfig.type === 'custom' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                >
                  自定义
                </button>
                <button
                  onClick={() => setRecordConfig(prev => ({ ...prev, type: 'crop' }))}
                  className={`py-2 rounded-lg text-xs font-medium transition-colors ${recordConfig.type === 'crop' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                >
                  选区
                </button>
              </div>

              {recordConfig.type === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">宽度 (px)</label>
                    <input 
                      type="number" 
                      value={recordConfig.width} 
                      onChange={(e) => setRecordConfig(prev => ({ ...prev, width: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">高度 (px)</label>
                    <input 
                      type="number" 
                      value={recordConfig.height} 
                      onChange={(e) => setRecordConfig(prev => ({ ...prev, height: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm dark:text-white"
                    />
                  </div>
                </div>
              )}

              {recordConfig.type === 'crop' && (
                <button
                  onClick={startSelectingCrop}
                  className="w-full bg-indigo-100 dark:bg-indigo-900/50 hover:bg-indigo-200 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 border border-dashed border-indigo-400"
                >
                   <Crop size={16} />
                   {cropRect ? "重新设定区域" : "设定录制区域"}
                </button>
              )}

              <button 
                onClick={startRecordingProcess}
                disabled={recordConfig.type === 'crop' && !cropRect}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white py-2 rounded-lg font-medium mt-2 flex items-center justify-center gap-2"
              >
                <Disc size={18} />
                开始录制
              </button>
            </div>
          </div>
        </div>
      )}

      {!source ? (
        <div className="w-full max-w-md p-6 mx-4 bg-white/90 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/50 backdrop-blur-sm shadow-2xl transition-colors">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">{label}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">请选择视频来源</p>
          </div>

          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-lg p-6 cursor-pointer transition-all group/upload"
          >
            <Upload className="mx-auto h-10 w-10 text-slate-400 group-hover/upload:text-indigo-500 dark:group-hover/upload:text-indigo-400 mb-3 transition-colors" />
            <p className="text-center text-slate-600 dark:text-slate-300 font-medium">上传本地文件</p>
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
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase">网络视频 / 直播流</span>
            <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                <LinkIcon size={16} />
              </div>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="粘贴链接 (Chaturbate, YouTube, B站...)"
                className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
              />
            </div>
            <button
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              加载
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ================== EMBED MODE ================== */}
          {source.type === 'embed' ? (
            <div className="w-full h-full relative overflow-hidden bg-black">
              <iframe
                src={source.url}
                className={`w-full h-full border-0 ${getEmbedStyle(source.url)}`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen; popups; forms" 
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-forms"
              />
              
              <div className="absolute top-0 left-0 p-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                 <button 
                  onClick={onRemove}
                  className="p-2 rounded-full bg-black/20 hover:bg-red-600/90 text-white/50 hover:text-white transition-all backdrop-blur-[2px]"
                  title="关闭视频"
                >
                  <X size={16} />
                </button>
              </div>
              
              <div className="absolute top-0 right-0 p-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto flex flex-col gap-2">
                 <button 
                  onClick={initiateRecording}
                  className={`p-2 rounded-full transition-all backdrop-blur-[2px] ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-black/20 text-white/50 hover:text-white hover:bg-red-600/90'}`}
                  title={isRecording ? "停止录制并保存" : "录制屏幕"}
                >
                  {isRecording ? <Square size={16} fill="currentColor" /> : <Disc size={16} />}
                </button>

                 <button
                  onClick={onToggleMax}
                  className={`p-2 rounded-full transition-all backdrop-blur-[2px] ${isMaximized ? 'bg-indigo-600 text-white shadow-lg' : 'bg-black/20 text-white/50 hover:text-white hover:bg-indigo-600/90'}`}
                  title={isMaximized ? "还原" : "半屏全屏"}
                >
                  {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
             </div>
            </div>
          ) : (
            /* ================== NATIVE VIDEO MODE ================== */
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                crossOrigin="anonymous"
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onClick={togglePlayInternal}
              />
              
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
                <div className="pointer-events-auto flex items-center gap-2">
                   <button 
                    onClick={onRemove}
                    className="p-2 rounded-full bg-black/40 hover:bg-red-500/80 text-white transition-all backdrop-blur-sm"
                    title="关闭视频"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 z-30">
                 <input
                   type="range"
                   min="0"
                   max={duration || 100}
                   value={currentTime}
                   onChange={handleSeek}
                   className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                 />
                 
                 <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                       <button onClick={togglePlayInternal} className="hover:text-indigo-400 transition-colors">
                          {isPlaying ? <Pause size={20}/> : <Play size={20}/>}
                       </button>
                       <span className="text-xs font-medium font-mono tracking-wide opacity-90">
                          {formatTime(currentTime)} / {formatTime(duration)}
                       </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                       <button 
                         onClick={initiateRecording} 
                         className={`hover:text-red-400 transition-colors ${isRecording ? 'text-red-500' : 'text-slate-300'}`}
                         title={isRecording ? "停止录制并保存" : "录制设置"}
                       >
                          {isRecording ? <Square size={18} fill="currentColor" /> : <Disc size={18} />}
                       </button>

                       {/* Volume Control with Slider 0-100 */}
                       <div className="flex items-center gap-1 group/vol">
                         <button onClick={toggleMute} className="hover:text-indigo-400 transition-colors" title={isMuted ? "取消静音" : "静音"}>
                            {isMuted || volume === 0 ? <VolumeX size={18}/> : <Volume2 size={18}/>}
                         </button>
                         <input 
                           type="range" 
                           min="0" 
                           max="100" 
                           step="1"
                           value={isMuted ? 0 : Math.round(volume * 100)}
                           onChange={handleVolumeChange}
                           className="w-24 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                           title={`音量: ${isMuted ? 0 : Math.round(volume * 100)}%`}
                         />
                       </div>
                       
                       <button onClick={togglePiPLocal} className="hover:text-indigo-400 transition-colors" title="画中画">
                          <PictureInPicture size={18}/>
                       </button>

                       <button 
                         onClick={onToggleMax} 
                         className={`hover:text-indigo-400 transition-colors ${isMaximized ? 'text-indigo-400' : ''}`}
                         title="单窗口全屏"
                       >
                         {isMaximized ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
                       </button>
                    </div>
                 </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
});