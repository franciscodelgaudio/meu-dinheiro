import mongoose, { type PipelineStage } from "mongoose";
import { Groups, type IGroup } from "@/lib/models/group";
import { Display } from "@/components/groups/Display";

const PAGE_SIZE = 10;

type GroupsPageProps = {
  searchParams?: Promise<{
    userId?: string | string[];
    referenceMonth?: string | string[];
    name?: string | string[];
    page?: string | string[];
  }>;
};

type GroupListItem = IGroup & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
  const params = await searchParams;

  const userId = firstValue(params?.userId);
  const referenceMonth = firstValue(params?.referenceMonth);
  const name = firstValue(params?.name);
  const page = Math.max(1, Number(firstValue(params?.page)) || 1);

  const match: Record<string, unknown> = {};
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    match.userId = new mongoose.Types.ObjectId(userId);
  }
  if (referenceMonth) {
    match.referenceMonth = referenceMonth;
  }
  if (name) {
    match.name = { $regex: name, $options: "i" };
  }

  const pipeline: PipelineStage[] = [
    { $match: match },
    { $sort: { referenceMonth: -1, createdAt: -1 } },
    {
      $facet: {
        data: [{ $skip: (page - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE }],
        totalCount: [{ $count: "count" }],
      },
    },
  ];

  const [result] = await Groups.aggregate<{
    data: GroupListItem[];
    totalCount: { count: number }[];
  }>(pipeline);

  const groups = (result?.data ?? []).map((group) => ({
    id: group._id.toString(),
    name: group.name,
    description: group.description,
    referenceMonth: group.referenceMonth,
    monthlyAmount: group.monthlyAmount,
    color: group.color,
  }));
  const total = result?.totalCount[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4">
      <Display
        groups={groups}
        page={page}
        totalPages={totalPages}
        total={total}
        referenceMonth={referenceMonth ?? ""}
        name={name ?? ""}
        userId={userId ?? ""}
      />
    </div>
  );
}
