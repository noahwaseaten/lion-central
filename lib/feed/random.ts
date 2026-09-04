const FIRST = [
  "Marcus", "Elena", "Tom", "Sofia", "Liam", "Aiko", "Noah", "Petya",
  "Ivan", "Maria", "Dimitar", "Lena", "Hugo", "Yuki", "Omar", "Clara",
];
const LAST = [
  "Bennett", "Fischer", "Okafor", "Petrova", "Novak", "Tanaka", "Silva", "Hansen",
  "Georgiev", "Costa", "Andersson", "Khan", "Müller", "Rossi", "Dimitrova", "Walsh",
];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const pad = (n: number) => String(n).padStart(2, "0");

/** Bib windows matching `CATEGORY_RANGES`, so generated lines land in a real category. */
const BIB_RANGES: [number, number][] = [
  [1, 264], // ultra
  [400, 700], // half
  [800, 999], // relay
];

/**
 * Build one random, well-formed feed line: `BIB FIRST LAST TIME`. The bib is
 * drawn from a real category window and the cumulative time (always `H:MM:SS`)
 * is spread across the race, so the test tool exercises every category.
 */
export function randomAthleteLine(maxSeconds = 4 * 60 * 60): string {
  const [min, max] = pick(BIB_RANGES);
  const bib = String(min + Math.floor(Math.random() * (max - min + 1)));
  const name = `${pick(FIRST)} ${pick(LAST)}`;
  const total = 60 + Math.floor(Math.random() * (maxSeconds - 60));
  const time = `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return `${bib} ${name} ${time}`;
}
