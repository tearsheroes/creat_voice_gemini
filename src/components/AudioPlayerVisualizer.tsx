import React, { useEffect, useRef, useState } from 'react';
import { AudioToneConfig } from '../types';
import {
  renderProcessedAudio,
  downloadAudioFile,
  decodeAudioData,
  sliceAudioBuffer,
  audioBufferToWavBlob,
  detectSilenceBoundaries,
} from '../utils/audioEncoder';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Share2,
  Volume2,
  VolumeX,
  FileAudio,
  Check,
  Sparkles,
  SlidersHorizontal,
  Scissors,
  Plus,
  Trash2,
  ListFilter,
  Layers,
} from 'lucide-react';

interface AudioPlayerVisualizerProps {
  audioUrl: string; // Base64 WAV data URL
  title: string;
  speakerNames?: string[];
  createdAt?: number;
  toneConfig: AudioToneConfig;
  onSaveToHistory?: (format: string) => void;
}

export interface AudioSegment {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
}

function constructExportFilename(
  title: string,
  speakerNames?: string[],
  createdAt?: number,
  format: string = 'wav',
  suffix?: string
): string {
  const d = new Date(createdAt || Date.now());
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());

  const timeStr = `${day}-${month}-${year}_${hours}h${minutes}m${seconds}s`;

  let namePart = '';
  if (speakerNames && speakerNames.length > 0) {
    namePart = speakerNames
      .map((n) => n.trim().replace(/[\/\\:\*\?"<>\|]/g, '').replace(/\s+/g, '_'))
      .filter(Boolean)
      .join('_');
  }

  if (!namePart) {
    namePart = title.trim().replace(/[\/\\:\*\?"<>\|]/g, '').replace(/\s+/g, '_');
  }

  const extraSuffix = suffix ? `_${suffix}` : '';

  return `${namePart}_${timeStr}${extraSuffix}.${format}`;
}

export const AudioPlayerVisualizer: React.FC<AudioPlayerVisualizerProps> = ({
  audioUrl,
  title,
  speakerNames,
  createdAt,
  toneConfig,
  onSaveToHistory,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(toneConfig.speed);

  // Real Waveform state
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);

  // Multi-Segment Cutter state
  const [showSegmentCutter, setShowSegmentCutter] = useState(false);
  const [segments, setSegments] = useState<AudioSegment[]>([]);
  const [activeSegmentPlayingId, setActiveSegmentPlayingId] = useState<string | null>(null);
  const [isExportingSegments, setIsExportingSegments] = useState(false);

  // Draggable Segment Regions state
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const [draggingSegment, setDraggingSegment] = useState<{
    id: string;
    type: 'left' | 'right' | 'move';
    startX: number;
    initialStart: number;
    initialEnd: number;
  } | null>(null);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'wav' | 'mp3' | 'ogg' | 'aac'>('wav');
  const [isExporting, setIsExporting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Decode real audio waveform data
  useEffect(() => {
    if (!audioUrl) return;

    decodeAudioData(audioUrl)
      .then((buf) => {
        setAudioBuffer(buf);
        const barsCount = 96;
        const channelData = buf.getChannelData(0);
        const step = Math.floor(channelData.length / barsCount);
        const peaks: number[] = [];

        for (let i = 0; i < barsCount; i++) {
          let max = 0;
          const start = i * step;
          for (let j = 0; j < step; j++) {
            const val = Math.abs(channelData[start + j] || 0);
            if (val > max) max = val;
          }
          peaks.push(max);
        }

        // Normalize peaks between 0.1 and 1.0
        const maxPeak = Math.max(...peaks, 0.001);
        const normalized = peaks.map((p) => Math.max(0.12, p / maxPeak));
        setWaveformPeaks(normalized);
      })
      .catch((err) => {
        console.warn('Real waveform decode error:', err);
      });
  }, [audioUrl]);

  // Sync speed with toneConfig
  useEffect(() => {
    setPlaybackSpeed(toneConfig.speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = toneConfig.speed;
    }
  }, [toneConfig.speed]);

  // Audio setup
  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const onTimeUpdate = () => {
      const cur = audio.currentTime;
      setCurrentTime(cur);

      // Check if playing an active segment and reached its endTime
      if (activeSegmentPlayingId) {
        const seg = segments.find((s) => s.id === activeSegmentPlayingId);
        if (seg && cur >= seg.endTime) {
          audio.pause();
          setIsPlaying(false);
          setActiveSegmentPlayingId(null);
        }
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      setActiveSegmentPlayingId(null);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl, activeSegmentPlayingId, segments]);

  // Render Real Waveform Canvas with segment region overlays
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const renderWaveform = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bars = waveformPeaks.length > 0 ? waveformPeaks.length : 80;
      const barGap = 2;
      const barWidth = (canvas.width - bars * barGap) / bars;

      const dur = duration || 1;
      const playRatio = currentTime / dur;

      // Draw background segment region highlights
      if (duration > 0 && segments.length > 0) {
        segments.forEach((seg, idx) => {
          const segStartX = (seg.startTime / dur) * canvas.width;
          const segEndX = (seg.endTime / dur) * canvas.width;
          const segW = Math.max(2, segEndX - segStartX);

          const colors = [
            'rgba(6, 182, 212, 0.15)', // cyan
            'rgba(168, 85, 247, 0.15)', // purple
            'rgba(236, 72, 153, 0.15)', // pink
            'rgba(34, 197, 94, 0.15)',  // emerald
            'rgba(234, 179, 8, 0.15)',  // amber
          ];
          const borderColors = [
            'rgba(6, 182, 212, 0.6)',
            'rgba(168, 85, 247, 0.6)',
            'rgba(236, 72, 153, 0.6)',
            'rgba(34, 197, 94, 0.6)',
            'rgba(234, 179, 8, 0.6)',
          ];

          const colorIdx = idx % colors.length;
          ctx.fillStyle = colors[colorIdx];
          ctx.fillRect(segStartX, 0, segW, canvas.height);

          // Draw vertical border markers
          ctx.strokeStyle = borderColors[colorIdx];
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(segStartX, 0);
          ctx.lineTo(segStartX, canvas.height);
          ctx.moveTo(segEndX, 0);
          ctx.lineTo(segEndX, canvas.height);
          ctx.stroke();

          // Label
          ctx.fillStyle = borderColors[colorIdx];
          ctx.font = '10px sans-serif';
          ctx.fillText(`Đoạn ${idx + 1}`, segStartX + 4, 12);
        });
      }

      // Draw real waveform bars
      for (let i = 0; i < bars; i++) {
        const peakVal = waveformPeaks.length > 0 ? waveformPeaks[i] : Math.abs(Math.sin(i * 0.2)) * 0.7 + 0.1;
        let h = peakVal * (canvas.height * 0.82);

        // Subtle animation pulse on active playback bar
        const isCurrentIndex = Math.floor(playRatio * bars) === i;
        if (isPlaying && isCurrentIndex) {
          h = Math.min(canvas.height * 0.95, h + Math.sin(Date.now() * 0.02) * 6 + 4);
        }

        const x = i * (barWidth + barGap);
        const y = (canvas.height - h) / 2;

        const isPlayed = i / bars <= playRatio;

        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        if (isPlayed) {
          gradient.addColorStop(0, '#22d3ee'); // cyan-400
          gradient.addColorStop(1, '#2563eb'); // blue-600
        } else {
          gradient.addColorStop(0, '#475569'); // slate-600
          gradient.addColorStop(1, '#1e293b'); // slate-800
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, Math.max(1.5, barWidth), Math.max(3, h), 2);
        ctx.fill();
      }

      // Draw Playhead vertical needle line
      const playheadX = playRatio * canvas.width;
      ctx.strokeStyle = '#38bdf8'; // sky-400
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, canvas.height);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(renderWaveform);
    };

    renderWaveform();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, currentTime, duration, waveformPeaks, segments]);

  // Click on waveform canvas to seek
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * duration;
    setCurrentTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
  };

  // Toggle play/pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setActiveSegmentPlayingId(null);
    } else {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Audio play error:', err);
          setIsPlaying(false);
        });
    }
  };

  // Replay
  const handleReplay = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setActiveSegmentPlayingId(null);
    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch((err) => {
        console.warn('Audio replay error:', err);
        setIsPlaying(false);
      });
  };

  // Seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    setActiveSegmentPlayingId(null);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
  };

  // Toggle Mute
  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Color schemes for segment overlays
  const SEGMENT_COLOR_SCHEMES = [
    {
      bg: 'bg-cyan-500/20 hover:bg-cyan-500/30',
      border: 'border-cyan-400',
      handle: 'bg-cyan-400 text-slate-950',
      text: 'text-cyan-300',
      ring: 'ring-cyan-400/60',
    },
    {
      bg: 'bg-amber-500/20 hover:bg-amber-500/30',
      border: 'border-amber-400',
      handle: 'bg-amber-400 text-slate-950',
      text: 'text-amber-300',
      ring: 'ring-amber-400/60',
    },
    {
      bg: 'bg-emerald-500/20 hover:bg-emerald-500/30',
      border: 'border-emerald-400',
      handle: 'bg-emerald-400 text-slate-950',
      text: 'text-emerald-300',
      ring: 'ring-emerald-400/60',
    },
    {
      bg: 'bg-purple-500/20 hover:bg-purple-500/30',
      border: 'border-purple-400',
      handle: 'bg-purple-400 text-slate-950',
      text: 'text-purple-300',
      ring: 'ring-purple-400/60',
    },
    {
      bg: 'bg-pink-500/20 hover:bg-pink-500/30',
      border: 'border-pink-400',
      handle: 'bg-pink-400 text-slate-950',
      text: 'text-pink-300',
      ring: 'ring-pink-400/60',
    },
  ];

  // Drag handlers for segment boundaries on waveform
  const handleStartDragSegment = (
    e: React.PointerEvent,
    segId: string,
    type: 'left' | 'right' | 'move'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const seg = segments.find((s) => s.id === segId);
    if (!seg || duration <= 0) return;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}

    setDraggingSegment({
      id: segId,
      type,
      startX: e.clientX,
      initialStart: seg.startTime,
      initialEnd: seg.endTime,
    });
  };

  const handlePointerMoveSegment = (e: React.PointerEvent) => {
    if (!draggingSegment || !waveformContainerRef.current || duration <= 0) return;

    const rect = waveformContainerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;

    const deltaX = e.clientX - draggingSegment.startX;
    const deltaTime = (deltaX / rect.width) * duration;
    const minSegLen = 0.2; // 200ms minimum duration

    let targetNewStart = draggingSegment.initialStart;
    let targetNewEnd = draggingSegment.initialEnd;

    if (draggingSegment.type === 'left') {
      targetNewStart = Math.max(0, Math.min(draggingSegment.initialEnd - minSegLen, draggingSegment.initialStart + deltaTime));
      targetNewStart = Math.round(targetNewStart * 100) / 100;
    } else if (draggingSegment.type === 'right') {
      targetNewEnd = Math.min(duration, Math.max(draggingSegment.initialStart + minSegLen, draggingSegment.initialEnd + deltaTime));
      targetNewEnd = Math.round(targetNewEnd * 100) / 100;
    } else if (draggingSegment.type === 'move') {
      const segLen = draggingSegment.initialEnd - draggingSegment.initialStart;
      targetNewStart = draggingSegment.initialStart + deltaTime;
      targetNewEnd = draggingSegment.initialEnd + deltaTime;

      if (targetNewStart < 0) {
        targetNewStart = 0;
        targetNewEnd = segLen;
      }
      if (targetNewEnd > duration) {
        targetNewEnd = duration;
        targetNewStart = Math.max(0, duration - segLen);
      }

      targetNewStart = Math.round(targetNewStart * 100) / 100;
      targetNewEnd = Math.round(targetNewEnd * 100) / 100;
    }

    setSegments((prev) => {
      // 1. Update target segment boundaries
      const updated = prev.map((s) => {
        if (s.id !== draggingSegment.id) return s;
        return { ...s, startTime: targetNewStart, endTime: targetNewEnd };
      });

      // 2. Automatically shrink/adjust adjacent segments if invaded
      const sortedByInitial = [...prev].sort((a, b) => a.startTime - b.startTime);
      const targetIndex = sortedByInitial.findIndex((s) => s.id === draggingSegment.id);

      if (targetIndex === -1) return updated;

      // Adjust rightward neighbors if target's end invades them
      if (draggingSegment.type === 'right' || draggingSegment.type === 'move') {
        let pushLimit = targetNewEnd;
        for (let i = targetIndex + 1; i < sortedByInitial.length; i++) {
          const neighborId = sortedByInitial[i].id;
          const uIdx = updated.findIndex((s) => s.id === neighborId);
          if (uIdx !== -1) {
            const seg = updated[uIdx];
            if (seg.startTime < pushLimit) {
              const newNeighborStart = Math.round(pushLimit * 100) / 100;
              let newNeighborEnd = seg.endTime;
              if (newNeighborEnd < newNeighborStart + minSegLen) {
                newNeighborEnd = Math.min(duration, Math.round((newNeighborStart + minSegLen) * 100) / 100);
              }
              updated[uIdx] = { ...seg, startTime: newNeighborStart, endTime: newNeighborEnd };
              pushLimit = newNeighborEnd;
            } else {
              break;
            }
          }
        }
      }

      // Adjust leftward neighbors if target's start invades them
      if (draggingSegment.type === 'left' || draggingSegment.type === 'move') {
        let pushLimit = targetNewStart;
        for (let i = targetIndex - 1; i >= 0; i--) {
          const neighborId = sortedByInitial[i].id;
          const uIdx = updated.findIndex((s) => s.id === neighborId);
          if (uIdx !== -1) {
            const seg = updated[uIdx];
            if (seg.endTime > pushLimit) {
              const newNeighborEnd = Math.round(pushLimit * 100) / 100;
              let newNeighborStart = seg.startTime;
              if (newNeighborStart > newNeighborEnd - minSegLen) {
                newNeighborStart = Math.max(0, Math.round((newNeighborEnd - minSegLen) * 100) / 100);
              }
              updated[uIdx] = { ...seg, startTime: newNeighborStart, endTime: newNeighborEnd };
              pushLimit = newNeighborStart;
            } else {
              break;
            }
          }
        }
      }

      return updated;
    });
  };

  const handlePointerUpSegment = (e: React.PointerEvent) => {
    if (draggingSegment) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
      setDraggingSegment(null);
    }
  };

  // Multi-Segment Cutter Actions
  const handleAddSegment = () => {
    if (duration <= 0) return;
    const start = Math.floor(currentTime * 10) / 10;
    const end = Math.min(duration, Math.floor((start + Math.max(3, duration / 4)) * 10) / 10);

    const newSeg: AudioSegment = {
      id: `seg-${Date.now()}`,
      name: `Đoạn ${segments.length + 1}`,
      startTime: start,
      endTime: end,
    };
    setSegments((prev) => [...prev, newSeg]);
  };

  // Insert Segment Between 2 Regions (size = 1/2 of segment after, push segment after rightward)
  const handleInsertSegmentBetween = (index: number) => {
    if (duration <= 0 || segments.length === 0) return;

    setSegments((prev) => {
      const sorted = [...prev].sort((a, b) => a.startTime - b.startTime);
      const segCurrent = sorted[index];
      if (!segCurrent) return prev;

      const segAfter = sorted[index + 1];

      if (segAfter) {
        // Insertion between segCurrent and segAfter
        const origStart = segAfter.startTime;
        const origEnd = segAfter.endTime;
        const origDur = Math.max(0.2, origEnd - origStart);
        const newDur = Math.max(0.1, Math.round((origDur / 2) * 100) / 100);

        // New Segment created taking half duration of segAfter
        const newSeg: AudioSegment = {
          id: `seg-split-${Date.now()}`,
          name: `Đoạn ${sorted.length + 1}`,
          startTime: origStart,
          endTime: Math.round((origStart + newDur) * 100) / 100,
        };

        // Push segAfter and all subsequent segments back by newDur
        const updated = sorted.map((s, idx) => {
          if (idx <= index) return s; // Before or current stays unchanged
          const shiftedStart = Math.min(duration, Math.round((s.startTime + newDur) * 100) / 100);
          const shiftedEnd = Math.min(duration, Math.round((s.endTime + newDur) * 100) / 100);
          return {
            ...s,
            startTime: shiftedStart,
            endTime: Math.max(shiftedStart + 0.1, shiftedEnd),
          };
        });

        // Insert newSeg right after index
        updated.splice(index + 1, 0, newSeg);
        return updated;
      } else {
        // At the end after the last segment
        const origStart = segCurrent.endTime;
        const availableSpace = duration - origStart;
        const segDur = segCurrent.endTime - segCurrent.startTime;
        const newDur = availableSpace > 0.3 ? Math.min(availableSpace, Math.round((segDur / 2) * 100) / 100) : 1.0;

        const newStart = Math.min(duration - 0.1, origStart);
        const newEnd = Math.min(duration, newStart + Math.max(0.2, newDur));

        const newSeg: AudioSegment = {
          id: `seg-append-${Date.now()}`,
          name: `Đoạn ${sorted.length + 1}`,
          startTime: Math.round(newStart * 100) / 100,
          endTime: Math.round(newEnd * 100) / 100,
        };

        return [...sorted, newSeg];
      }
    });
  };

  const handleSplitEqual = (count: number) => {
    if (duration <= 0 || count <= 0) return;
    const step = duration / count;
    const newSegments: AudioSegment[] = [];

    for (let i = 0; i < count; i++) {
      const s = Math.floor(i * step * 10) / 10;
      const e = Math.min(duration, Math.floor((i + 1) * step * 10) / 10);
      newSegments.push({
        id: `seg-${Date.now()}-${i}`,
        name: `Đoạn ${i + 1}`,
        startTime: s,
        endTime: e,
      });
    }
    setSegments(newSegments);
  };

  const handleSplitBySilence = () => {
    if (!audioBuffer) {
      alert('Đang giải mã dữ liệu âm thanh, vui lòng thử lại sau giây lát!');
      return;
    }
    const detected = detectSilenceBoundaries(audioBuffer, 0.15, 0.012);
    if (detected.length === 0) {
      alert('Không tìm thấy khoảng lặng rõ ràng trong audio để phân tách.');
      return;
    }
    setSegments(detected);
  };

  const handleUpdateSegment = (id: string, field: keyof AudioSegment, value: any) => {
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const updated = { ...s, [field]: value };
          if (field === 'startTime' && updated.startTime >= updated.endTime) {
            updated.endTime = Math.min(duration, updated.startTime + 0.5);
          }
          return updated;
        }
        return s;
      })
    );
  };

  // Delete Segment & Fill Gap by shifting subsequent segments left
  const handleDeleteSegment = (id: string) => {
    setSegments((prev) => {
      const sorted = [...prev].sort((a, b) => a.startTime - b.startTime);
      const targetIdx = sorted.findIndex((s) => s.id === id);
      if (targetIdx === -1) return prev.filter((s) => s.id !== id);

      const targetSeg = sorted[targetIdx];
      const gap = Math.max(0, targetSeg.endTime - targetSeg.startTime);

      const remaining = sorted.filter((s) => s.id !== id);

      // Shift all segments that came after targetSeg leftward by `gap` to fill deleted region
      return remaining.map((s, idx) => {
        if (idx < targetIdx) return s; // Segments before target stay unchanged
        const newStart = Math.max(0, Math.round((s.startTime - gap) * 100) / 100);
        const newEnd = Math.max(newStart + 0.1, Math.round((s.endTime - gap) * 100) / 100);
        return {
          ...s,
          startTime: newStart,
          endTime: newEnd,
        };
      });
    });
  };

  const handlePlaySegment = (seg: AudioSegment) => {
    if (!audioRef.current) return;

    if (activeSegmentPlayingId === seg.id && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setActiveSegmentPlayingId(null);
      return;
    }

    audioRef.current.currentTime = seg.startTime;
    audioRef.current.playbackRate = playbackSpeed;
    setActiveSegmentPlayingId(seg.id);
    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch((err) => console.warn('Play segment error:', err));
  };

  // Export single cut segment
  const handleExportSingleSegment = async (seg: AudioSegment, idx: number) => {
    if (!audioBuffer) {
      alert('Đang tải dữ liệu âm thanh, vui lòng thử lại sau giây lát!');
      return;
    }

    try {
      const sliced = sliceAudioBuffer(audioBuffer, seg.startTime, seg.endTime);
      const wavBlob = audioBufferToWavBlob(sliced);
      const filename = constructExportFilename(
        title,
        speakerNames,
        createdAt,
        'wav',
        `Doan${idx + 1}_${seg.name.replace(/\s+/g, '_')}`
      );
      downloadAudioFile(wavBlob, filename);
    } catch (err) {
      console.error('Error exporting segment:', err);
    }
  };

  // Export ALL cut segments sequentially
  const handleExportAllSegments = async () => {
    if (segments.length === 0) return;
    if (!audioBuffer) {
      alert('Đang tải dữ liệu âm thanh, vui lòng thử lại sau giây lát!');
      return;
    }

    setIsExportingSegments(true);

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      try {
        const sliced = sliceAudioBuffer(audioBuffer, seg.startTime, seg.endTime);
        const wavBlob = audioBufferToWavBlob(sliced);
        const filename = constructExportFilename(
          title,
          speakerNames,
          createdAt,
          'wav',
          `Doan${i + 1}_${seg.name.replace(/\s+/g, '_')}`
        );
        downloadAudioFile(wavBlob, filename);

        // Small delay between downloads so browser accepts multiple file downloads
        await new Promise((resolve) => setTimeout(resolve, 400));
      } catch (err) {
        console.error(`Error exporting segment ${i + 1}:`, err);
      }
    }

    setIsExportingSegments(false);
  };

  // Handle Export Full File
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const filename = constructExportFilename(title, speakerNames, createdAt, exportFormat);

      if (exportFormat === 'wav') {
        downloadAudioFile(audioUrl, filename);
      } else {
        const audioRes = await fetch(audioUrl);
        const blob = await audioRes.blob();
        downloadAudioFile(blob, filename);
      }

      if (onSaveToHistory) {
        onSaveToHistory(exportFormat);
      }
      setShowExportModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  // Copy Data URL / Sharing Link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(audioUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4">
      {/* Track Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
            <Volume2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-100 line-clamp-1">{title}</h3>
            <span className="text-xs text-cyan-400 font-medium flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Gemini TTS Audio High Quality (24kHz)
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSegmentCutter((prev) => !prev)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold transition flex items-center space-x-1.5 shadow-sm ${
              showSegmentCutter
                ? 'bg-amber-950/80 text-amber-300 border-amber-600/80'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700'
            }`}
            title="Mở công cụ chia/cắt audio thành nhiều đoạn nhỏ để xuất file"
          >
            <Scissors className="h-4 w-4" />
            <span>{showSegmentCutter ? 'Đóng Công Cụ Cắt' : 'Cắt Nhiều Đoạn'}</span>
            {segments.length > 0 && (
              <span className="ml-1 bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold">
                {segments.length}
              </span>
            )}
          </button>

          <button
            onClick={handleCopyLink}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition flex items-center space-x-1.5 text-xs font-semibold"
            title="Sao chép liên kết / dữ liệu"
          >
            {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{copiedLink ? 'Đã chép' : 'Chia sẻ'}</span>
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold text-xs transition shadow-lg shadow-cyan-500/20 flex items-center space-x-1.5"
          >
            <Download className="h-4 w-4" />
            <span>Xuất File Cả Bài</span>
          </button>
        </div>
      </div>

      {/* Real Waveform Canvas with interactive seek & draggable cut region overlays */}
      <div
        ref={waveformContainerRef}
        onPointerMove={handlePointerMoveSegment}
        onPointerUp={handlePointerUpSegment}
        className="bg-slate-950 rounded-xl p-3 border border-slate-800 flex flex-col justify-center items-center relative overflow-hidden group select-none touch-none"
      >
        <canvas
          ref={canvasRef}
          width={700}
          height={80}
          onClick={handleCanvasClick}
          className="w-full h-20 cursor-pointer"
          title="Bấm vào sóng âm thanh để phát tại vị trí đó"
        />

        {/* Draggable Cut Region Overlay Tracks */}
        {showSegmentCutter && duration > 0 && segments.length > 0 && (
          <div className="absolute inset-x-3 inset-y-3 pointer-events-none">
            {segments.map((seg, idx) => {
              const leftPct = Math.max(0, Math.min(100, (seg.startTime / duration) * 100));
              const rightPct = Math.max(0, Math.min(100, (seg.endTime / duration) * 100));
              const widthPct = Math.max(0.5, rightPct - leftPct);
              const colorScheme = SEGMENT_COLOR_SCHEMES[idx % SEGMENT_COLOR_SCHEMES.length];
              const isDraggingThis = draggingSegment?.id === seg.id;

              return (
                <div
                  key={seg.id}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  className={`absolute top-0 bottom-0 pointer-events-auto border-x-2 border-y ${colorScheme.bg} ${colorScheme.border} rounded-md transition-colors flex justify-between items-center group/seg ${
                    isDraggingThis ? 'z-30 ring-2 ' + colorScheme.ring : 'z-10 hover:z-20'
                  }`}
                >
                  {/* Left Drag Handle */}
                  <div
                    onPointerDown={(e) => handleStartDragSegment(e, seg.id, 'left')}
                    className="absolute -left-2.5 top-0 bottom-0 w-5 cursor-col-resize flex items-center justify-center z-30 group/hleft"
                    title="Kéo sang TÍM/TRÁI/PHẢI để chỉnh mốc BẮT ĐẦU"
                  >
                    <div
                      className={`w-2 h-full rounded-l-md ${colorScheme.handle} flex items-center justify-center shadow-md group-hover/hleft:scale-110 transition-transform`}
                    >
                      <div className="w-0.5 h-4 bg-slate-950/70 rounded-full" />
                    </div>
                  </div>

                  {/* Move Entire Segment Area & Quick Buttons */}
                  <div
                    onPointerDown={(e) => handleStartDragSegment(e, seg.id, 'move')}
                    className="w-full h-full cursor-grab active:cursor-grabbing flex flex-col items-center justify-center overflow-hidden px-1 py-1 group/body space-y-1 select-none"
                    title="Kéo thả để di chuyển TOÀN BỘ vùng cắt"
                  >
                    <div className="flex items-center space-x-1 px-1.5 py-0.5 bg-slate-950/90 rounded border border-white/10 shadow text-[10px] font-bold text-slate-100 max-w-full truncate pointer-events-none">
                      <span className={`${colorScheme.text} font-mono`}>#{idx + 1}</span>
                      <span className="truncate">{seg.name}</span>
                      <span className="text-[9px] text-slate-400 font-mono hidden sm:inline">
                        ({formatTime(seg.startTime)}-{formatTime(seg.endTime)})
                      </span>
                    </div>

                    {/* 3 Quick Action Buttons: Play/Pause, Download, Delete */}
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      className="flex items-center space-x-1 pointer-events-auto"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlaySegment(seg);
                        }}
                        className={`p-1 rounded-md transition border shadow-sm flex items-center justify-center ${
                          activeSegmentPlayingId === seg.id && isPlaying
                            ? 'bg-rose-600 text-white border-rose-400'
                            : 'bg-slate-950/90 hover:bg-cyan-500 text-cyan-400 hover:text-slate-950 border-cyan-500/30'
                        }`}
                        title={activeSegmentPlayingId === seg.id && isPlaying ? 'Dừng phát' : 'Nghe thử đoạn này'}
                      >
                        {activeSegmentPlayingId === seg.id && isPlaying ? (
                          <Pause className="h-3 w-3 fill-current" />
                        ) : (
                          <Play className="h-3 w-3 fill-current ml-0.5" />
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportSingleSegment(seg, idx);
                        }}
                        className="p-1 bg-slate-950/90 hover:bg-cyan-500 text-cyan-400 hover:text-slate-950 rounded-md border border-cyan-500/30 shadow-sm transition flex items-center justify-center"
                        title="Tải về file WAV riêng cho đoạn này"
                      >
                        <Download className="h-3 w-3" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSegment(seg.id);
                        }}
                        className="p-1 bg-slate-950/90 hover:bg-rose-600 text-slate-400 hover:text-white rounded-md border border-slate-700/60 hover:border-rose-500/50 shadow-sm transition flex items-center justify-center"
                        title="Xóa ngay vùng cắt này"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Right Drag Handle */}
                  <div
                    onPointerDown={(e) => handleStartDragSegment(e, seg.id, 'right')}
                    className="absolute -right-2.5 top-0 bottom-0 w-5 cursor-col-resize flex items-center justify-center z-30 group/hright"
                    title="Kéo sang TRÁI/PHẢI để chỉnh mốc KẾT THÚC"
                  >
                    <div
                      className={`w-2 h-full rounded-r-md ${colorScheme.handle} flex items-center justify-center shadow-md group-hover/hright:scale-110 transition-transform`}
                    >
                      <div className="w-0.5 h-4 bg-slate-950/70 rounded-full" />
                    </div>
                  </div>

                  {/* Plus (+) Button Between Cut Regions */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInsertSegmentBetween(idx);
                    }}
                    className="absolute -right-3.5 top-1/2 -translate-y-1/2 z-40 w-6 h-6 rounded-full bg-cyan-400 hover:bg-cyan-300 active:scale-90 text-slate-950 font-black flex items-center justify-center shadow-xl border-2 border-slate-950 hover:scale-110 transition cursor-pointer pointer-events-auto"
                    title="Thêm 1 vùng cắt mới vào giữa (kích thước = 1/2 vùng sau, đẩy vùng sau về sau)"
                  >
                    <Plus className="h-3.5 w-3.5 stroke-[3]" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Live Dragging Tooltip Indicator */}
        {draggingSegment && (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 text-[11px] font-extrabold px-3 py-0.5 rounded-full shadow-lg border border-amber-300 z-40 animate-pulse flex items-center gap-1.5">
            <Scissors className="h-3.5 w-3.5 shrink-0" />
            <span>
              Đang kéo {draggingSegment.type === 'left' ? 'điểm bắt đầu' : draggingSegment.type === 'right' ? 'điểm kết thúc' : 'toàn bộ vùng'}
            </span>
          </div>
        )}

        <div className="absolute top-1 right-2 text-[10px] text-slate-500 font-mono pointer-events-none opacity-80 group-hover:opacity-100 transition">
          Sóng âm chuẩn 24kHz • Kéo đầu/cuối thanh để chỉnh mốc cắt
        </div>
      </div>

      {/* Scrub Bar */}
      <div className="space-y-1">
        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.05"
          value={currentTime}
          onChange={handleSeek}
          className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
        />
        <div className="flex justify-between text-[11px] font-mono text-slate-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Main Playback Controls */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center space-x-2">
          <button
            onClick={togglePlay}
            className="h-11 w-11 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center justify-center transition shadow-lg shadow-cyan-500/30"
          >
            {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
          </button>

          <button
            onClick={handleReplay}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Phát lại từ đầu"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            onClick={toggleMute}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        {/* Playback Speed Quick Select */}
        <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400 ml-1" />
          {[0.75, 1.0, 1.25, 1.5].map((speed) => (
            <button
              key={speed}
              onClick={() => {
                setPlaybackSpeed(speed);
                if (audioRef.current) audioRef.current.playbackRate = speed;
              }}
              className={`px-2 py-0.5 rounded-lg transition ${
                playbackSpeed === speed
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* Multi-Segment Audio Cutter Tool Panel */}
      {showSegmentCutter && (
        <div className="bg-slate-950/90 border border-amber-500/30 rounded-xl p-4 space-y-4 animate-fade-in shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Scissors className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-100">
                  Công Cụ Chia & Cắt Âm Thanh Thành Nhiều Đoạn
                </h4>
                <p className="text-[11px] text-slate-400">
                  Tạo các mốc thời gian để nghe thử từng đoạn hoặc tải xuống hàng loạt từng file audio riêng lẻ
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleAddSegment}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-md"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Thêm Vùng Cắt</span>
              </button>

              {segments.length > 0 && (
                <button
                  onClick={handleExportAllSegments}
                  disabled={isExportingSegments}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-md disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>
                    {isExportingSegments ? 'Đang Xuất Hàng Loạt...' : `Tải Về Tất Cả (${segments.length} Đoạn)`}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Split presets buttons */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 shrink-0">Tự Động Phân Tách:</span>
            <button
              onClick={handleSplitBySilence}
              className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-[11px] font-extrabold rounded-lg shadow-sm transition flex items-center gap-1.5"
              title="Tự động phân tích sóng âm thanh và cắt thành từng câu thoại dựa trên khoảng ngắt nghỉ (Silences)"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>Tự Động Cắt Theo Khoảng Lặng (Từng Câu)</span>
            </button>

            <span className="text-[11px] font-semibold text-slate-500 shrink-0 ml-1">Chia Đều:</span>
            {[2, 3, 4, 5].map((cnt) => (
              <button
                key={cnt}
                onClick={() => handleSplitEqual(cnt)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold rounded border border-slate-700 transition"
              >
                {cnt} Đoạn
              </button>
            ))}
          </div>

          {/* List of created segments */}
          {segments.length === 0 ? (
            <div className="p-4 text-center border border-dashed border-slate-800 rounded-lg text-xs text-slate-500 space-y-1">
              <div>Chưa có đoạn cắt nào.</div>
              <div>Bấm nút <span className="text-amber-400 font-semibold">+ Thêm Vùng Cắt</span> hoặc <span className="text-amber-400 font-semibold">Chia Đều</span> để bắt đầu cắt nhỏ audio.</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
              {segments.map((seg, idx) => {
                const segDuration = Math.max(0, Math.floor((seg.endTime - seg.startTime) * 10) / 10);
                const isPlayingThisSeg = activeSegmentPlayingId === seg.id && isPlaying;

                return (
                  <div
                    key={seg.id}
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition ${
                      isPlayingThisSeg
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 w-full sm:w-auto">
                      <span className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={seg.name}
                        onChange={(e) => handleUpdateSegment(seg.id, 'name', e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-semibold focus:outline-none focus:border-amber-500 w-32"
                      />
                      <span className="text-[11px] text-slate-400 font-mono shrink-0">
                        ({segDuration}s)
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                      {/* Time Controls */}
                      <div className="flex items-center space-x-1.5 text-xs font-mono">
                        <span className="text-[10px] text-slate-500">Từ:</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max={seg.endTime - 0.1}
                          value={seg.startTime}
                          onChange={(e) =>
                            handleUpdateSegment(seg.id, 'startTime', parseFloat(e.target.value) || 0)
                          }
                          className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 w-16 text-xs text-cyan-300 font-semibold focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500">Đến:</span>
                        <input
                          type="number"
                          step="0.1"
                          min={seg.startTime + 0.1}
                          max={duration}
                          value={seg.endTime}
                          onChange={(e) =>
                            handleUpdateSegment(seg.id, 'endTime', parseFloat(e.target.value) || duration)
                          }
                          className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 w-16 text-xs text-cyan-300 font-semibold focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500">giây</span>
                      </div>

                      {/* Actions for this segment */}
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handlePlaySegment(seg)}
                          className={`p-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1 ${
                            isPlayingThisSeg
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                          }`}
                          title="Phát nghe thử chỉ đoạn này"
                        >
                          {isPlayingThisSeg ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          <span className="text-[11px]">Nghe</span>
                        </button>

                        <button
                          onClick={() => handleExportSingleSegment(seg, idx)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg border border-slate-700 transition"
                          title="Tải riêng file WAV của đoạn này"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteSegment(seg.id)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-950 text-rose-400 rounded-lg border border-slate-700 transition"
                          title="Xóa đoạn cắt này"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Multi-Format Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <FileAudio className="h-5 w-5 text-cyan-400" />
                <span>Xuất File Âm Thanh Cả Bài Đa Định Dạng</span>
              </h4>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 block">
                Chọn định dạng xuất file:
              </label>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'wav', name: 'WAV (Lossless 24kHz)', desc: 'Chất lượng âm thanh chuẩn mã hóa gốc' },
                  { id: 'mp3', name: 'MP3 (Phổ Biến)', desc: 'Tương thích tất cả thiết bị & trình phát' },
                  { id: 'ogg', name: 'OGG (Nén Web)', desc: 'Kích thước nhẹ, mượt mà' },
                  { id: 'aac', name: 'AAC / M4A', desc: 'Chất lượng cao trên thiết bị di động' },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => setExportFormat(fmt.id as any)}
                    className={`p-3 rounded-xl border text-left transition ${
                      exportFormat === fmt.id
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 ring-1 ring-cyan-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold text-xs uppercase">{fmt.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{fmt.desc}</div>
                  </button>
                ))}
              </div>

              {/* Filename Preview Box */}
              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                  Tên tệp tin sẽ xuất (Nhân vật + Thời gian tạo):
                </span>
                <span className="text-xs font-mono text-cyan-300 font-semibold break-all select-all block">
                  {constructExportFilename(title, speakerNames, createdAt, exportFormat)}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Hủy
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center space-x-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isExporting ? 'Đang xuất...' : 'Tải File Về Máy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

