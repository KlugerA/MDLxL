/** Convert an internal zero-based resource index into the number shown in the UI. */
export const displayNumber = index => Number.isInteger(index) ? index + 1 : index;
