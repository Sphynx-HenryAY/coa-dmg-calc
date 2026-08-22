const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function almost(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

const { configCompareDamage, parseObservedDamage, rankConfigDamage } = await import(
  "../src/lib/compare.ts"
);

assert(parseObservedDamage("") === null, "empty observed");
assert(parseObservedDamage(0) === null, "zero observed");
assert(parseObservedDamage(-1) === null, "negative observed");
assert(parseObservedDamage("12345") === 12345, "numeric string");

{
  const observed = configCompareDamage(1_200_000, 900_000);
  assert(observed.source === "observed" && observed.value === 1_200_000, "prefer observed");
  const formula = configCompareDamage(null, 900_000);
  assert(formula.source === "formula" && formula.value === 900_000, "fallback formula");
}

{
  const ranked = rankConfigDamage(
    [
      { id: "a", damage: 100 },
      { id: "b", damage: 250 },
      { id: "c", damage: 200 },
    ],
    100,
  );
  assert(ranked[0].id === "b" && ranked[0].rank === 1, "best first");
  assert(almost(ranked[0].ratioOfBest, 1), "best is 1");
  assert(almost(ranked[2].ratioOfBest, 0.4), "worst vs best");
  assert(almost(ranked[0].ratioOfBaseline, 2.5), "best vs baseline 100");
  assert(almost(ranked[2].ratioOfBaseline, 1), "baseline vs itself");
}

console.log("check-compare: ok");
