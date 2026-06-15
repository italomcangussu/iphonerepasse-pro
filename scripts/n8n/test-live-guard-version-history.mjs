import assert from "node:assert/strict";
import { describeVersionTransition } from "./guard-live-workflow-sync.mjs";

const previousState = {
  workflowId: "Cr4fPWe0prwS6XjI",
  lastSyncedVersionId: "0eae41fe-1111-4111-8111-111111111111",
  lastSyncedUpdatedAt: "2026-06-15T00:01:32.000Z",
  signature: "same-signature",
  syncedAt: "2026-06-15T00:02:00.000Z",
};

const live = {
  versionId: "b404c3a9-3e90-4868-bfd6-977fdae1f88c",
  updatedAt: "2026-06-15T10:20:30.730Z",
  active: true,
};

const transition = describeVersionTransition({
  previousState,
  live,
  liveSignature: "same-signature",
  snapshotSignature: "same-signature",
});

assert.equal(transition.drift, false);
assert.equal(transition.manualEdit, true);
assert.equal(transition.needsAttention, true);
assert.equal(transition.previousVersionId, previousState.lastSyncedVersionId);
assert.equal(transition.liveVersionId, live.versionId);
assert.equal(transition.reason, "version-moved-without-content-drift");

console.log("live guard version-history tests passed");
