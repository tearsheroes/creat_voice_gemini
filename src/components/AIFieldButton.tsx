import React, { useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { getStoredApiSettings } from '../utils/apiSettingsStorage';

interface AIFieldButtonProps {
  targetField: string;
  currentValue: string;
  onApplyResult: (val: string) => void;
  getFullContext?: () => any;
  label?: string;
  compact?: boolean;
  iconOnly?: boolean;
  className?: string;
}

export const AIFieldButton: React.FC<AIFieldButtonProps> = ({
  targetField,
  currentValue,
  onApplyResult,
  getFullContext,
  label = 'AI Đồng bộ & Tối ưu',
  compact = false,
  iconOnly = false,
  className = '',
}) => {
  const [loading, setLoading] = useState(false);

  const handleSmartGenerate = async () => {
    setLoading(true);
    try {
      const context = getFullContext ? getFullContext() : {};
      const apiSettings = getStoredApiSettings();

      const res = await fetch('/api/ai/smart-autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetField,
          currentValue: currentValue || '',
          context,
          provider: apiSettings.provider,
          geminiApiKey: apiSettings.geminiApiKey || undefined,
          customApiKey: apiSettings.customApiKey || undefined,
          customEndpoint: apiSettings.customEndpoint || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.resultText) {
        onApplyResult(data.resultText);
      } else {
        alert(data.error || 'Không thể tạo nội dung từ AI');
      }
    } catch (err: any) {
      console.error(err);
      alert('Lỗi kết nối AI: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleSmartGenerate}
        disabled={loading}
        title="Nhấn để AI tự động tối ưu & đồng bộ ô này với toàn bộ kịch bản hiện tại"
        className={`inline-flex items-center justify-center px-2 py-1.5 rounded-md text-[11px] font-medium bg-cyan-950/70 text-cyan-300 border border-cyan-700/60 hover:border-cyan-400 hover:bg-cyan-900/80 transition shadow-sm disabled:opacity-50 ${!iconOnly ? 'space-x-1' : ''} ${className}`}
      >
        {loading ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-400" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
        )}
        {!iconOnly && <span>{loading ? 'AI đang tạo...' : 'AI xử lý'}</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSmartGenerate}
      disabled={loading}
      title="Nhấn để AI xử lý ô này phù hợp & đồng bộ với tất cả các ô khác"
      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-600/60 hover:border-cyan-400 text-cyan-200 shadow-md transition-all active:scale-95 disabled:opacity-50 ${className}`}
    >
      {loading ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-400" />
      ) : (
        <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
      )}
      <span>{loading ? 'Đang đồng bộ AI...' : label}</span>
    </button>
  );
};
