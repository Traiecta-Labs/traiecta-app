import { describe, expect, it } from "vitest";
import type { TransferLifecycleStage } from "../src/api";
import type { StageState } from "../src/components/transfer/StageLamps";
import { buildStages, getStageClass } from "../src/lib/transfer-stages";

const ALL_STAGES: readonly TransferLifecycleStage[] = [
  "initiated",
  "attesting",
  "attested",
  "delivering",
  "delivered",
  "parked",
  "settled",
  "failed",
];

const STAGE_STATES: Record<TransferLifecycleStage, [StageState, StageState, StageState]> = {
  initiated: ["active", "idle", "idle"],
  attesting: ["completed", "active", "idle"],
  attested: ["completed", "completed", "idle"],
  delivering: ["completed", "completed", "active"],
  delivered: ["completed", "completed", "completed"],
  parked: ["completed", "completed", "active"],
  settled: ["completed", "completed", "completed"],
  failed: ["completed", "failed", "idle"],
};

const RAILS: {
  readonly route: number;
  readonly names: [string, string, string];
  readonly details: [string, string, string];
}[] = [
  {
    route: 0,
    names: ["burn", "attest", "mint"],
    details: ["origin SAC", "circle iris", "destination cctp"],
  },
  {
    route: 2,
    names: ["call", "relay", "execute"],
    details: ["origin gateway", "axelar validators", "destination execute"],
  },
  {
    route: 3,
    names: ["deposit", "relay", "release"],
    details: ["v_usd pool", "allbridge messenger", "destination pool"],
  },
  {
    route: 1,
    names: ["dispatch", "relay", "receive"],
    details: ["origin token manager", "axelar network", "destination execute"],
  },
];

const badgeStyles = {
  stageDelivered: "stageDelivered",
  stageInFlight: "stageInFlight",
  stageParked: "stageParked",
  stageFailed: "stageFailed",
};

describe("Transfer stage mapping", () => {
  it("groups every lifecycle stage onto a badge class", () => {
    expect(ALL_STAGES).toHaveLength(8);
    expect(getStageClass("delivered", badgeStyles)).toBe("stageDelivered");
    expect(getStageClass("settled", badgeStyles)).toBe("stageDelivered");
    expect(getStageClass("initiated", badgeStyles)).toBe("stageInFlight");
    expect(getStageClass("attesting", badgeStyles)).toBe("stageInFlight");
    expect(getStageClass("attested", badgeStyles)).toBe("stageInFlight");
    expect(getStageClass("delivering", badgeStyles)).toBe("stageInFlight");
    expect(getStageClass("parked", badgeStyles)).toBe("stageParked");
    expect(getStageClass("failed", badgeStyles)).toBe("stageFailed");
  });

  it("falls back to an empty class when the stylesheet omits a badge", () => {
    expect(getStageClass("delivered", {})).toBe("");
    expect(getStageClass("failed", {})).toBe("");
  });

  it("maps each of the four rails to its stage names and details", () => {
    for (const rail of RAILS) {
      const stages = buildStages(rail.route, "initiated");
      expect(stages).toHaveLength(3);
      expect(stages.map((s) => s.id)).toEqual(rail.names);
      expect(stages.map((s) => s.name)).toEqual(rail.names);
      expect(stages.map((s) => s.detail)).toEqual(rail.details);
    }
  });

  it("assigns the lamp states for every lifecycle stage", () => {
    for (const stage of ALL_STAGES) {
      expect(buildStages(1, stage).map((s) => s.state)).toEqual(STAGE_STATES[stage]);
    }
  });
});
