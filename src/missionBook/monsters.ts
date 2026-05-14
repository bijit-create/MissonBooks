export interface Monster {
  name: string;
  asset: string | null;
}

export const MONSTER_BY_LO: Record<string, Monster> = {
  SC03B01_L02: { name: "Muncher", asset: "/mission-book/monsters/muncher.png" },
  MT07A02_L02: { name: "Crossangle", asset: "/mission-book/monsters/crossangle.png" },
  MT05A03_L02: { name: "Problemeter", asset: "/mission-book/monsters/problemeter.png" },
  SC04B01_L01: { name: "Traity", asset: "/mission-book/monsters/traity.png" },
};

const MONSTER_BY_PREFIX: Record<string, Monster> = {
  SC03B01: { name: "Muncher", asset: "/mission-book/monsters/muncher.png" },
  MT07A02: { name: "Crossangle", asset: "/mission-book/monsters/crossangle.png" },
  MT05A03: { name: "Problemeter", asset: "/mission-book/monsters/problemeter.png" },
  SC04B01: { name: "Traity", asset: "/mission-book/monsters/traity.png" },
};

const MONSTER_BY_GRADE: Record<number, Monster> = {
  3: { name: "Muncher", asset: null },
  4: { name: "Traity", asset: null },
  5: { name: "Problemeter", asset: null },
  7: { name: "Crossangle", asset: null },
};

export function getMonster(loCode: string | undefined, gradeLevel: string | number): Monster {
  const code = (loCode || "").trim();
  if (code && MONSTER_BY_LO[code]) return MONSTER_BY_LO[code];

  const prefix = code.split(/[_\s-]/)[0];
  if (prefix && MONSTER_BY_PREFIX[prefix]) return MONSTER_BY_PREFIX[prefix];

  const n = parseInt(String(gradeLevel), 10);
  if (MONSTER_BY_GRADE[n]) return MONSTER_BY_GRADE[n];

  return { name: "Mission", asset: null };
}
