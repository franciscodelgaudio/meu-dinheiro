/**
 * Builds a filter that matches a document by its `_id` whether it is stored as
 * a Mongoose `ObjectId` or as a legacy string id (cuid) left over from the
 * Prisma→Mongoose migration.
 *
 * Passing a cuid straight into `{ _id: value }` makes Mongoose try to cast it
 * to an ObjectId and throw a `CastError`, which surfaces as an unhandled server
 * error ("This page couldn't load"). Comparing the stringified `_id` sidesteps
 * the cast and matches both id shapes. Spread it into a filter alongside any
 * other conditions:
 *
 *   Model.findOne({ ...byId(id), userId })
 *
 * These collections are tiny, so the `$expr` collection scan is not a concern.
 */
export function byId(id: string) {
  return { $expr: { $eq: [{ $toString: "$_id" }, id] } };
}
