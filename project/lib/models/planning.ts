import { dbConnect } from "@/lib/handler/db";
import mongoose from "mongoose";

export interface IPlanningPeriod {
  startDate: Date;
  finalDate: Date;
  goal: number;
}

export interface IPlanning {
  icon: string | null;
  groupId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  period: IPlanningPeriod[];
}

const planningPeriodSchema = new mongoose.Schema<IPlanningPeriod>({
  startDate: {
    type: Date,
    required: true,
  },

  finalDate: {
    type: Date,
    required: true,
  },

  goal: {
    type: Number,
    required: true,
  },
});

const planningSchema = new mongoose.Schema<IPlanning>(
  {
    icon: {
      type: String,
      required: false,
      default: null,
    },

    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "groups",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    // Cada período mantém seu próprio _id (padrão do mongoose) para permitir
    // atualizar um período específico via arrayFilters, sem tocar nos demais.
    period: {
      type: [planningPeriodSchema],
      default: [],
    },
  },
  { timestamps: true },
);

planningSchema.index({ groupId: 1, userId: 1 });

await dbConnect();

export const Plannings =
  mongoose.models.plannings || mongoose.model<IPlanning>("plannings", planningSchema);
