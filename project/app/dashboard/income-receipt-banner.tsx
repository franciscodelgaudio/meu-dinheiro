"use client";

import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markIncomeReceived } from "./income-actions";

type Props = {
  calendarMonth: string;
  formattedMonth: string;
};

export function IncomeReceiptBanner({ calendarMonth, formattedMonth }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const action = markIncomeReceived.bind(null, calendarMonth);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={17} />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-900 capitalize">
            Você recebeu seu salário de {formattedMonth}?
          </p>
          <p className="text-xs text-emerald-700">
            Confirme para virar para o novo mês
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <form action={action}>
          <Button
            type="submit"
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Sim, recebi!
          </Button>
        </form>
        <button
          onClick={() => setDismissed(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-emerald-500 transition hover:bg-emerald-100 hover:text-emerald-700"
          aria-label="Fechar"
          title="Ainda não recebi"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
