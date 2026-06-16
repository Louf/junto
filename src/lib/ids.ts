import { customAlphabet } from "nanoid";

// URL-safe, no ambiguous chars (no 0/O/1/I/l).
const slugAlphabet = "23456789abcdefghjkmnpqrstuvwxyz";
const tokenAlphabet =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export const newSlug = customAlphabet(slugAlphabet, 8);
export const newToken = customAlphabet(tokenAlphabet, 32);
