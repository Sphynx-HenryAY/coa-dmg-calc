const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function almost(a, b, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

const { emptyStats, calculateDamage, TRAINING_DUMMY_DEF } = await import(
  "../src/lib/damage.ts"
);
const {
  PROFESSION_CATALOG,
  applyProfessionCycle,
  calibrateCycleMultiplier,
  createCustomProfession,
  cycleMultiplierFromSkills,
  evaluateProfessionConfig,
  findProfession,
  isBuiltinProfessionId,
  isProfessionId,
  listProfessions,
  normalizeCustomProfession,
  rankProfessions,
  resolveProfession,
  resolvedCycleMultiplier,
} = await import("../src/lib/profession.ts");

{
  const skills = [
    { id: "a", name: "A", percent: 800, hits: 2, uses: 1, enabled: true },
    { id: "b", name: "B", percent: 400, hits: 1, uses: 2, enabled: true },
    { id: "c", name: "C", percent: 999, hits: 1, uses: 1, enabled: false },
  ];
  // 8*2 + 4*2 = 24
  assert(almost(cycleMultiplierFromSkills(skills), 24), "cycle from skills");
  assert(almost(resolvedCycleMultiplier(1.5, skills), 24), "skills override cycle field");
  assert(almost(resolvedCycleMultiplier(1.5, []), 1.5), "fallback cycle field");
}

{
  const stats = {
    ...emptyStats(),
    attack: 10000,
    defenseBreak: 2000,
    critRate: 1,
    critDamage: 1,
    skillDamage: 0.5,
    normalAttackDamage: 0.2,
    bossDamage: 1,
    trainingCorrection: 0.08,
    skillMultiplier: 1,
    penetration: 0,
  };

  const dmg = calculateDamage(stats);
  assert(dmg.trainingDamage < dmg.finalDamage, "training excludes boss so it is lower");
  assert(
    almost(dmg.trainingDamage, dmg.vsTrainingDummy(TRAINING_DUMMY_DEF)),
    "trainingDamage is dummy at 14000",
  );
  assert(
    almost(dmg.factors.skillResonance, 1 + 0.5 + 0.2),
    "技傷 and 普攻傷害 both add into the same zone",
  );
}

{
  assert(isProfessionId("berserker"), "known id");
  assert(isBuiltinProfessionId("ghostblade"), "ghostblade is built-in");
  assert(isProfessionId("wizard"), "any non-empty string is a profession id");
  assert(!isBuiltinProfessionId("wizard"), "wizard is not built-in");
  assert(PROFESSION_CATALOG.length >= 15, "catalog size includes 鬼刃");
  assert(
    PROFESSION_CATALOG.some((p) => p.id === "ghostblade" && p.name === "鬼刃"),
    "鬼刃 in catalog",
  );

  const resolved = resolveProfession("bounty", [
    { id: "bounty", cycleMultiplier: 12 },
  ]);
  assert(resolved && almost(resolved.cycleMultiplier, 12), "override cycle");

  const base = {
    ...emptyStats(),
    attack: 20000,
    defenseBreak: 8000,
    critRate: 0.5,
    critDamage: 1.5,
    elementalPower: 200,
    skillDamage: 0.4,
    resonance: 0.1,
    damageBoost: 0.5,
    trainingCorrection: 0.08,
    skillMultiplier: 1,
    bossDamage: 0.9,
  };

  const none = evaluateProfessionConfig({
    base,
    bags: [],
    damageType: "magic",
    profession: null,
  });
  const mage = evaluateProfessionConfig({
    base,
    bags: [],
    damageType: "magic",
    profession: resolveProfession("elementalist"),
  });
  assert(
    almost(none.finalDamage, mage.finalDamage),
    "default cycle 1 leaves sheet damage unchanged",
  );

  const calibrated = resolveProfession("elementalist", [
    { id: "elementalist", cycleMultiplier: 2 },
  ]);
  const doubled = evaluateProfessionConfig({
    base,
    bags: [],
    damageType: "magic",
    profession: calibrated,
  });
  assert(almost(doubled.finalDamage, mage.finalDamage * 2), "cycle scales damage");

  const cycle = calibrateCycleMultiplier(mage.trainingDamage * 3, mage.trainingDamage);
  assert(almost(cycle, 3), "calibrate 3x");
}

{
  const stats = applyProfessionCycle(
    { ...emptyStats(), skillMultiplier: 2 },
    resolveProfession("warlock", [{ id: "warlock", cycleMultiplier: 4 }]),
  );
  assert(almost(stats.stats.skillMultiplier, 8), "base tweak × cycle");
}

{
  const dummy = {
    finalDamage: 1,
    trainingDamage: 0,
    factors: {},
    effectiveStats: emptyStats(),
    vsMonster: () => 0,
    vsTrainingDummy: () => 0,
  };
  const ranked = rankProfessions([
    {
      profession: resolveProfession("elsa"),
      result: { ...dummy, trainingDamage: 100 },
      cycleMultiplier: 1,
      damageType: "magic",
      element: "all",
      trainingDps: 10,
    },
    {
      profession: resolveProfession("berserker"),
      result: { ...dummy, trainingDamage: 250 },
      cycleMultiplier: 1,
      damageType: "physical",
      element: "fire",
      trainingDps: 25,
    },
  ]);
  assert(ranked[0].profession.id === "berserker", "best first");
  assert(ranked[0].rank === 1 && ranked[1].rank === 2, "ranks");
  assert(almost(ranked[1].ratioOfBest, 0.4), "ratio");
}

{
  const created = createCustomProfession(
    { name: " 自訂刃 ", family: "mage", damageType: "magic", defaultElement: "ice" },
    [],
  );
  assert(created.name === "自訂刃", "trim custom name");
  assert(!isBuiltinProfessionId(created.id), "custom id is not built-in");
  assert(created.family === "mage" && created.damageType === "magic", "custom identity");
  const listed = listProfessions([created]);
  assert(listed.some((p) => p.id === created.id), "custom appears in list");
  assert(listed.some((p) => p.id === "ghostblade"), "built-in still listed");
  const resolved = resolveProfession(
    created.id,
    [{ id: created.id, cycleMultiplier: 3 }],
    [created],
  );
  assert(resolved && almost(resolved.cycleMultiplier, 3), "custom override cycle");
  assert(findProfession(created.id, [created])?.name === "自訂刃", "find custom");
  const skipped = normalizeCustomProfession({
    id: "ghostblade",
    name: "fake",
    family: "sword",
    damageType: "physical",
  });
  assert(skipped === null, "cannot store built-in as custom");
}

console.log("check-profession: ok");
