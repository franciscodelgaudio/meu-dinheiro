import { useCallback, useState } from "react";

export type SubmitState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export type SubmitResult =
  | { success: true; message: string }
  | { success: false; message: string };

export function useSubmitState() {
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  const run = useCallback(async (action: () => Promise<SubmitResult>) => {
    setState({ status: "loading" });

    try {
      const result = await action();
      setState(
        result.success
          ? { status: "success", message: result.message }
          : { status: "error", message: result.message },
      );
      return result;
    } catch {
      const message = "Não foi possível conectar ao servidor.";
      setState({ status: "error", message });
      return { success: false as const, message };
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, run, reset };
}
