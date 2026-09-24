import { AudioTrack, PresetScene } from '../types';

export function safeSavePresets(presets: PresetScene[]) {
  try {
    localStorage.setItem('gemini_voice_presets', JSON.stringify(presets));
  } catch (e) {
    console.warn('Could not save presets to localStorage:', e);
  }
}

export function safeSaveHistory(history: AudioTrack[]) {
  if (!history || history.length === 0) {
    try {
      localStorage.setItem('gemini_voice_history', JSON.stringify([]));
    } catch (e) {}
    return;
  }

  // Attempt 1: Try saving full history
  try {
    localStorage.setItem('gemini_voice_history', JSON.stringify(history));
    return;
  } catch (e) {
    console.warn('localStorage quota exceeded on full history save, attempting audio pruning...', e);
  }

  // Attempt 2: Keep audio for 3 most recent tracks, clear audioUrl for older tracks in storage payload
  try {
    const pruned = history.map((track, index) => {
      if (index >= 3) {
        return { ...track, audioUrl: '' };
      }
      return track;
    });
    localStorage.setItem('gemini_voice_history', JSON.stringify(pruned));
    return;
  } catch (e) {
    console.warn('localStorage quota still exceeded with pruned audio, attempting track limit...', e);
  }

  // Attempt 3: Keep only the 3 most recent tracks
  try {
    const recentOnly = history.slice(0, 3);
    localStorage.setItem('gemini_voice_history', JSON.stringify(recentOnly));
    return;
  } catch (e) {
    console.warn('localStorage quota exceeded, saving only recent track metadata...', e);
  }

  // Final fallback: save metadata only without audioUrls for recent tracks
  try {
    const metadataOnly = history.slice(0, 5).map((track) => ({ ...track, audioUrl: '' }));
    localStorage.setItem('gemini_voice_history', JSON.stringify(metadataOnly));
  } catch (e) {
    console.error('Failed to save history to localStorage completely due to storage quota limits:', e);
  }
}
export function safeSavePronunciation(dict: import('../types').PronunciationRule[]) {
  try {
    localStorage.setItem('gemini_voice_pronunciation', JSON.stringify(dict));
  } catch (e) {
    console.warn('Could not save pronunciation dictionary to localStorage:', e);
  }
}
