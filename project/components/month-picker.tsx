"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface MonthYear {
  month: string;
  year: string;
}

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function formatMonthYear({ month, year }: MonthYear) {
  return `${MONTH_LABELS[Number(month) - 1] ?? month}/${year}`;
}

interface MonthPickerProps {
  onSelect: (value: MonthYear) => void;
  placeholder?: string;
}

export function MonthPicker({
  onSelect,
  placeholder = "Adicionar mês",
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <CalendarIcon />
        {placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          onSelect={(date) => {
            if (!date) return;
            onSelect({
              month: String(date.getMonth() + 1).padStart(2, "0"),
              year: String(date.getFullYear()),
            });
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
