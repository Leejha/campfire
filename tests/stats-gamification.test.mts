import assert from "node:assert/strict";
import test from "node:test";

import { getPersonalFlameGrowth } from "../app/routes/stats/gamification.ts";

test("first participation starts a flame and earns the first session badge", (): void => {
  const growth = getPersonalFlameGrowth({ record: { participatedSessionCount: 1, completedTaskCount: 0 } });

  assert.equal(growth.currentStage.name, "불씨");
  assert.equal(growth.hasEarnedCurrentStage, true);
  assert.equal(growth.nextStage?.name, "작은 불꽃");
  assert.deepEqual(growth.progress, [
    { metric: "participatedSessionCount", current: 1, target: 5, remaining: 4, percent: 20 },
    { metric: "completedTaskCount", current: 0, target: 10, remaining: 10, percent: 0 },
  ]);
  assert.deepEqual(growth.earnedBadges.map(({ id, name }) => ({ id, name })), [{ id: "session-1", name: "첫 불씨" }]);
});

test("both exact thresholds promote the flame and preserve every earned badge", (): void => {
  const growth = getPersonalFlameGrowth({ record: { participatedSessionCount: 5, completedTaskCount: 10 } });

  assert.equal(growth.currentStage.name, "작은 불꽃");
  assert.equal(growth.nextStage?.name, "모닥불");
  assert.deepEqual(growth.progress, [
    { metric: "participatedSessionCount", current: 5, target: 10, remaining: 5, percent: 50 },
    { metric: "completedTaskCount", current: 10, target: 25, remaining: 15, percent: 40 },
  ]);
  assert.deepEqual(growth.earnedBadges.map(({ id }) => id), ["session-1", "session-5", "task-1", "task-10"]);
});

test("one fulfilled axis does not promote the stage while the other remains", (): void => {
  const growth = getPersonalFlameGrowth({ record: { participatedSessionCount: 10, completedTaskCount: 24 } });

  assert.equal(growth.currentStage.name, "작은 불꽃");
  assert.equal(growth.nextStage?.name, "모닥불");
  assert.deepEqual(growth.progress, [
    { metric: "participatedSessionCount", current: 10, target: 10, remaining: 0, percent: 100 },
    { metric: "completedTaskCount", current: 24, target: 25, remaining: 1, percent: 96 },
  ]);
  assert.deepEqual(growth.earnedBadges.map(({ id }) => id), ["session-1", "session-5", "session-10", "task-1", "task-10"]);
});

test("the final flame removes the next stage and its progress", (): void => {
  const growth = getPersonalFlameGrowth({ record: { participatedSessionCount: 25, completedTaskCount: 50 } });

  assert.equal(growth.currentStage.name, "오래 타는 불");
  assert.equal(growth.nextStage, null);
  assert.deepEqual(growth.progress, []);
  assert.deepEqual(growth.earnedBadges.map(({ id }) => id), ["session-1", "session-5", "session-10", "session-25", "task-1", "task-10", "task-25", "task-50"]);
});

test("records continue collecting badges beyond the final flame", (): void => {
  const growth = getPersonalFlameGrowth({ record: { participatedSessionCount: 100, completedTaskCount: 250 } });

  assert.equal(growth.currentStage.name, "오래 타는 불");
  assert.equal(growth.nextStage, null);
  assert.deepEqual(growth.progress, []);
  assert.deepEqual(growth.earnedBadges.map(({ id }) => id), ["session-1", "session-5", "session-10", "session-25", "session-50", "session-100", "task-1", "task-10", "task-25", "task-50", "task-100", "task-250"]);
});

test("partial records show independent progress and only earned badges", (): void => {
  const growth = getPersonalFlameGrowth({ record: { participatedSessionCount: 3, completedTaskCount: 4 } });

  assert.equal(growth.currentStage.name, "불씨");
  assert.equal(growth.nextStage?.name, "작은 불꽃");
  assert.deepEqual(growth.progress, [
    { metric: "participatedSessionCount", current: 3, target: 5, remaining: 2, percent: 60 },
    { metric: "completedTaskCount", current: 4, target: 10, remaining: 6, percent: 40 },
  ]);
  assert.deepEqual(growth.earnedBadges.map(({ id }) => id), ["session-1", "task-1"]);
});

test("a defensive empty record has a base flame without claiming an earned stage", (): void => {
  const growth = getPersonalFlameGrowth({ record: { participatedSessionCount: 0, completedTaskCount: 0 } });

  assert.equal(growth.currentStage.name, "불씨");
  assert.equal(growth.hasEarnedCurrentStage, false);
  assert.equal(growth.nextStage?.name, "작은 불꽃");
  assert.deepEqual(growth.progress, [
    { metric: "participatedSessionCount", current: 0, target: 5, remaining: 5, percent: 0 },
    { metric: "completedTaskCount", current: 0, target: 10, remaining: 10, percent: 0 },
  ]);
  assert.deepEqual(growth.earnedBadges, []);
});

test("an exceeded axis is capped without compensating for the unfinished axis", (): void => {
  const growth = getPersonalFlameGrowth({ record: { participatedSessionCount: 100, completedTaskCount: 4 } });

  assert.equal(growth.currentStage.name, "불씨");
  assert.equal(growth.nextStage?.name, "작은 불꽃");
  assert.deepEqual(growth.progress, [
    { metric: "participatedSessionCount", current: 100, target: 5, remaining: 0, percent: 100 },
    { metric: "completedTaskCount", current: 4, target: 10, remaining: 6, percent: 40 },
  ]);
});
