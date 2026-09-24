import { ApiSettings } from '../types';

const STORAGE_KEY = 'gemini_vox_api_settings';

export const getStoredApiSettings = (): ApiSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        provider: parsed.provider || 'gemini',
        geminiApiKey: parsed.geminiApiKey || '',
        customApiKey: parsed.customApiKey || '',
        customEndpoint: parsed.customEndpoint || '',
        ttsModel: parsed.ttsModel || '3.1',
      };
    }
  } catch (e) {
    console.warn('Failed to parse API settings from localStorage', e);
  }
  return {
    provider: 'gemini',
    geminiApiKey: '',
    customApiKey: '',
    customEndpoint: '',
    ttsModel: '3.1',
  };
};

export const saveApiSettings = (settings: ApiSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(
      new CustomEvent('gemini_vox_api_settings_changed', { detail: settings })
    );
  } catch (e) {
    console.error('Failed to save API settings to localStorage', e);
  }
};
