const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function almost(a, b) {
  return Math.abs(a - b) < 1e-9;
}

const {
  encodeCircuitSchemeCode,
  decodeCircuitSchemeCode,
  encodeInsigniaSchemeCode,
  decodeInsigniaSchemeCode,
  finalizeCircuitSchemeImport,
  finalizeInsigniaSchemeImport,
  peekSchemeShareKind,
  CIRCUIT_SCHEME_PREFIX,
  INSIGNIA_SCHEME_PREFIX,
} = await import("../src/lib/schemeShare.ts");

const now = "2026-01-01T00:00:00.000Z";

const circuitA = {
  id: "c1",
  name: "時間暴擊",
  kind: "time",
  main: { stat: "critRate", value: 0.125 },
  subs: [
    { stat: "critDamage", value: 0.24 },
    { stat: "int", value: 0.082 },
    { stat: "pAtk", value: 45 },
    { stat: "ice", value: 12 },
  ],
  breakthroughs: [
    { stat: "circuitBoost", value: 0.045 },
    { stat: "damageBoost", value: 0.03 },
  ],
  createdAt: now,
  updatedAt: now,
};

const circuitB = {
  id: "c2",
  name: "輝鑰攻擊",
  kind: "key",
  main: { stat: "attack", value: 80 },
  subs: [{ stat: "mAtk", value: 30 }],
  breakthroughs: [],
  createdAt: now,
  updatedAt: now,
};

const circuitScheme = {
  id: "cs1",
  name: "冰法一套",
  note: "給隊友試",
  equipped: { 頭: "c1", 武器: "c2", 項鍊: "c2" },
  createdAt: now,
  updatedAt: now,
};

const circuitById = new Map([
  [circuitA.id, circuitA],
  [circuitB.id, circuitB],
]);

{
  const code = await encodeCircuitSchemeCode(circuitScheme, circuitById);
  assert(code.startsWith(`${CIRCUIT_SCHEME_PREFIX}.`), `prefix ${code.slice(0, 20)}`);
  assert(peekSchemeShareKind(code) === "circuit", "peek circuit");
  assert(
    peekSchemeShareKind(`分享：\n${code}\n`) === "circuit",
    "peek circuit with noise",
  );

  const wrapped = `這是迴路\n${code}\n請導入`;
  const decoded = await decodeCircuitSchemeCode(wrapped);
  assert(decoded, "decode circuit");
  assert(decoded.scheme.name === "冰法一套", `name ${decoded.scheme.name}`);
  assert(decoded.scheme.note === "給隊友試", "note");
  assert(decoded.pieces.length === 2, `pieces ${decoded.pieces.length}`);
  // same piece used twice stays one copy
  assert(decoded.scheme.equipped["頭"], "head equipped");
  assert(
    decoded.scheme.equipped["武器"] === decoded.scheme.equipped["項鍊"],
    "same piece reused",
  );
  assert(decoded.scheme.equipped["武器"] !== decoded.scheme.equipped["頭"], "two pieces");

  const head = decoded.pieces.find((p) => p.id === decoded.scheme.equipped["頭"]);
  assert(head?.kind === "time", "head kind");
  assert(head?.main.stat === "critRate" && almost(head.main.value, 0.125), "main");
  assert(head?.subs[0]?.stat === "critDamage" && almost(head.subs[0].value, 0.24), "sub0");
  assert(head?.breakthroughs?.[0]?.stat === "circuitBoost", "break");

  const finalized = finalizeCircuitSchemeImport(decoded, ["冰法一套"]);
  assert(finalized.scheme.name === "冰法一套（匯入）", finalized.scheme.name);
  const finalized2 = finalizeCircuitSchemeImport(decoded, [
    "冰法一套",
    "冰法一套（匯入）",
  ]);
  assert(finalized2.scheme.name === "冰法一套（匯入 2）", finalized2.scheme.name);
}

const insigniaA = {
  id: "i1",
  name: "金暴傷",
  rarity: "epic",
  slots: ["頭", "手"],
  rank: 3,
  affixes: [
    { stat: "critDamage", value: 0.2 },
    { stat: "skillDamage", value: 0.08 },
  ],
  note: "副本掉落",
  createdAt: now,
  updatedAt: now,
};

const insigniaB = {
  id: "i2",
  name: "粉技傷",
  rarity: "rare",
  slots: ["武器"],
  rank: 2,
  affixes: [{ stat: "skillDamage", value: 0.05 }],
  note: "",
  createdAt: now,
  updatedAt: now,
};

const insigniaScheme = {
  id: "is1",
  name: "暴傷優先",
  note: "",
  equipped: { 頭: "i1", 武器: "i2" },
  createdAt: now,
  updatedAt: now,
};

{
  const code = await encodeInsigniaSchemeCode(
    insigniaScheme,
    new Map([
      [insigniaA.id, insigniaA],
      [insigniaB.id, insigniaB],
    ]),
  );
  assert(code.startsWith(`${INSIGNIA_SCHEME_PREFIX}.`), `ins prefix ${code.slice(0, 20)}`);
  assert(peekSchemeShareKind(code) === "insignia", "peek insignia");

  const decoded = await decodeInsigniaSchemeCode(`  ${code}  `);
  assert(decoded, "decode insignia");
  assert(decoded.scheme.name === "暴傷優先", decoded.scheme.name);
  assert(decoded.pieces.length === 2, `ins pieces ${decoded.pieces.length}`);
  const head = decoded.pieces.find((p) => p.id === decoded.scheme.equipped["頭"]);
  assert(head?.rarity === "epic" && head.rank === 3, "rarity/rank");
  assert(head?.slots.includes("頭") && head.slots.includes("手"), "slots");
  assert(almost(head?.affixes[0]?.value ?? 0, 0.2), "affix");
  assert(head?.note === "副本掉落", "piece note");

  const finalized = finalizeInsigniaSchemeImport(decoded, ["暴傷優先"]);
  assert(finalized.scheme.name === "暴傷優先（匯入）", finalized.scheme.name);
}

{
  const circuitCode = await encodeCircuitSchemeCode(circuitScheme, circuitById);
  const insDecoded = await decodeInsigniaSchemeCode(circuitCode);
  assert(insDecoded === null, "wrong kind should fail");
  assert(peekSchemeShareKind("hello") === null, "unknown peek");
}

console.log("scheme share checks passed");
