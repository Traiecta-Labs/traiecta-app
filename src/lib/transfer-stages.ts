import type { TransferLifecycleStage } from "../api";
import type { Stage } from "../components/transfer/StageLamps";

/**
 * Map a lifecycle stage to the CSS-module class its badge wears.
 *
 * The styles record is a parameter rather than an import so the grouping can be exercised without
 * a stylesheet, and both callers hand in their own module. That keeps a single source of truth for
 * which stages share a colour while leaving each page free to name its classes.
 */
export function getStageClass(
  stage: TransferLifecycleStage,
  styles: Readonly<Record<string, string | undefined>>,
): string {
  switch (stage) {
    case "delivered":
    case "settled":
      return styles.stageDelivered ?? "";
    case "initiated":
    case "attesting":
    case "attested":
    case "delivering":
      return styles.stageInFlight ?? "";
    case "parked":
      return styles.stageParked ?? "";
    case "failed":
      return styles.stageFailed ?? "";
  }
}

/**
 * The three named lamps a transfer's rail shows on the inspector.
 *
 * The route index picks the rail's stage names and details, and the lifecycle stage picks which
 * lamp is lit. Index 0 is CCTP (burn/attest/mint), 2 is Axelar GMP (call/relay/execute), 3 is
 * Allbridge (deposit/relay/release) and every other index is Axelar ITS (dispatch/relay/receive).
 */
export function buildStages(route: number, stage: TransferLifecycleStage): Stage[] {
  let stageNames: [string, string, string];
  let stageDetails: [string, string, string];

  if (route === 0) {
    stageNames = ["burn", "attest", "mint"];
    stageDetails = ["origin SAC", "circle iris", "destination cctp"];
  } else if (route === 2) {
    stageNames = ["call", "relay", "execute"];
    stageDetails = ["origin gateway", "axelar validators", "destination execute"];
  } else if (route === 3) {
    stageNames = ["deposit", "relay", "release"];
    stageDetails = ["v_usd pool", "allbridge messenger", "destination pool"];
  } else {
    stageNames = ["dispatch", "relay", "receive"];
    stageDetails = ["origin token manager", "axelar network", "destination execute"];
  }

  const [s0, s1, s2] = stageNames;
  const [d0, d1, d2] = stageDetails;

  if (stage === "delivered" || stage === "settled") {
    return [
      { id: s0, name: s0, detail: d0, state: "completed" },
      { id: s1, name: s1, detail: d1, state: "completed" },
      { id: s2, name: s2, detail: d2, state: "completed" },
    ];
  }
  if (stage === "delivering" || stage === "parked") {
    return [
      { id: s0, name: s0, detail: d0, state: "completed" },
      { id: s1, name: s1, detail: d1, state: "completed" },
      { id: s2, name: s2, detail: d2, state: "active" },
    ];
  }
  if (stage === "attested") {
    return [
      { id: s0, name: s0, detail: d0, state: "completed" },
      { id: s1, name: s1, detail: d1, state: "completed" },
      { id: s2, name: s2, detail: d2, state: "idle" },
    ];
  }
  if (stage === "attesting") {
    return [
      { id: s0, name: s0, detail: d0, state: "completed" },
      { id: s1, name: s1, detail: d1, state: "active" },
      { id: s2, name: s2, detail: d2, state: "idle" },
    ];
  }
  if (stage === "failed") {
    return [
      { id: s0, name: s0, detail: d0, state: "completed" },
      { id: s1, name: s1, detail: d1, state: "failed" },
      { id: s2, name: s2, detail: d2, state: "idle" },
    ];
  }
  // initiated
  return [
    { id: s0, name: s0, detail: d0, state: "active" },
    { id: s1, name: s1, detail: d1, state: "idle" },
    { id: s2, name: s2, detail: d2, state: "idle" },
  ];
}
