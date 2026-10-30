/** Pure mic-request transitions. Presence updates must not rewrite this list. */

function copyRequests(requests) {
  return Array.isArray(requests) ? requests.map((item) => ({ ...item })) : [];
}

function stamp(row, status) {
  const now = new Date().toISOString();
  return {
    ...row,
    status,
    updated_at: now,
    created_at: row.created_at || now,
  };
}

function nextMicRequests(requests, action, userId, displayName) {
  const id = String(userId || "");
  const list = copyRequests(requests);
  const index = list.findIndex((item) => String(item?.user_id) === id);
  const current = index >= 0 ? list[index] : null;
  const name = displayName || current?.display_name || "Unmasker";

  if (action === "request_mic") {
    if (current?.status === "pending") return { requests: list, unchanged: true };
    const next = list.filter((item) => String(item?.user_id) !== id);
    next.push(stamp({ user_id: id, display_name: name }, "pending"));
    return { requests: next, canPublish: false };
  }

  if (action === "approve_mic") {
    if (!current || current.status !== "pending") return { error: "Mic request not found.", status: 404 };
    const next = list.filter((item) => String(item?.user_id) !== id);
    next.push(stamp(current, "approved"));
    return { requests: next, canPublish: true };
  }

  if (action === "invite_speaker") {
    const next = list.filter((item) => String(item?.user_id) !== id);
    next.push(stamp({ ...(current || { user_id: id, display_name: name }) }, "approved"));
    return { requests: next, canPublish: true };
  }

  if (action === "deny_mic") {
    if (!current || current.status !== "pending") return { error: "Mic request not found.", status: 404 };
    const next = list.filter((item) => String(item?.user_id) !== id);
    next.push(stamp(current, "denied"));
    return { requests: next, canPublish: false };
  }

  if (action === "remove_speaker") {
    const next = list.filter((item) => String(item?.user_id) !== id);
    next.push(stamp(current || { user_id: id, display_name: name }, "revoked"));
    return { requests: next, canPublish: false, mute: true };
  }

  if (action === "mute_speaker") {
    return { requests: list, mute: true };
  }

  return { error: "Unknown mic action.", status: 400 };
}

function presencePatch({ participantCount, activeSpeakerCount, activeSpeakerName, previousActivity }) {
  const count = Number(participantCount) || 0;
  const speaking = Number.isFinite(Number(activeSpeakerCount)) ? Math.max(0, Math.min(Number(activeSpeakerCount), count)) : 0;
  return {
    participant_count: count,
    active_speaker_count: speaking,
    active_speaker_name: speaking > 0 && typeof activeSpeakerName === "string" ? activeSpeakerName.slice(0, 120) : "",
    last_activity_at: speaking > 0 ? new Date().toISOString() : (previousActivity || null),
  };
}

function publishPermission(canPublish) {
  return {
    canSubscribe: true,
    canPublish: !!canPublish,
    canPublishData: true,
    canPublishSources: canPublish ? ["MICROPHONE"] : [],
  };
}

module.exports = { nextMicRequests, presencePatch, publishPermission };
