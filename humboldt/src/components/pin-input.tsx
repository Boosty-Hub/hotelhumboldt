"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Cantidad de dígitos. */
  length?: number;
  disabled?: boolean;
  /** Se dispara cuando se completan todos los dígitos. */
  onComplete?: (value: string) => void;
  /** true → muestra puntos (login); false → muestra los dígitos (admin). */
  mask?: boolean;
  autoFocus?: boolean;
}

/**
 * Input de PIN estilo OTP: una casilla por dígito, auto-avance, retroceso y
 * pegado. Solo acepta dígitos. Sin dependencias externas.
 */
export function PinInput({
  value,
  onChange,
  length = 4,
  disabled,
  onComplete,
  mask = true,
  autoFocus,
}: PinInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function commit(next: string) {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
    return clean;
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1); // último char tecleado
    const next = value.slice(0, index) + digit + value.slice(index + 1);
    commit(next);
    if (digit && index < length - 1) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (digits[index]) {
        // borra el dígito actual
        onChange(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
        onChange(value.slice(0, index - 1) + value.slice(index));
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    const clean = commit(pasted);
    const focusIndex = Math.min(clean.length, length - 1);
    refs.current[focusIndex]?.focus();
  }

  return (
    <div
      className="flex justify-center gap-2 sm:gap-3"
      role="group"
      aria-label={`PIN de ${length} dígitos`}
    >
      {digits.map((digit, i) => (
        <Input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type={mask ? "password" : "text"}
          inputMode="numeric"
          autoComplete="off"
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          aria-label={`Dígito ${i + 1}`}
          className={cn(
            "h-14 w-12 text-center text-2xl font-semibold tracking-widest",
          )}
        />
      ))}
    </div>
  );
}
