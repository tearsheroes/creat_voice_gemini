import { AudioToneConfig } from '../types';

/**
 * Decodes base64 data URL into AudioBuffer using Web Audio API
 */
export async function decodeAudioData(dataUrl: string): Promise<AudioBuffer> {
  const response = await fetch(dataUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  return decoded;
}

/**
 * Render AudioBuffer with tone, pitch, speed, and EQ adjustments offline
 */
export async function renderProcessedAudio(
  buffer: AudioBuffer,
  tone: AudioToneConfig
): Promise<Blob> {
  const processed = await processSegmentAudioBuffer(buffer, {
    speed: tone.speed,
    bassDb: tone.bass,
  });
  return audioBufferToWavBlob(processed);
}

/**
 * Process AudioBuffer with speed, bass EQ, fade in/out, and volume normalization offline
 */
export async function processSegmentAudioBuffer(
  buffer: AudioBuffer,
  options: {
    speed?: number;
    bassDb?: number;
    fadeInSec?: number;
    fadeOutSec?: number;
    normalize?: boolean;
  }
): Promise<AudioBuffer> {
  const speed = options.speed ?? 1.0;
  const bassDb = options.bassDb ?? 0;
  const fadeInSec = options.fadeInSec ?? 0;
  const fadeOutSec = options.fadeOutSec ?? 0;
  const normalize = options.normalize ?? false;

  const sampleRate = buffer.sampleRate;
  const targetDuration = buffer.duration / speed;
  const frameCount = Math.max(1, Math.ceil(targetDuration * sampleRate));

  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    frameCount,
    sampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = speed;

  // Bass EQ filter (Low-shelf 200Hz)
  let lastNode: AudioNode = source;
  if (bassDb !== 0) {
    const bassFilter = offlineCtx.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 200;
    bassFilter.gain.value = bassDb;
    source.connect(bassFilter);
    lastNode = bassFilter;
  }

  // Fade In / Fade Out GainNode inside OfflineAudioContext
  const gainNode = offlineCtx.createGain();
  lastNode.connect(gainNode);
  gainNode.connect(offlineCtx.destination);

  const startTime = 0;
  const endTime = targetDuration;

  if (fadeInSec > 0) {
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(1.0, Math.min(startTime + fadeInSec, endTime));
  } else {
    gainNode.gain.setValueAtTime(1.0, startTime);
  }

  if (fadeOutSec > 0 && endTime - fadeOutSec > startTime) {
    const fadeOutStart = Math.max(startTime, endTime - fadeOutSec);
    gainNode.gain.setValueAtTime(1.0, fadeOutStart);
    gainNode.gain.linearRampToValueAtTime(0.0001, endTime);
  }

  source.start(0);

  let renderedBuffer = await offlineCtx.startRendering();

  // Volume Normalization to peak 0dB if requested
  if (normalize) {
    const numChannels = renderedBuffer.numberOfChannels;
    const totalFrames = renderedBuffer.length;

    let maxAmp = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      const data = renderedBuffer.getChannelData(ch);
      for (let i = 0; i < totalFrames; i++) {
        const abs = Math.abs(data[i]);
        if (abs > maxAmp) maxAmp = abs;
      }
    }

    if (maxAmp > 0.001) {
      const normGain = Math.min(1.0 / maxAmp, 5.0);
      for (let ch = 0; ch < numChannels; ch++) {
        const data = renderedBuffer.getChannelData(ch);
        for (let i = 0; i < totalFrames; i++) {
          data[i] *= normGain;
        }
      }
    }
  }

  return renderedBuffer;
}

/**
 * Merges multiple AudioBuffers into one single AudioBuffer sequentially
 */
export function mergeAudioBuffers(buffers: AudioBuffer[]): AudioBuffer | null {
  if (buffers.length === 0) return null;
  const sampleRate = buffers[0].sampleRate;
  const numChannels = buffers[0].numberOfChannels;

  let totalLength = 0;
  buffers.forEach((b) => (totalLength += b.length));

  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const merged = ctx.createBuffer(numChannels, totalLength, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const mergedData = merged.getChannelData(channel);
    let offset = 0;
    for (const b of buffers) {
      const bChannelData = b.getChannelData(Math.min(channel, b.numberOfChannels - 1));
      mergedData.set(bChannelData, offset);
      offset += b.length;
    }
  }

  return merged;
}

/**
 * Convert AudioBuffer to WAV Blob
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const numSamples = buffer.length * numChannels;
  const dataSize = numSamples * (bitDepth / 8);
  const headerSize = 44;
  const wavBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(wavBuffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk size */
  view.setUint32(4, 36 + dataSize, true);
  /* WAVE identifier */
  writeString(view, 8, 'WAVE');
  /* fmt sub-chunk identifier */
  writeString(view, 12, 'fmt ');
  /* sub-chunk 1 size */
  view.setUint32(16, 16, true);
  /* audio format (1 is PCM) */
  view.setUint16(20, format, true);
  /* num channels */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate */
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  /* block align */
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data sub-chunk identifier */
  writeString(view, 36, 'data');
  /* data sub-chunk length */
  view.setUint32(40, dataSize, true);

  // Write channel data
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = buffer.getChannelData(channel)[i];
      // clamp
      sample = Math.max(-1, Math.min(1, sample));
      // scale to 16-bit signed integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Slices a section of an AudioBuffer from startTime to endTime (in seconds)
 */
export function sliceAudioBuffer(
  buffer: AudioBuffer,
  startTime: number,
  endTime: number
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;

  const startOffset = Math.max(0, Math.floor(startTime * sampleRate));
  const endOffset = Math.min(buffer.length, Math.floor(endTime * sampleRate));
  const frameCount = Math.max(1, endOffset - startOffset);

  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const slicedBuffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    const slicedData = slicedBuffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      slicedData[i] = channelData[startOffset + i];
    }
  }

  return slicedBuffer;
}

/**
 * Triggers browser download for a blob or data URL
 */
export function downloadAudioFile(urlOrBlob: string | Blob, filename: string) {
  const url = typeof urlOrBlob === 'string' ? urlOrBlob : URL.createObjectURL(urlOrBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof urlOrBlob !== 'string') {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

export interface SilenceBoundarySegment {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
}

/**
 * Analyzes PCM audio data and detects silence gaps between sentences/dialogues.
 * Returns start and end timestamps for each speech segment.
 */
export function detectSilenceBoundaries(
  buffer: AudioBuffer,
  minSilenceDuration: number = 0.15, // seconds
  silenceThreshold: number = 0.012,   // amplitude threshold (0 to 1)
  expectedCount?: number              // optional target number of lines
): SilenceBoundarySegment[] {
  const channelData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const totalDuration = buffer.duration;

  // Window size for RMS calculation (10ms)
  const windowSize = Math.floor(sampleRate * 0.01);
  const numWindows = Math.floor(channelData.length / windowSize);

  const windowAmplitudes: number[] = new Array(numWindows);
  for (let i = 0; i < numWindows; i++) {
    let sumSquare = 0;
    const startSample = i * windowSize;
    for (let j = 0; j < windowSize; j++) {
      const sample = channelData[startSample + j] || 0;
      sumSquare += sample * sample;
    }
    windowAmplitudes[i] = Math.sqrt(sumSquare / windowSize);
  }

  // Find continuous silence regions
  const silenceMinWindows = Math.ceil((minSilenceDuration * sampleRate) / windowSize);
  const silenceGaps: { startWin: number; endWin: number; midTime: number }[] = [];

  let silenceStart: number | null = null;
  for (let i = 0; i < numWindows; i++) {
    const isSilent = windowAmplitudes[i] < silenceThreshold;
    if (isSilent) {
      if (silenceStart === null) silenceStart = i;
    } else {
      if (silenceStart !== null) {
        const silenceLength = i - silenceStart;
        if (silenceLength >= silenceMinWindows) {
          const midWin = Math.floor((silenceStart + i) / 2);
          const midTime = (midWin * windowSize) / sampleRate;
          silenceGaps.push({ startWin: silenceStart, endWin: i, midTime });
        }
        silenceStart = null;
      }
    }
  }

  // Handle trailing silence
  if (silenceStart !== null && (numWindows - silenceStart) >= silenceMinWindows) {
    const midWin = Math.floor((silenceStart + numWindows) / 2);
    const midTime = (midWin * windowSize) / sampleRate;
    silenceGaps.push({ startWin: silenceStart, endWin: numWindows, midTime });
  }

  // Filter gaps that are too close to start or end
  const innerGaps = silenceGaps.filter((g) => g.midTime > 0.15 && g.midTime < totalDuration - 0.15);

  let splitTimes: number[] = [];
  if (expectedCount && expectedCount > 1) {
    if (innerGaps.length >= expectedCount - 1) {
      // Sort gaps by silence duration descending (longest pauses first)
      const sortedGaps = [...innerGaps].sort((a, b) => (b.endWin - b.startWin) - (a.endWin - a.startWin));
      const selectedGaps = sortedGaps.slice(0, expectedCount - 1);
      // Re-sort chronologically by time
      selectedGaps.sort((a, b) => a.midTime - b.midTime);
      splitTimes = selectedGaps.map((g) => g.midTime);
    } else {
      splitTimes = innerGaps.map((g) => g.midTime);
    }
  } else {
    splitTimes = innerGaps.map((g) => g.midTime);
  }

  // Build boundary segments
  const segments: SilenceBoundarySegment[] = [];
  let prevTime = 0;

  splitTimes.forEach((time, index) => {
    const start = Math.floor(prevTime * 100) / 100;
    const end = Math.floor(time * 100) / 100;
    if (end > start + 0.1) {
      segments.push({
        id: `silence-seg-${Date.now()}-${index}`,
        name: `Câu ${segments.length + 1}`,
        startTime: start,
        endTime: end,
      });
    }
    prevTime = time;
  });

  // Final segment
  const lastStart = Math.floor(prevTime * 100) / 100;
  const lastEnd = Math.floor(totalDuration * 100) / 100;
  if (lastEnd > lastStart + 0.1) {
    segments.push({
      id: `silence-seg-${Date.now()}-${segments.length}`,
      name: `Câu ${segments.length + 1}`,
      startTime: lastStart,
      endTime: lastEnd,
    });
  }

  return segments;
}

