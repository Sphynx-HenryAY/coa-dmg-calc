const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

const { parseCircuitText } = await import("../src/lib/circuitParse.ts");

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function almost(a, b) {
  return Math.abs(a - b) < 1e-9;
}

{
  const r = parseCircuitText(`時間
暴擊率 +12.5%
暴擊傷害 +24%
智力 +8.2%
物攻 +45
冰屬 +12
迴路增傷 +4.5%
傷害提升 +3%`);
  assert(r.kind === "time", `kind want time got ${r.kind}`);
  assert(r.main?.stat === "critRate" && almost(r.main.value, 0.125), `main ${JSON.stringify(r.main)}`);
  assert(r.subs.map((s) => s.stat).join(",") === "critDamage,int,pAtk,ice", `subs ${r.subs.map((s) => s.stat)}`);
  assert(almost(r.subs[0].value, 0.24), "crit dmg");
  assert(r.subs[2].value === 45, "flat pAtk");
  assert(r.breakthroughs.map((s) => s.stat).join(",") === "circuitBoost,damageBoost", `breaks ${r.breakthroughs.map((s) => s.stat)}`);
  assert(almost(r.breakthroughs[0].value, 0.045), "circuit boost");
}

{
  const r = parseCircuitText(`主：技能傷害 +18%
副屬性
智力 +8%
火屬 +20
突破
技能傷害 +4%
迴路增傷 +5%`);
  assert(r.kind === "star", `star kind ${r.kind}`);
  assert(r.main?.stat === "skillDamage" && almost(r.main.value, 0.18), `star main ${JSON.stringify(r.main)}`);
  assert(r.subs.map((s) => s.stat).join(",") === "int,fire", `star subs`);
  assert(r.breakthroughs.map((s) => s.stat).join(",") === "skillDamage,circuitBoost", `star breaks`);
}

{
  const r = parseCircuitText("輝鑰 攻擊力 320 智力 6.5 暴率 8 冷卻 4 突破 攻擊力 40");
  assert(r.kind === "key", "key kind");
  assert(r.main?.stat === "attack" && r.main.value === 320, `key main ${JSON.stringify(r.main)}`);
  assert(r.subs.map((s) => s.stat).join(",") === "int,critRate,cooldown", `key subs ${r.subs.map((s) => s.stat)}`);
  assert(r.breakthroughs[0]?.stat === "attack" && r.breakthroughs[0].value === 40, "key break attack");
}

{
  const r = parseCircuitText("冥燈 生命值 +2800 體質 12 精神 8");
  assert(r.kind === "nether", "nether");
  assert(r.main?.stat === "hp" && r.main.value === 2800, "hp main");
}

{
  const r = parseCircuitText("暴率412.5%");
  assert(r.main?.stat === "critRate" && almost(r.main.value, 0.125), `ocr plus ${JSON.stringify(r.main)}`);
}

{
  const r = parseCircuitText("物理攻擊 +80\n魔法攻擊 +60");
  assert(r.subs.some((s) => s.stat === "pAtk" && s.value === 80), "pAtk flat");
  assert(r.subs.some((s) => s.stat === "mAtk" && s.value === 60), "mAtk flat");
}

{
  const r = parseCircuitText("時 間\n暴 擊 率 +12.5%\n暴 擊 傷 害 +24%");
  assert(r.kind === "time", "spaced kind");
  assert(r.main?.stat === "critRate" && almost(r.main.value, 0.125), "spaced crit");
  assert(r.subs[0]?.stat === "critDamage", "spaced crit dmg");
}

console.log("circuit parse checks passed");
