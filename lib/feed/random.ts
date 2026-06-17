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

/**
 * Build one random, well-formed feed line: `BIB FIRST LAST TIME`. The cumulative
 * time (always `H:MM:SS`) is spread across the race so the test tool can exercise
 * every split.
 */
export function randomAthleteLine(maxSeconds = 4 * 60 * 60): string {
  const bib = String(1 + Math.floor(Math.random() * 999));
  const name = `${pick(FIRST)} ${pick(LAST)}`;
  const total = 60 + Math.floor(Math.random() * (maxSeconds - 60));
  const time = `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return `${bib} ${name} ${time}`;
}
