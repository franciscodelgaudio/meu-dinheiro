import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, default: null },
    email: { type: String, unique: true, sparse: true, default: null },
    emailVerified: { type: Date, default: null },
    image: { type: String, default: null },
    currency: { type: String, default: "BRL" },
    payday: { type: Number, default: null },
  },
  {
    timestamps: true,
    collection: "users",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

export const User =
  mongoose.models.User ?? mongoose.model("User", userSchema, "users");
