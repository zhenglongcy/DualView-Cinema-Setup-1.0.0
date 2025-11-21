export interface VideoSource {
  id: string;
  url: string;
  name: string;
  type: 'file' | 'url' | 'embed';
}

export interface PlayerRef {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  mute: (muted: boolean) => void;
  togglePiP: () => void;
  currentTime: number;
}