---
name: loading-states
description: Use this skill when adding or reviewing pending/loading feedback in Nivello — form submits, row-level actions, imperative navigation, or route/page loads. Complements `crud-actions` (which owns the server action return contract and the react-hook-form consumption pattern) by covering everything else that needs a loading state — plain forms with no client state, table row actions, router.push after a mutation, and route-level loading.js — backed by the `loading` prop on `Button` and the `Skeleton` primitive.
user-invocable: true
---

# Loading States

Pairs with `next-page-pattern` (page structure) and `crud-actions` (server action contract + `react-hook-form` consumption). This skill does not redefine those — it covers the loading UI for everything `crud-actions` doesn't: actionless forms, row-level actions, imperative navigation, and route/page loads. Pick the row that matches how the loading is triggered; don't reuse a mechanism outside its row just because it's already in scope.

## Decision matrix

| Trigger | Mechanism | Feedback UI |
|---|---|---|
| Full-page form submit (fields to attach errors to) | react-hook-form `formState.isSubmitting` — see `crud-actions` | `<Button loading>` + inline banner above the form |
| Native `<form action={serverAction}>` with no client state (login, sign-out, locale switch) | `useFormStatus` in a child client component | `<Button loading={pending}>` only — no banner needed |
| Row/card action with no dedicated form (delete, toggle, resend) | `useTransition` (`startTransition`) | `<Button loading={isPending}>` on that control + toast |
| Imperative `router.push` after an async action | same `useTransition` as the action that precedes it | `isPending` covers the gap until the new route commits |
| List/detail page doing real data fetching | route-level `loading.js` | `<Skeleton>` shaped like the final layout |

## 1. Full-page form submit → RHF `isSubmitting`

The action contract (`{ success, message }`) and the `react-hook-form` wiring are defined in `crud-actions` — use that skill to create or consume the action itself. The only addition here is the `Button`/banner pair once `isSubmitting` is available:

```jsx
// <InlineAlert feedback={feedback} /> above the form
<Button type="submit" loading={isSubmitting}>{t.save}</Button>
```

For new pages, extract the hand-rolled success/error `<div>` (see `clients/new/Display.jsx`) into a shared `InlineAlert` component instead of re-declaring the color classes per Display — don't add a toast here, the banner already sits next to the thing the user just did. Keep the success banner visible until the next submit; don't auto-dismiss forms the user might still be reading.

## 2. Native form, no client state → `useFormStatus`

For forms like sign-out or locale switch where the action redirects or revalidates without inline field errors, don't lift state into the page — add a small child client component (`useFormStatus` must be called from a descendant of the `<form>`, not the form itself):

```jsx
"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({ children, ...props }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} {...props}>{children}</Button>;
}
```

Swap the plain `<Button type="submit">` in `sign-out-button.jsx` (and similar) for this the next time that file is touched — not required as a standalone refactor.

## 3. Row-level action, no dedicated form → `useTransition` + toast

Table row actions (delete, toggle status) have no natural spot for an inline banner next to one row among many. Use `useTransition` and a toast instead:

```jsx
"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function DeleteRowButton({ action, id }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="destructive"
      size="icon-sm"
      loading={isPending}
      onClick={() => startTransition(async () => {
        const result = await action(id);
        result.success ? toast.success(result.message) : toast.error(result.message);
      })}
    >
      <Trash2 />
    </Button>
  );
}
```

There is no toast library in this project yet. The first time this pattern is actually needed, add `sonner` (`npm install sonner`) and mount `<Toaster richColors position="top-right" />` once in `src/app/layout.js` — don't add the dependency speculatively ahead of a real call site. Never fire both a toast and an inline banner for the same event; pick one based on whether the action has an obvious inline slot (rule 1/2) or not (this rule).

## 4. Imperative navigation after an action

Wrap the `router.push` in the same transition as the action that precedes it, so one `isPending` covers both:

```jsx
const router = useRouter();
const [isPending, startTransition] = useTransition();

function onConfirm() {
  startTransition(async () => {
    const result = await action(id);
    if (result.success) router.push(`/workspaces/${workspaceId}/clients`);
    else toast.error(result.message);
  });
}
```

Never call `router.push` outside a transition when it follows an async action — otherwise there's a window after the action resolves and before the route commits where nothing on screen indicates work is happening.

## 5. Route/page loading → `loading.js` + `Skeleton`

For server pages built with `next-page-pattern` that do real aggregation queries, add a sibling `loading.js` shaped like the page's final layout using `src/components/ui/skeleton.jsx`:

```jsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-3 p-6">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );
}
```

This project's Next build has a documented gap here (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`): `loading.js` alone does not guarantee instant client-side navigation. That requires `unstable_instant` plus `cacheComponents` enabled in `next.config.js`, which is off today. Treat `loading.js` as "don't show a blank screen while data loads," not as a substitute for fast queries. Turning on `cacheComponents` is an architecture decision — raise it on its own, don't fold it into a feature PR.

## `Button` `loading` prop

`src/components/ui/button.jsx` takes a `loading` boolean: it disables the button, sets `aria-busy`, and renders a spinning `Loader2` before children. Pass the label unchanged (`<Button loading={isSubmitting}>{t.save}</Button>`) — the spinner communicates the pending state, so new call sites don't need a `{isSubmitting ? t.saving : t.save}` ternary. Existing text-swap code (e.g. current `clients/new/Display.jsx`) doesn't need to be migrated just for this; the spinner layers on top harmlessly whenever it is added.

## Anti-patterns

- Fabricating `{ success: false }` in a `try/catch` around a call to an action that already returns that shape — let truly unexpected errors hit the Next.js error boundary instead.
- A second local `isLoading` state duplicating `isSubmitting`/`isPending` that's already available.
- Toast and inline banner for the same event.
- A global nprogress-style bar — this app has no deep client-only route trees yet; revisit only if that changes.
- Gating the whole page behind a spinner for a single row's action — scope the `loading` prop to the control that was clicked.