const test = require("node:test");
const assert = require("node:assert/strict");
const { nextMicRequests, presencePatch, publishPermission } = require("./mic-access");

test("a listener can raise a hand and a second request stays pending", () => {
  const first = nextMicRequests([], "request_mic", "ada", "Ada");
  assert.equal(first.requests[0].status, "pending");
  const again = nextMicRequests(first.requests, "request_mic", "ada", "Ada");
  assert.equal(again.unchanged, true);
  assert.equal(again.requests.length, 1);
});

test("approve grants publish and deny or remove takes it away", () => {
  const pending = nextMicRequests([], "request_mic", "ada", "Ada").requests;
  const approved = nextMicRequests(pending, "approve_mic", "ada");
  assert.equal(approved.canPublish, true);
  assert.equal(approved.requests[0].status, "approved");
  assert.deepEqual(publishPermission(true).canPublishSources, ["MICROPHONE"]);

  const removed = nextMicRequests(approved.requests, "remove_speaker", "ada");
  assert.equal(removed.canPublish, false);
  assert.equal(removed.mute, true);
  assert.equal(removed.requests[0].status, "revoked");
  assert.deepEqual(publishPermission(false).canPublish, false);

  const missing = nextMicRequests([], "approve_mic", "ada");
  assert.equal(missing.status, 404);
});

test("invite creates an approval without a prior request", () => {
  const invited = nextMicRequests([], "invite_speaker", "bea", "Bea");
  assert.equal(invited.requests[0].status, "approved");
  assert.equal(invited.canPublish, true);
});

test("presence patches do not include mic requests or co-hosts", () => {
  const patch = presencePatch({
    participantCount: 4,
    activeSpeakerCount: 9,
    activeSpeakerName: "Ada",
    previousActivity: "earlier",
  });
  assert.equal(patch.participant_count, 4);
  assert.equal(patch.active_speaker_count, 4);
  assert.equal(patch.active_speaker_name, "Ada");
  assert.equal("mic_requests" in patch, false);
  assert.equal("cohost_ids" in patch, false);
});
