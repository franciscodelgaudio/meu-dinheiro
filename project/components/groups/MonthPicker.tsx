"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type MonthPickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function parseReferenceMonth(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return undefined;
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function formatReferenceMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthPicker({ value, onChange, placeholder = "Selecione o mês" }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseReferenceMonth(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" className="justify-start font-normal" />}>
        <CalendarIcon data-icon="inline-start" />
        {selected
          ? selected.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
          : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange(formatReferenceMonth(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
