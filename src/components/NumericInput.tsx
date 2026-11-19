import React, { useEffect, useState } from 'react';

interface NumericInputProps {
  value: number | null | undefined;
  onChangeValue: (val: number | null) => void;
  min?: number;
  max?: number;
  step?: string | number;
  integer?: boolean;
  allowEmpty?: boolean;
  fallbackValue?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  title?: string;
  id?: string;
  list?: string;
  inputMode?: 'decimal' | 'numeric';
  'aria-label'?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onPaste?: React.ClipboardEventHandler<HTMLInputElement>;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChangeValue,
  min,
  max,
  step = 'any',
  integer = false,
  allowEmpty = false,
  fallbackValue,
  placeholder,
  className = '',
  disabled = false,
  required = false,
  title,
  id,
  list,
  inputMode = integer ? 'numeric' : 'decimal',
  'aria-label': ariaLabel,
  inputRef,
  onPaste,
}) => {
  const formatProp = (v: number | null | undefined): string => {
    if (v === null || v === undefined || !Number.isFinite(v)) return '';
    return String(v);
  };

  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<string>(() => formatProp(value));

  useEffect(() => {
    if (!focused) {
      setDraft(formatProp(value));
    }
  }, [value, focused]);

  const clamp = (n: number): number => {
    let out = integer ? Math.trunc(n) : n;
    if (min !== undefined && out < min) out = min;
    if (max !== undefined && out > max) out = max;
    return out;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDraft(raw);

    if (raw.trim() === '') {
      if (allowEmpty) {
        onChangeValue(null);
      }
      return;
    }

    // Allow intermediate states like "-", ".", "-." without forcing an immediate reset
    if (raw === '-' || raw === '.' || raw === '-.') {
      return;
    }

    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      if (min !== undefined && parsed < min) {
        // Wait for blur before clamping up so user can type multi-digit numbers starting below min (e.g., clearing 12 to type 2 -> 25)
        return;
      }
      onChangeValue(clamp(parsed));
    }
  };

  const handleBlur = () => {
    setFocused(false);
    const trimmed = draft.trim();
    if (trimmed === '') {
      if (allowEmpty) {
        onChangeValue(null);
        setDraft('');
      } else {
        const fb = fallbackValue !== undefined ? fallbackValue : min !== undefined ? min : 0;
        const clamped = clamp(fb);
        onChangeValue(clamped);
        setDraft(String(clamped));
      }
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(formatProp(value));
      return;
    }

    const clamped = clamp(parsed);
    onChangeValue(clamped);
    setDraft(String(clamped));
  };

  return (
    <input
      ref={inputRef}
      id={id}
      list={list}
      type="number"
      inputMode={inputMode}
      step={step}
      min={min}
      max={max}
      required={required}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={draft}
      onFocus={(e) => {
        setFocused(true);
        setDraft(formatProp(value));
        e.currentTarget.select();
      }}
      onChange={handleChange}
      onBlur={handleBlur}
      onPaste={onPaste}
      className={className}
    />
  );
};
