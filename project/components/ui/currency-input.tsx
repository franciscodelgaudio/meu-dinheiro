"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CurrencyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
> & {
  value: number;
  onChange: (value: number) => void;
};

function formatCentsToBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function moveCursorToEnd(event: React.SyntheticEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  requestAnimationFrame(() => {
    input.setSelectionRange(input.value.length, input.value.length);
  });
}

function CurrencyInput({ value, onChange, className, ...props }: CurrencyInputProps) {
  const cents = Math.round(value * 100);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "");
    const nextCents = digits === "" ? 0 : Number(digits);
    onChange(nextCents / 100);
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-base text-muted-foreground md:text-sm">
        R$
      </span>
      <Input
        {...props}
        inputMode="numeric"
        value={formatCentsToBRL(cents)}
        onChange={handleChange}
        onFocus={moveCursorToEnd}
        onClick={moveCursorToEnd}
        onKeyUp={moveCursorToEnd}
        className={cn("pl-8", className)}
      />
    </div>
  );
}

export { CurrencyInput };
