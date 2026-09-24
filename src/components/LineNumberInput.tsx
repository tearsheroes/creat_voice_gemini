import React, { useState, useEffect } from 'react';

interface LineNumberInputProps {
  currentIndex: number;
  totalLines: number;
  onMove: (newIndex: number) => void;
}

export const LineNumberInput: React.FC<LineNumberInputProps> = ({
  currentIndex,
  totalLines,
  onMove,
}) => {
  const [val, setVal] = useState((currentIndex + 1).toString());

  useEffect(() => {
    setVal((currentIndex + 1).toString());
  }, [currentIndex]);

  const handleBlur = () => {
    let parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 1) {
      parsed = 1;
    } else if (parsed > totalLines) {
      parsed = totalLines;
    }
    setVal(parsed.toString());
    if (parsed - 1 !== currentIndex) {
      onMove(parsed - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="number"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      min={1}
      max={totalLines}
      className="w-10 text-center bg-indigo-950/40 border border-indigo-900/50 rounded-lg px-1 py-1 text-xs font-mono font-bold text-indigo-300 focus:outline-none focus:border-indigo-500/80 focus:bg-indigo-900/60 transition"
      title="Nhập số để đổi vị trí"
    />
  );
};
