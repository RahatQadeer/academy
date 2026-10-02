import assert from "node:assert/strict";
import test from "node:test";
import {
  capabilitiesForRole,
  roleSetGrantsCapability,
} from "./capabilityMatrix.ts";

test("Admin cannot grant Super Admin capabilities", () => {
  assert.equal(roleSetGrantsCapability(["admin"], "roles.manage"), false);
  assert.equal(roleSetGrantsCapability(["admin"], "admins.create"), false);
  assert.equal(roleSetGrantsCapability(["admin"], "permissions.manage"), false);
  assert.equal(roleSetGrantsCapability(["admin"], "settings.manage_global"), false);
  assert.equal(roleSetGrantsCapability(["admin"], "settings.manage"), true);
  assert.equal(roleSetGrantsCapability(["admin"], "admin.area"), true);
});

test("Super Admin inherits Admin settings and privileged caps", () => {
  assert.equal(roleSetGrantsCapability(["super_admin"], "settings.manage"), true);
  assert.equal(roleSetGrantsCapability(["super_admin"], "admins.create"), true);
  assert.equal(roleSetGrantsCapability(["super_admin"], "permissions.view"), true);
  assert.equal(roleSetGrantsCapability(["super_admin"], "permissions.manage"), true);
});

test("Learner and Instructor stay in their areas", () => {
  assert.deepEqual(capabilitiesForRole("learner"), ["learner.area"]);
  assert.deepEqual(capabilitiesForRole("instructor"), ["instructor.area"]);
});
