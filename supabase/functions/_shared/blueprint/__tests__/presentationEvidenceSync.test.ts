import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { currentEvidenceFingerprint } from "../../evidence/versions.ts";
import {
  conversationEvidenceCount,
  evidenceCorpusFingerprint,
  presentationMatchesConversationEvidence,
} from "../presentationEvidenceSync.ts";

describe("presentationMatchesConversationEvidence", () => {
  it("returns false when conversation evidence count changed", () => {
    const profile = { conversationEvidence: [{ id: "1", text: "hello world test" }] };
    const presentation = {
      version: 1,
      ...currentEvidenceFingerprint(),
      intelligenceMeta: {
        blueprintVersion: 2,
        domainTemplateVersion: 1,
        classificationConfidence: 0.9,
        conversationEvidenceCount: 0,
        evidenceCorpusFingerprint: "0::",
        ...currentEvidenceFingerprint(),
      },
    };
    assert.equal(conversationEvidenceCount(profile), 1);
    assert.equal(presentationMatchesConversationEvidence(profile, presentation as never), false);
  });

  it("returns true when count and algo match", () => {
    const profile = { conversationEvidence: [{ id: "1", text: "hello world test" }] };
    const presentation = {
      version: 1,
      blueprintVersion: 2,
      ...currentEvidenceFingerprint(),
      intelligenceMeta: {
        blueprintVersion: 2,
        domainTemplateVersion: 1,
        classificationConfidence: 0.9,
        conversationEvidenceCount: 1,
        evidenceCorpusFingerprint: evidenceCorpusFingerprint(profile),
        ...currentEvidenceFingerprint(),
      },
    };
    assert.equal(presentationMatchesConversationEvidence(profile, presentation as never), true);
  });
});
