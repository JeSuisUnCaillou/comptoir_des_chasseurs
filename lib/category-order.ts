/** A shop's categories in the order its gérants chose; ties (categories never moved) by creation. */
export const byCategoryOrder = (
  a: { categoryPosition: number; categoryId: number },
  b: { categoryPosition: number; categoryId: number },
) => a.categoryPosition - b.categoryPosition || a.categoryId - b.categoryId;
