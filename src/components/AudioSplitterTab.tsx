import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import {
  decodeAudioData,
  sliceAudioBuffer,
  audioBufferToWavBlob,
  downloadAudioFile,
  detectSilenceBoundaries,
  processSegmentAudioBuffer,
  mergeAudioBuffers,
  SilenceBoundarySegment,
} from '../utils/audioEncoder';
import { AudioTrack } from '../types';
import {
  Scissors,
  Upload,
  Play,
  Pause,
  Download,
  Trash2,
  Sparkles,
  Plus,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Volume2,
  Sliders,
  FileAudio,
  Check,
  FolderArchive,
  Info,
  Gauge,
  Zap,
  FastForward,
  Combine,
  Lightbulb,
  Layers,
} from 'lucide-react';

interface AudioSplitterTabProps {
  history: AudioTrack[];
  activeAudioUrl?: string | null;
  activeAudioTitle?: string | null;
}

interface AudioSegment {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
}

export const AudioSplitterTab: React.FC<AudioSplitterTabProps> = ({
  history,
  activeAudioUrl,
  activeAudioTitle,
}) => {
  const [selectedAudioSource, setSelectedAudioSource] = useState<'upload' | 'active' | 'history'>('upload');
  const [selectedHistoryTrackId, setSelectedHistoryTrackId] = useState<string>('');
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(activeAudioUrl || null);
  const [audioTitle, setAudioTitle] = useState<string>(activeAudioTitle || 'Audio File');
  
  // Audio Decoding & Canvas States
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);

  // Audio Effects & Processing States
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0); // 0.5x - 2.5x
  const [bassBoostDb, setBassBoostDb] = useState<number>(0);       // -12dB to +12dB
  const [fadeInSec, setFadeInSec] = useState<number>(0);           // 0s to 3s
  const [fadeOutSec, setFadeOutSec] = useState<number>(0);         // 0s to 3s
  const [isNormalized, setIsNormalized] = useState<boolean>(true); // Volume Normalization (default enabled)

  // Zoom State
  const [zoomLevel, setZoomLevel] = useState<number>(2.5); // 1x to 25x zoom (default 250%)

  // Segment Cutter States
  const [segments, setSegments] = useState<AudioSegment[]>([]);
  const [activeSegmentPlayingId, setActiveSegmentPlayingId] = useState<string | null>(null);

  // Silence Detection Parameters
  const [minSilenceDuration, setMinSilenceDuration] = useState<number>(0.15); // 150ms
  const [silenceThreshold, setSilenceThreshold] = useState<number>(0.012);   // amplitude

  // Draggable Region State
  const [draggingSegment, setDraggingSegment] = useState<{
    id: string;
    type: 'left' | 'right' | 'move';
    startX: number;
    initialStart: number;
    initialEnd: number;
  } | null>(null);

  // Batch Exporting State
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [isMergingAudio, setIsMergingAudio] = useState<boolean>(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const activePreviewUrlRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Helper to generate & play processed live preview matching exported file 100%
  const generateAndPlayPreview = useCallback(
    async (targetSegId?: string | null) => {
      if (!audioBuffer) return;

      let segToPlay = targetSegId ? segments.find((s) => s.id === targetSegId) : null;
      if (!segToPlay && segments.length > 0) {
        segToPlay = segments[0];
      }

      const startTime = segToPlay ? segToPlay.startTime : 0;
      const endTime = segToPlay ? segToPlay.endTime : (duration || audioBuffer.duration);

      if (endTime <= startTime) return;

      try {
        const sliced = sliceAudioBuffer(audioBuffer, startTime, endTime);
        const processed = await processSegmentAudioBuffer(sliced, {
          speed: playbackSpeed,
          bassDb: bassBoostDb,
          fadeInSec,
          fadeOutSec,
          normalize: isNormalized,
        });

        const wavBlob = audioBufferToWavBlob(processed);
        const newUrl = URL.createObjectURL(wavBlob);

        if (activePreviewUrlRef.current) {
          URL.revokeObjectURL(activePreviewUrlRef.current);
        }
        activePreviewUrlRef.current = newUrl;

        if (previewAudioRef.current) {
          previewAudioRef.current.src = newUrl;
          previewAudioRef.current
            .play()
            .then(() => {
              setIsPlaying(true);
              setActiveSegmentPlayingId(segToPlay ? segToPlay.id : 'full-preview');
            })
            .catch((e) => console.warn('Preview play error:', e));
        }
      } catch (err) {
        console.error('Failed to generate live preview audio:', err);
      }
    },
    [audioBuffer, duration, segments, playbackSpeed, bassBoostDb, fadeInSec, fadeOutSec, isNormalized]
  );

  // Update live preview when user changes sliders while playing
  useEffect(() => {
    if (isPlaying && audioBuffer) {
      generateAndPlayPreview(activeSegmentPlayingId);
    }
  }, [playbackSpeed, bassBoostDb, fadeInSec, fadeOutSec, isNormalized]);

  // Toggle or start live preview when user interacts with effects panel
  const toggleLivePreviewPlay = () => {
    if (isPlaying) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setIsPlaying(false);
      setActiveSegmentPlayingId(null);
    } else {
      generateAndPlayPreview(activeSegmentPlayingId);
    }
  };

  // Sync previewAudio playback progress to waveform time cursor
  useEffect(() => {
    const previewAudio = previewAudioRef.current;
    if (!previewAudio) return;

    const onTimeUpdate = () => {
      const seg = activeSegmentPlayingId ? segments.find((s) => s.id === activeSegmentPlayingId) : null;
      const segStart = seg ? seg.startTime : 0;
      const actualElapsed = previewAudio.currentTime * playbackSpeed;
      setCurrentTime(segStart + actualElapsed);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setActiveSegmentPlayingId(null);
    };

    previewAudio.addEventListener('timeupdate', onTimeUpdate);
    previewAudio.addEventListener('ended', onEnded);

    return () => {
      previewAudio.removeEventListener('timeupdate', onTimeUpdate);
      previewAudio.removeEventListener('ended', onEnded);
    };
  }, [activeSegmentPlayingId, segments, playbackSpeed]);

  // Load active audio URL if changed and no audio selected, or auto-load history track if available
  useEffect(() => {
    if (activeAudioUrl && !audioUrl) {
      setAudioUrl(activeAudioUrl);
      setAudioTitle(activeAudioTitle || 'Gemini Audio Track');
      setSelectedAudioSource('active');
    } else if (!audioUrl && history.length > 0 && !selectedHistoryTrackId) {
      const topTrack = history[0];
      setSelectedHistoryTrackId(topTrack.id);
      setAudioUrl(topTrack.audioUrl);
      setAudioTitle(topTrack.title);
      setSelectedAudioSource('history');
    }
  }, [activeAudioUrl, activeAudioTitle, history]);

  // Decode audio data when audioUrl changes
  useEffect(() => {
    if (!audioUrl) {
      setAudioBuffer(null);
      setWaveformPeaks([]);
      setDuration(0);
      setSegments([]);
      return;
    }

    let isMounted = true;
    setIsLoadingAudio(true);

    decodeAudioData(audioUrl)
      .then((buffer) => {
        if (!isMounted) return;
        setAudioBuffer(buffer);
        setDuration(buffer.duration);

        // Extract 200 waveform peak points for detailed rendering
        const channelData = buffer.getChannelData(0);
        const samples = 200;
        const blockSize = Math.floor(channelData.length / samples);
        const peaks: number[] = [];

        for (let i = 0; i < samples; i++) {
          const start = i * blockSize;
          let max = 0;
          for (let j = 0; j < blockSize; j++) {
            const val = Math.abs(channelData[start + j] || 0);
            if (val > max) max = val;
          }
          peaks.push(max);
        }

        setWaveformPeaks(peaks);
        setIsLoadingAudio(false);

        // Auto detect initial silence boundaries
        const autoDetected = detectSilenceBoundaries(buffer, minSilenceDuration, silenceThreshold);
        if (autoDetected.length > 0) {
          setSegments(autoDetected);
        } else {
          // Default to 1 full segment if no silence found
          setSegments([
            {
              id: `seg-default-${Date.now()}`,
              name: 'Câu 1',
              startTime: 0,
              endTime: Math.round(buffer.duration * 100) / 100,
            },
          ]);
        }
      })
      .catch((err) => {
        console.warn('Error decoding audio buffer for splitter:', err);
        if (isMounted) setIsLoadingAudio(false);
      });

    return () => {
      isMounted = false;
    };
  }, [audioUrl]);



  // Mouse wheel zoom on waveform container
  const handleWheelZoom = useCallback((e: React.WheelEvent) => {
    if (!waveformContainerRef.current) return;
    
    // Zoom in on wheel UP, Zoom out on wheel DOWN
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 0.3 : -0.3;
    setZoomLevel((prev) => Math.min(25, Math.max(1, Math.round((prev + zoomDelta) * 10) / 10)));
  }, []);

  // Color Palette for Segments
  const SEGMENT_COLORS = [
    { bg: 'bg-cyan-500/20 hover:bg-cyan-500/30', border: 'border-cyan-400', handle: 'bg-cyan-400 text-slate-950', text: 'text-cyan-300' },
    { bg: 'bg-amber-500/20 hover:bg-amber-500/30', border: 'border-amber-400', handle: 'bg-amber-400 text-slate-950', text: 'text-amber-300' },
    { bg: 'bg-emerald-500/20 hover:bg-emerald-500/30', border: 'border-emerald-400', handle: 'bg-emerald-400 text-slate-950', text: 'text-emerald-300' },
    { bg: 'bg-purple-500/20 hover:bg-purple-500/30', border: 'border-purple-400', handle: 'bg-purple-400 text-slate-950', text: 'text-purple-300' },
    { bg: 'bg-pink-500/20 hover:bg-pink-500/30', border: 'border-pink-400', handle: 'bg-pink-400 text-slate-950', text: 'text-pink-300' },
  ];

  // Render Waveform Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bars = waveformPeaks.length > 0 ? waveformPeaks.length : 120;
      const barGap = 2;
      const barWidth = (canvas.width - bars * barGap) / bars;

      const dur = duration || 1;
      const playRatio = currentTime / dur;

      // Draw Segment Highlight Backgrounds on Canvas
      if (duration > 0 && segments.length > 0) {
        segments.forEach((seg, idx) => {
          const segStartX = (seg.startTime / dur) * canvas.width;
          const segEndX = (seg.endTime / dur) * canvas.width;
          const segW = Math.max(2, segEndX - segStartX);

          const fillColors = [
            'rgba(6, 182, 212, 0.18)',
            'rgba(245, 158, 11, 0.18)',
            'rgba(16, 185, 129, 0.18)',
            'rgba(168, 85, 247, 0.18)',
            'rgba(236, 72, 153, 0.18)',
          ];
          const borderColors = [
            'rgba(6, 182, 212, 0.7)',
            'rgba(245, 158, 11, 0.7)',
            'rgba(16, 185, 129, 0.7)',
            'rgba(168, 85, 247, 0.7)',
            'rgba(236, 72, 153, 0.7)',
          ];

          const colorIdx = idx % fillColors.length;

          ctx.fillStyle = fillColors[colorIdx];
          ctx.fillRect(segStartX, 0, segW, canvas.height);

          // Vertical boundary lines
          ctx.strokeStyle = borderColors[colorIdx];
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(segStartX, 0);
          ctx.lineTo(segStartX, canvas.height);
          ctx.moveTo(segEndX, 0);
          ctx.lineTo(segEndX, canvas.height);
          ctx.stroke();
        });
      }

      // Draw Waveform Bars
      for (let i = 0; i < bars; i++) {
        const peakVal = waveformPeaks.length > 0 ? waveformPeaks[i] : Math.abs(Math.sin(i * 0.2)) * 0.7 + 0.1;
        let h = peakVal * (canvas.height * 0.82);

        const x = i * (barWidth + barGap);
        const y = (canvas.height - h) / 2;

        const isPlayed = i / bars <= playRatio;

        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        if (isPlayed) {
          gradient.addColorStop(0, '#38bdf8'); // sky-400
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

      // Draw Playhead line
      const playheadX = playRatio * canvas.width;
      ctx.strokeStyle = '#f43f5e'; // rose-500
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, canvas.height);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, currentTime, duration, waveformPeaks, segments, zoomLevel]);

  // Click on waveform to seek
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

  // Drag Segment Handles Logic
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
    // Account for zoom ratio
    const deltaTime = (deltaX / rect.width) * duration;
    const minSegLen = 0.1; // 100ms min length

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

  // Helper to load file object
  const processAudioFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setAudioTitle(file.name.replace(/\.[^/.]+$/, ''));
    setSelectedAudioSource('upload');
  };

  // Upload Audio File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAudioFile(file);
    }
  };

  // Drag and Drop Event Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingFile) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if leaving main area
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (
        file.type.startsWith('audio/') ||
        /\.(mp3|wav|m4a|aac|ogg|flac|webm)$/i.test(file.name)
      ) {
        processAudioFile(file);
      } else {
        alert('Vui lòng chọn một file âm thanh hợp lệ (MP3, WAV, M4A, AAC, OGG, FLAC)!');
      }
    }
  };

  // Run Auto Silence Detection Splitter
  const handleAutoSplitBySilence = () => {
    if (!audioBuffer) return;
    const detected = detectSilenceBoundaries(audioBuffer, minSilenceDuration, silenceThreshold);
    if (detected.length === 0) {
      alert('Không tìm thấy khoảng lặng rõ ràng với cấu hình hiện tại. Hãy thử giảm "Khoảng lặng tối thiểu" hoặc nhạy hơn.');
      return;
    }
    setSegments(detected);
  };

  // Quick Equal Splitter
  const handleEqualSplit = (count: number) => {
    if (duration <= 0) return;
    const step = duration / count;
    const newSegs: AudioSegment[] = [];
    for (let i = 0; i < count; i++) {
      const start = Math.round(i * step * 100) / 100;
      const end = Math.round((i + 1) * step * 100) / 100;
      newSegs.push({
        id: `equal-seg-${Date.now()}-${i}`,
        name: `Đoạn ${i + 1}`,
        startTime: start,
        endTime: Math.min(duration, end),
      });
    }
    setSegments(newSegs);
  };

  // Add Segment
  const handleAddSegment = () => {
    if (duration <= 0) return;
    const lastSeg = segments[segments.length - 1];
    const newStart = lastSeg ? Math.min(duration - 0.5, lastSeg.endTime) : 0;
    const newEnd = Math.min(duration, newStart + 2.0);

    setSegments((prev) => [
      ...prev,
      {
        id: `manual-seg-${Date.now()}`,
        name: `Đoạn ${prev.length + 1}`,
        startTime: Math.round(newStart * 100) / 100,
        endTime: Math.round(newEnd * 100) / 100,
      },
    ]);
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

  // Play / Pause Segment Preview
  const handlePlaySegment = (seg: AudioSegment) => {
    if (activeSegmentPlayingId === seg.id && isPlaying) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setIsPlaying(false);
      setActiveSegmentPlayingId(null);
      return;
    }

    generateAndPlayPreview(seg.id);
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

  // Download Single Segment
  const handleDownloadSingleSegment = async (seg: AudioSegment) => {
    if (!audioBuffer) return;
    try {
      const rawSliced = sliceAudioBuffer(audioBuffer, seg.startTime, seg.endTime);
      const processed = await processSegmentAudioBuffer(rawSliced, {
        speed: playbackSpeed,
        bassDb: bassBoostDb,
        fadeInSec,
        fadeOutSec,
        normalize: isNormalized,
      });
      const wavBlob = audioBufferToWavBlob(processed);
      downloadAudioFile(wavBlob, `${seg.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.wav`);
    } catch (e) {
      console.error('Error slicing segment:', e);
      alert('Không thể xuất đoạn âm thanh này!');
    }
  };

  // Download All Segments as ZIP
  const handleExportZipAllSegments = async () => {
    if (!audioBuffer || segments.length === 0) return;
    setIsExportingZip(true);

    try {
      const zip = new JSZip();
      const folderName = `${audioTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_Clips`;
      const folder = zip.folder(folderName) || zip;

      const sorted = [...segments].sort((a, b) => a.startTime - b.startTime);

      for (let i = 0; i < sorted.length; i++) {
        const seg = sorted[i];
        const rawSliced = sliceAudioBuffer(audioBuffer, seg.startTime, seg.endTime);
        const processed = await processSegmentAudioBuffer(rawSliced, {
          speed: playbackSpeed,
          bassDb: bassBoostDb,
          fadeInSec,
          fadeOutSec,
          normalize: isNormalized,
        });
        const wavBlob = audioBufferToWavBlob(processed);
        const prefix = String(i + 1).padStart(2, '0');
        const fileName = `${prefix}_${seg.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.wav`;

        folder.file(fileName, wavBlob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadAudioFile(zipBlob, `${folderName}.zip`);
    } catch (e) {
      console.error('Error generating ZIP archive:', e);
      alert('Có lỗi xảy ra khi đóng gói file ZIP.');
    } finally {
      setIsExportingZip(false);
    }
  };

  // Merge All Cut Segments into 1 Single Audio File
  const handleExportMergedAudio = async () => {
    if (!audioBuffer || segments.length === 0) return;
    setIsMergingAudio(true);

    try {
      const processedBuffers: AudioBuffer[] = [];
      const sorted = [...segments].sort((a, b) => a.startTime - b.startTime);

      for (const seg of sorted) {
        const rawSliced = sliceAudioBuffer(audioBuffer, seg.startTime, seg.endTime);
        const processed = await processSegmentAudioBuffer(rawSliced, {
          speed: playbackSpeed,
          bassDb: bassBoostDb,
          fadeInSec,
          fadeOutSec,
          normalize: isNormalized,
        });
        processedBuffers.push(processed);
      }

      const mergedBuffer = mergeAudioBuffers(processedBuffers);
      if (mergedBuffer) {
        const wavBlob = audioBufferToWavBlob(mergedBuffer);
        const fileName = `${audioTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_GopDaCat.wav`;
        downloadAudioFile(wavBlob, fileName);
      }
    } catch (e) {
      console.error('Error merging audio segments:', e);
      alert('Có lỗi xảy ra khi gộp các đoạn âm thanh.');
    } finally {
      setIsMergingAudio(false);
    }
  };

  // Format mm:ss.ss
  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || timeInSeconds < 0) return '0:00.00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const ms = Math.floor((timeInSeconds % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="space-y-6 relative min-h-[400px]"
    >
      {/* Visual Drop Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 bg-blue-950/85 backdrop-blur-sm border-2 border-dashed border-cyan-400 rounded-2xl z-50 flex flex-col items-center justify-center space-y-3 text-center p-6 animate-pulse">
          <div className="w-16 h-16 bg-cyan-500/20 text-cyan-400 rounded-2xl flex items-center justify-center border border-cyan-400/40 shadow-xl">
            <Upload className="h-8 w-8 animate-bounce" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Thả tệp âm thanh vào đây để cắt ngay!</h3>
            <p className="text-xs text-cyan-200">Hỗ trợ các định dạng MP3, WAV, M4A, AAC, OGG, FLAC, WEBM...</p>
          </div>
        </div>
      )}

      {/* Hidden Audio Tags */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" className="hidden" />}
      <audio ref={previewAudioRef} preload="auto" className="hidden" />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-blue-500/5 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                <Scissors className="h-5 w-5" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Công Cụ Chia & Cắt Âm Thanh Thành Nhiều Đoạn
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Phân tách file audio lớn thành từng câu thoại riêng lẻ hoàn toàn tự động dựa trên khoảng lặng hoặc ngắt thời gian.
              Tải file MP3/WAV bên ngoài lên hoặc chọn bài thu âm có sẵn trong lịch sử.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/20 transition flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              <span>Tải File Audio Lên</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Source Selection Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Source Option 1: File Upload */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`p-4 rounded-xl border transition cursor-pointer flex items-center gap-3.5 ${
            selectedAudioSource === 'upload' && audioUrl
              ? 'bg-blue-950/40 border-blue-500/80 shadow-md'
              : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800'
          }`}
        >
          <div className="p-3 bg-blue-600/20 text-blue-400 rounded-lg shrink-0">
            <Upload className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Tải File Từ Máy</span>
              {selectedAudioSource === 'upload' && audioUrl && (
                <Check className="h-3.5 w-3.5 text-blue-400" />
              )}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {selectedAudioSource === 'upload' && audioTitle ? audioTitle : 'Chưa chọn file (Nhấp để chọn)'}
            </div>
          </div>
        </div>

        {/* Source Option 2: Active Generated Audio */}
        <div
          onClick={() => {
            if (activeAudioUrl) {
              setAudioUrl(activeAudioUrl);
              setAudioTitle(activeAudioTitle || 'Gemini Audio');
              setSelectedAudioSource('active');
            } else {
              alert('Chưa có bài âm thanh nào vừa tạo ở tab Tạo Giọng Nói!');
            }
          }}
          className={`p-4 rounded-xl border transition cursor-pointer flex items-center gap-3.5 ${
            selectedAudioSource === 'active'
              ? 'bg-cyan-950/40 border-cyan-500/80 shadow-md'
              : activeAudioUrl
              ? 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800'
              : 'bg-slate-900/40 border-slate-800/50 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="p-3 bg-cyan-600/20 text-cyan-400 rounded-lg shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Bài Thu Vừa Tạo</span>
              {selectedAudioSource === 'active' && <Check className="h-3.5 w-3.5 text-cyan-400" />}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {activeAudioTitle || (activeAudioUrl ? 'Audio vừa tạo' : 'Chưa tạo audio')}
            </div>
          </div>
        </div>

        {/* Source Option 3: History Selector */}
        <div
          onClick={() => {
            if (history.length > 0) {
              const currentTrack = history.find((h) => h.id === selectedHistoryTrackId) || history[0];
              if (currentTrack) {
                setSelectedHistoryTrackId(currentTrack.id);
                setAudioUrl(currentTrack.audioUrl);
                setAudioTitle(currentTrack.title);
                setSelectedAudioSource('history');
              }
            } else {
              alert('Chưa có bài thu âm nào trong lịch sử!');
            }
          }}
          className={`p-3 rounded-xl border transition cursor-pointer flex items-center gap-2.5 ${
            selectedAudioSource === 'history'
              ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md'
              : history.length > 0
              ? 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800'
              : 'bg-slate-900/40 border-slate-800/50 opacity-50 cursor-not-allowed'
          }`}
        >
          <FileAudio className="h-5 w-5 text-indigo-400 shrink-0 ml-1" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-300 block">
                Chọn Bài Từ Lịch Sử ({history.length}):
              </label>
              {selectedAudioSource === 'history' && (
                <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              )}
            </div>
            <select
              value={selectedHistoryTrackId}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedHistoryTrackId(id);
                const track = history.find((h) => h.id === id);
                if (track) {
                  setAudioUrl(track.audioUrl);
                  setAudioTitle(track.title);
                  setSelectedAudioSource('history');
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">-- Chọn bài thu trong lịch sử --</option>
              {history.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.title} ({new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Waveform & Cutter Workspace */}
      {audioUrl ? (
        <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-5 shadow-xl">
          {/* Audio Title & Main Audio Player Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  if (!audioRef.current) return;
                  if (isPlaying) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                  } else {
                    audioRef.current.play();
                    setIsPlaying(true);
                  }
                }}
                className="w-10 h-10 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl flex items-center justify-center font-bold shadow-lg shadow-cyan-500/20 transition shrink-0"
              >
                {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
              </button>

              <div>
                <h3 className="text-sm font-bold text-white truncate max-w-md">{audioTitle}</h3>
                <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                  <span>Thời lượng: {formatTime(duration)}</span>
                  <span>•</span>
                  <span>Hiện tại: {formatTime(currentTime)}</span>
                </div>
              </div>
            </div>

            {/* Zoom Controls Bar */}
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 px-2 flex items-center gap-1">
                <ZoomIn className="h-3.5 w-3.5 text-cyan-400" />
                <span>Thu/Phóng Waveform:</span>
              </span>

              <button
                onClick={() => setZoomLevel((prev) => Math.max(1, Math.round((prev - 0.5) * 10) / 10))}
                disabled={zoomLevel <= 1}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg transition"
                title="Thu nhỏ sóng âm"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>

              <span className="text-[11px] font-mono font-bold text-cyan-300 w-12 text-center bg-slate-900 py-0.5 rounded border border-slate-800">
                {Math.round(zoomLevel * 100)}%
              </span>

              <button
                onClick={() => setZoomLevel((prev) => Math.min(25, Math.round((prev + 0.5) * 10) / 10))}
                disabled={zoomLevel >= 25}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg transition"
                title="Phóng to sóng âm"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={() => setZoomLevel(1)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold rounded-lg transition flex items-center gap-1"
                title="Đặt lại mức zoom chuẩn (100%)"
              >
                <Maximize2 className="h-3 w-3" />
                <span>100%</span>
              </button>
            </div>
          </div>

          {/* Interactive Zoomable Waveform Display Container */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span className="flex items-center gap-1 text-amber-300 font-semibold">
                <Info className="h-3.5 w-3.5" />
                Lăn chuột giữa trên sóng âm để Phóng Tỏ / Thu Nhỏ (Zoom) mốc cắt
              </span>
              <span className="font-mono text-slate-500">Mức Zoom: {zoomLevel}x</span>
            </div>

            {/* Scrollable Container when Zoomed */}
            <div
              onWheel={handleWheelZoom}
              className="bg-slate-950 rounded-xl p-3 border border-slate-800 overflow-x-auto relative select-none touch-none cursor-crosshair custom-scrollbar"
            >
              {isLoadingAudio ? (
                <div className="h-28 flex items-center justify-center space-x-2 text-cyan-400 text-xs">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Đang giải mã và phân tích dữ liệu âm thanh 24kHz...</span>
                </div>
              ) : (
                <div
                  ref={waveformContainerRef}
                  onPointerMove={handlePointerMoveSegment}
                  onPointerUp={handlePointerUpSegment}
                  style={{ width: `${Math.max(100, zoomLevel * 100)}%` }}
                  className="relative h-28 flex flex-col justify-center min-w-full"
                >
                  {/* Waveform Canvas */}
                  <canvas
                    ref={canvasRef}
                    width={Math.max(800, Math.floor(1000 * zoomLevel))}
                    height={112}
                    onClick={handleCanvasClick}
                    className="w-full h-full cursor-pointer"
                    title="Bấm vào sóng âm thanh để phát tại vị trí đó"
                  />

                  {/* Draggable Cut Region Overlay Tracks */}
                  {duration > 0 && segments.length > 0 && (
                    <div className="absolute inset-x-0 inset-y-0 pointer-events-none">
                      {segments.map((seg, idx) => {
                        const leftPct = Math.max(0, Math.min(100, (seg.startTime / duration) * 100));
                        const rightPct = Math.max(0, Math.min(100, (seg.endTime / duration) * 100));
                        const widthPct = Math.max(0.2, rightPct - leftPct);
                        const colorScheme = SEGMENT_COLORS[idx % SEGMENT_COLORS.length];
                        const isDraggingThis = draggingSegment?.id === seg.id;

                        return (
                          <div
                            key={seg.id}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            className={`absolute top-0 bottom-0 pointer-events-auto border-x-2 border-y ${colorScheme.bg} ${colorScheme.border} rounded-md transition-colors flex justify-between items-center group/seg ${
                              isDraggingThis ? 'z-30 ring-2 ring-amber-400' : 'z-10 hover:z-20'
                            }`}
                          >
                            {/* Left Drag Handle */}
                            <div
                              onPointerDown={(e) => handleStartDragSegment(e, seg.id, 'left')}
                              className="absolute -left-2.5 top-0 bottom-0 w-5 cursor-col-resize flex items-center justify-center z-30 group/hleft"
                              title="Kéo sang TRÁI/PHẢI để chỉnh mốc BẮT ĐẦU"
                            >
                              <div
                                className={`w-2.5 h-full rounded-l-md ${colorScheme.handle} flex items-center justify-center shadow-md group-hover/hleft:scale-110 transition-transform`}
                              >
                                <div className="w-0.5 h-5 bg-slate-950/80 rounded-full" />
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
                                    handleDownloadSingleSegment(seg);
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
                                className={`w-2.5 h-full rounded-r-md ${colorScheme.handle} flex items-center justify-center shadow-md group-hover/hright:scale-110 transition-transform`}
                              >
                                <div className="w-0.5 h-5 bg-slate-950/80 rounded-full" />
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

                  {/* Live Dragging Tooltip */}
                  {draggingSegment && (
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 text-[11px] font-extrabold px-3 py-0.5 rounded-full shadow-lg border border-amber-300 z-40 animate-pulse flex items-center gap-1.5 pointer-events-none">
                      <Scissors className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Đang kéo {draggingSegment.type === 'left' ? 'điểm bắt đầu' : draggingSegment.type === 'right' ? 'điểm kết thúc' : 'toàn bộ vùng'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Audio Effects & Enhancement Panel */}
          <div className="p-4 bg-slate-950/90 rounded-xl border border-cyan-500/20 shadow-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Tùy Chỉnh Âm Thanh & Hiệu Ứng Trải Nghiệm (Xử Lý Trực Tiếp)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isPlaying && (
                  <span className="text-[10px] bg-rose-950/80 text-rose-400 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span>ĐANG PHÁT LIVE PREVIEW</span>
                  </span>
                )}
                <button
                  onClick={toggleLivePreviewPlay}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg transition flex items-center gap-1.5 shadow ${
                    isPlaying
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  }`}
                  title="Bấm để Nghe Thử Trực Tiếp âm thanh với tất cả hiệu ứng hiện tại"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5 fill-current" />
                      <span>Tạm Dừng Live</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3.5 w-3.5" />
                      <span>🔊 Nghe Thử Live Preview</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Speed Rate Control */}
              <div className="space-y-1.5 p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <div className="flex items-center gap-1.5 text-cyan-300">
                    <FastForward className="h-3.5 w-3.5" />
                    <span>Tốc độ âm thanh:</span>
                  </div>
                  <span className="font-mono text-cyan-400 font-bold">{playbackSpeed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.05"
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="flex items-center gap-1 justify-between pt-0.5">
                  {[0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
                    <button
                      key={s}
                      onClick={() => setPlaybackSpeed(s)}
                      className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition ${
                        playbackSpeed === s
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      {s === 1.0 ? 'Chuẩn' : `${s}x`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Bass Control (Độ Trầm) */}
              <div className="space-y-1.5 p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <div className="flex items-center gap-1.5 text-indigo-300">
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>Độ trầm (Bass EQ):</span>
                  </div>
                  <span className={`font-mono font-bold ${bassBoostDb > 0 ? 'text-emerald-400' : bassBoostDb < 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {bassBoostDb > 0 ? `+${bassBoostDb} dB` : `${bassBoostDb} dB`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  value={bassBoostDb}
                  onChange={(e) => setBassBoostDb(parseFloat(e.target.value))}
                  className="w-full accent-indigo-400 cursor-pointer"
                />
                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-0.5">
                  <span>-12dB (Mỏng)</span>
                  <button
                    onClick={() => setBassBoostDb(0)}
                    className="hover:text-indigo-300 underline font-mono"
                  >
                    Reset (0dB)
                  </button>
                  <span>+12dB (Dày/Trầm)</span>
                </div>
              </div>

              {/* 3. Fade In / Fade Out */}
              <div className="space-y-1.5 p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <div className="flex items-center gap-1.5 text-purple-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Làm mượt (Fade):</span>
                  </div>
                  <span className="font-mono text-purple-300 text-[11px]">
                    In: {fadeInSec}s | Out: {fadeOutSec}s
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                  <div>
                    <span>Fade In: {fadeInSec}s</span>
                    <input
                      type="range"
                      min="0"
                      max="3.0"
                      step="0.1"
                      value={fadeInSec}
                      onChange={(e) => setFadeInSec(parseFloat(e.target.value))}
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                  </div>
                  <div>
                    <span>Fade Out: {fadeOutSec}s</span>
                    <input
                      type="range"
                      min="0"
                      max="3.0"
                      step="0.1"
                      value={fadeOutSec}
                      onChange={(e) => setFadeOutSec(parseFloat(e.target.value))}
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Normalization Toggle */}
              <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 flex flex-col justify-between space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <div className="flex items-center gap-1.5 text-emerald-300">
                    <Zap className="h-3.5 w-3.5" />
                    <span>Chuẩn hóa âm lượng:</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Khôi phục âm lượng đỉnh (0dB) giúp các đoạn cắt nghe to rõ và đồng đều.
                </p>
                <button
                  onClick={() => setIsNormalized(!isNormalized)}
                  className={`w-full py-1 px-2 text-[11px] font-bold rounded transition flex items-center justify-center gap-1 border ${
                    isNormalized
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
                  }`}
                >
                  <Check className={`h-3 w-3 ${isNormalized ? 'opacity-100' : 'opacity-0'}`} />
                  <span>{isNormalized ? 'Đã Bật Normalization' : 'Bật Normalization 0dB'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Automatic Splitter Control Panel */}
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold text-white">
                  Cấu Hình Tự Động Phân Tách Theo Khoảng Lặng (Silence Detection):
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAutoSplitBySilence}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-extrabold rounded-lg shadow transition flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>Cắt Tự Động Theo Khoảng Lặng</span>
                </button>

                <button
                  onClick={handleAddSegment}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold rounded-lg border border-slate-700 transition flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm Vùng Thủ Công</span>
                </button>
              </div>
            </div>

            {/* Sliders for Min Silence Duration & Amplitude Threshold */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {/* Min Silence Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Khoảng im lặng tối thiểu:</span>
                  <span className="font-mono text-amber-400 font-bold">{Math.round(minSilenceDuration * 1000)} ms</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.8"
                  step="0.05"
                  value={minSilenceDuration}
                  onChange={(e) => setMinSilenceDuration(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              {/* Threshold Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Độ nhạy biên độ âm (Threshold):</span>
                  <span className="font-mono text-amber-400 font-bold">{silenceThreshold.toFixed(3)}</span>
                </div>
                <input
                  type="range"
                  min="0.003"
                  max="0.05"
                  step="0.002"
                  value={silenceThreshold}
                  onChange={(e) => setSilenceThreshold(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              {/* Quick Equal Split Preset */}
              <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                <div className="text-[11px] text-slate-400">Chia đều nhanh thành số đoạn:</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[2, 3, 4, 5, 8, 10, 12, 16].map((cnt) => (
                    <button
                      key={cnt}
                      onClick={() => handleEqualSplit(cnt)}
                      className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-bold rounded border border-slate-800 transition"
                    >
                      {cnt} đoạn
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Tips Banner */}
          <div className="p-3 bg-blue-950/30 border border-blue-500/20 rounded-xl flex items-start gap-2.5">
            <Lightbulb className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-300 space-y-1">
              <span className="font-bold text-cyan-300">Gợi ý & Mẹo Cắt Âm Thanh Thông Minh:</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-0.5 text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                  <span>Kéo giữa vùng màu để di chuyển toàn bộ mốc.</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span>Bấm nút <strong className="text-cyan-300 font-mono">+</strong> ở sóng âm để chèn vùng mới.</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                  <span>Xóa vùng cắt tự động lấp khoảng trống (Ripple Delete).</span>
                </div>
              </div>
            </div>
          </div>

          {/* Segment List Table & Batch Export Header */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center space-x-2">
                <Scissors className="h-4 w-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Danh Sách {segments.length} Đoạn Cắt Độc Lập
                </h4>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Merge All Segments Button */}
                {segments.length > 1 && (
                  <button
                    onClick={handleExportMergedAudio}
                    disabled={isMergingAudio}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5"
                    title="Gộp tất cả các đoạn cắt hiện tại thành 1 file âm thanh duy nhất"
                  >
                    {isMergingAudio ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Combine className="h-3.5 w-3.5" />}
                    <span>Gộp Tất Cả Đoạn ({segments.length})</span>
                  </button>
                )}

                {/* Batch Export ZIP Button */}
                {segments.length > 0 && (
                  <button
                    onClick={handleExportZipAllSegments}
                    disabled={isExportingZip}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5"
                  >
                    {isExportingZip ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FolderArchive className="h-3.5 w-3.5" />
                    )}
                    <span>Tải ZIP Tất Cả ({segments.length} File)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Segment Rows */}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
              {segments.map((seg, idx) => {
                const isThisPlaying = activeSegmentPlayingId === seg.id && isPlaying;
                const segLen = Math.max(0, Math.round((seg.endTime - seg.startTime) * 100) / 100);

                return (
                  <div
                    key={seg.id}
                    className="p-3 bg-slate-950/70 hover:bg-slate-950 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-slate-800 text-cyan-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>

                      <div className="flex-1 min-w-0 space-y-1">
                        <input
                          type="text"
                          value={seg.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSegments((prev) =>
                              prev.map((s) => (s.id === seg.id ? { ...s, name: val } : s))
                            );
                          }}
                          className="bg-slate-900 border border-slate-800 text-slate-100 font-semibold text-xs rounded px-2.5 py-1 w-full focus:outline-none focus:border-cyan-500"
                          placeholder="Tên câu / đoạn..."
                        />
                      </div>
                    </div>

                    {/* Start Time & End Time Inputs */}
                    <div className="flex items-center space-x-2 text-xs font-mono">
                      <div className="flex items-center space-x-1 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-500 font-sans">Đầu:</span>
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          max={seg.endTime - 0.05}
                          value={seg.startTime}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setSegments((prev) =>
                              prev.map((s) => (s.id === seg.id ? { ...s, startTime: Math.round(val * 100) / 100 } : s))
                            );
                          }}
                          className="w-16 bg-transparent text-amber-300 font-bold focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500">s</span>
                      </div>

                      <span className="text-slate-600">→</span>

                      <div className="flex items-center space-x-1 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-500 font-sans">Cuối:</span>
                        <input
                          type="number"
                          step="0.05"
                          min={seg.startTime + 0.05}
                          max={duration}
                          value={seg.endTime}
                          onChange={(e) => {
                            const val = Math.min(duration, parseFloat(e.target.value) || duration);
                            setSegments((prev) =>
                              prev.map((s) => (s.id === seg.id ? { ...s, endTime: Math.round(val * 100) / 100 } : s))
                            );
                          }}
                          className="w-16 bg-transparent text-amber-300 font-bold focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500">s</span>
                      </div>

                      <span className="text-[10px] text-slate-400 font-sans w-14 text-right">
                        ({segLen}s)
                      </span>
                    </div>

                    {/* Action Buttons for Segment */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => handlePlaySegment(seg)}
                        className={`p-2 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                          isThisPlaying
                            ? 'bg-rose-600 text-white shadow-md'
                            : 'bg-slate-800 hover:bg-slate-700 text-cyan-300'
                        }`}
                        title="Nghe thử đoạn cắt này"
                      >
                        {isThisPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </button>

                      <button
                        onClick={() => handleDownloadSingleSegment(seg)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
                        title="Tải về file WAV riêng cho đoạn này"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteSegment(seg.id)}
                        className="p-2 bg-slate-900 hover:bg-rose-950 text-slate-500 hover:text-rose-400 rounded-lg transition"
                        title="Xóa đoạn này"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Empty State & Dropzone */
        <div
          onClick={() => fileInputRef.current?.click()}
          className="p-12 bg-slate-900/60 hover:bg-slate-900/90 rounded-2xl border-2 border-dashed border-slate-700/80 hover:border-cyan-500/80 text-center space-y-4 cursor-pointer transition group shadow-xl"
        >
          <div className="w-16 h-16 bg-blue-600/10 text-cyan-400 group-hover:scale-110 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/20 transition">
            <Upload className="h-8 w-8 text-cyan-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition">
              Kéo & Thả Tệp Âm Thanh Vào Đây Để Cắt Ngay
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Nhấp hoặc kéo thả các tệp MP3, WAV, M4A, AAC, OGG, FLAC từ máy tính của bạn vào đây, hoặc chọn một bài thu trong Lịch sử ở trên.
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition inline-flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            <span>Tải File Audio Lên Ngay</span>
          </button>
        </div>
      )}
    </div>
  );
};
