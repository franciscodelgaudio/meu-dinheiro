---
name: next-page-pattern
description: Use this skill when creating or refactoring Next.js app router pages in Nivello. It enforces the server page + Display component pattern, Zod query validation, workspace ownership checks, Mongo aggregation pagination/filtering, and English route folder names.
user-invocable: true
---

# Next Page Pattern

Use this pattern for list pages and dashboard-like resource pages scoped to a workspace.

## Route names

- Route folder names must always be in English.
- Examples: use `quotes/new`, not `orcamentos/novo`; use `clients`, not `clientes`.
- Keep labels and product copy in pt-BR when the UI is user-facing.

## File split

- `src/app/<route>/page.js` is a server page responsible for auth, params, query parsing, database reads, serialization, and returning a Display component.
- `src/components/dashboard/<scope>/<resource>/Display.jsx` renders the UI.
- Do not put large tables, cards, filters, or presentation markup directly in `page.js`.

## Server page structure

Follow this order:

1. Import `z` from `zod`, `mongoose`, and `notFound`/`redirect` from `next/navigation`.
2. Import `auth` from `@/auth`, the resource `Display`, and models from `@/lib/models/<Name>`.
3. Define constants near the top: `PAGE_SIZE`, allowed order values, allowed directions, and any filter enums (e.g. status values).
4. Define `querySchema` with Zod for `search`, `page`, `order`, `direction`, and resource filters. Escape regex metacharacters in `search` via a `.transform()`.
5. In `Page({ searchParams, params })`:
   - `const session = await auth();` — `redirect("/login")` if there is no `session?.user`.
   - `await params` to get route ids; validate each id with `mongoose.Types.ObjectId.isValid(...)`, calling `notFound()` if invalid.
   - Load the workspace scoped to the authenticated user, e.g. `Workspaces.findOne({ _id: workspaceObjectId, owner: ownerObjectId }).lean()`, and `notFound()` if it doesn't exist — this is what enforces access control, so never skip it.
   - `querySchema.safeParse(await searchParams)`; return `notFound()` if parsing fails.
   - Build a `matchCondition` object combining the workspace scope with `$and` blocks for search terms (`$regex`/`$options: "i"` on relevant fields) and any filter enums, only when those arrays are non-empty.
   - Compute `currentPage`/`skip` from `page`, guarding against `NaN`/negative values, defaulting to page 1.
   - Build a `sortOptions` map keyed by the allowed `order` values, resolve `dir` from `direction` (`asc: 1, desc: -1`), and pick `sortBy = sortOptions[order]`. Never sort on an un-allow-listed field.
   - Run one aggregation with `$match`, any needed `$lookup`/`$unwind`/`$addFields`, then `$facet: { data: [...sort/skip/limit/project], count: [{ $count: "total" }] }`.
   - Derive `totalCount`/`totalPages` from the `count` facet, clamping `currentPage` down to `totalPages` when it overshoots.
   - Serialize the `data` facet (`JSON.parse(JSON.stringify(...))` or `.lean()` plus manual `.toString()` on ids) before passing to the client component.
   - Return `<Display />` with the serialized data, ids as strings, and a `pagination` object (`page`, `totalPages`, `totalCount`, `hasNextPage`, `hasPrevPage`), plus `order`/`direction`/filter values as needed.

## Display component

- Receive data as props from the server page.
- Use existing UI primitives from `src/components/ui`.
- Build internal links using English routes.
- Preserve query params for pagination, sorting, and filters.
- Keep tables horizontally scrollable on small screens.
- Use empty states for zero results.

## Reference shape

```js
import z from "zod";
import mongoose from "mongoose";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import Display from "@/components/dashboard/workspaceId/resource/Display";
import { Resources } from "@/lib/models/Resource";
import { Workspaces } from "@/lib/models/Workspace";

const PAGE_SIZE = parseInt(process.env.NEXT_PUBLIC_PAGE_SIZE, 10) || 20;
const ORDER_VALUES = ["name", "createdAt"];
const DIRECTION_VALUES = ["asc", "desc"];
const STATUS_VALUES = ["open", "closed", "pending"];

const querySchema = z.object({
  search: z
    .string()
    .optional()
    .transform((val) => (val ? val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : val)),
  page: z
    .string()
    .optional()
    .refine((val) => !val || (/^\d+$/.test(val) && parseInt(val, 10) > 0), {
      message: "Page must be a positive integer string",
    }),
  order: z.enum(ORDER_VALUES).optional().default("createdAt"),
  direction: z.enum(DIRECTION_VALUES).optional().default("desc"),
  status: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").filter((s) => STATUS_VALUES.includes(s)) : [])),
});

export default async function Page({ searchParams, params }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { workspaceId } = await params;
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) notFound();

  const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);
  const ownerObjectId = new mongoose.Types.ObjectId(session.user.id);

  const workspace = await Workspaces.findOne({
    _id: workspaceObjectId,
    owner: ownerObjectId,
  }).lean();
  if (!workspace) notFound();

  const queryResult = querySchema.safeParse(await searchParams);
  if (!queryResult.success) return notFound();
  const { search, page, order, direction, status } = queryResult.data;

  let matchCondition = { workspaceId: workspaceObjectId };

  const searchTerms = search
    ? search.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  if (searchTerms.length > 0) {
    matchCondition = {
      $and: [
        matchCondition,
        ...searchTerms.map((term) => ({ $or: [{ name: { $regex: term, $options: "i" } }] })),
      ],
    };
  }

  if (status.length > 0) {
    matchCondition = { $and: [matchCondition, { status: { $in: status } }] };
  }

  let currentPage = parseInt(page || "1", 10);
  if (isNaN(currentPage) || currentPage < 1) currentPage = 1;
  let skip = (currentPage - 1) * PAGE_SIZE;
  if (isNaN(skip) || skip < 0) skip = 0;

  const dir = { asc: 1, desc: -1 }[direction];
  const sortOptions = {
    name: { name: dir },
    createdAt: { createdAt: dir },
  };
  const sortBy = sortOptions[order];

  const aggregationResult = await Resources.aggregate([
    { $match: matchCondition },
    {
      $facet: {
        data: [{ $sort: sortBy }, { $skip: skip }, { $limit: PAGE_SIZE }],
        count: [{ $count: "total" }],
      },
    },
  ]);

  const totalCount = aggregationResult[0].count[0]?.total || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;

  const resources = JSON.parse(JSON.stringify(aggregationResult[0].data));

  return (
    <Display
      workspaceId={workspace._id.toString()}
      resources={resources}
      pagination={{
        page: currentPage,
        totalPages,
        totalCount,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      }}
      order={order}
      direction={direction}
    />
  );
}
```
