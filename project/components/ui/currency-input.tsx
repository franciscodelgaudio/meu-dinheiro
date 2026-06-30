"use client";

import { useEffect, useState } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

type CurrencyInputProps = {
  name: string;
  id?: string;
  defaultValue?: string | number;
  value?: string | number;
  onChange?: (value: string) => void;
  required?: boolean;
  className?: string;
};

function toCents(value: string | number | undefined): number {
  return Math.round(Number(value ?? 0) * 100);
}

export function CurrencyInput({
  name,
  id,
  defaultValue,
  value: controlledValue,
  onChange,
  required,
  className,
}: CurrencyInputProps) {
  const [cents, setCents] = useState(() => toCents(controlledValue ?? defaultValue));

  useEffect(() => {
    if (controlledValue !== undefined) {
      const next = toCents(controlledValue);
      setCents((prev) => (prev === next ? prev : next));
    }
  }, [controlledValue]);

  const decimalValue = (cents / 100).toFixed(2);

  const displayValue = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      const digit = parseInt(e.key, 10);
      const newCents = Math.min(cents * 10 + digit, 999_999_999);
      setCents(newCents);
      onChange?.((newCents / 100).toFixed(2));
    } else if (e.key === "Backspace") {
      e.preventDefault();
      const newCents = Math.floor(cents / 10);
      setCents(newCents);
      onChange?.((newCents / 100).toFixed(2));
    } else if (e.key === "Delete") {
      e.preventDefault();
      setCents(0);
      onChange?.("0.00");
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const parsed = parseFloat(text.replace(",", "."));
    if (!isNaN(parsed)) {
      const newCents = Math.min(Math.round(parsed * 100), 999_999_999);
      setCents(newCents);
      onChange?.((newCents / 100).toFixed(2));
    }
  }

  return (
    <>
      <input type="hidden" name={name} value={decimalValue} />
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={(e) => e.target.select()}
        required={required}
        className={cn("tabular-nums", className)}
      />
    </>
  );
}
