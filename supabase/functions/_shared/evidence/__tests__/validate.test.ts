import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { presetsForDomain } from "../../blueprint/presets.ts";
import { validateDimensionSemantics } from "../validateDimensions.ts";

const PRODUCTS = [
  "smartphone",
  "smartwatch",
  "power_bank",
  "foundation",
  "lipstick",
  "moisturizer",
  "air_fryer",
  "washing_machine",
  "mountain_bike",
] as const;

describe("cross-category dimension validation", () => {
  const mustRejectCamera = ["foundation", "lipstick", "moisturizer", "air_fryer", "washing_machine", "power_bank"];
  for (const productType of mustRejectCamera) {
    it(`rejects camera dimension on ${productType}`, () => {
      const domain =
        productType === "foundation" || productType === "lipstick" || productType === "moisturizer"
          ? "beauty"
          : productType === "air_fryer" || productType === "washing_machine"
            ? "home-appliances"
            : "tech";
      const sem = validateDimensionSemantics(domain, productType, [{ key: "camera_quality", label: "Camera Quality" }]);
      assert.ok(sem.rejected.includes("camera_quality"));
    });
  }

  it("allows camera on smartphone preset dimensions", () => {
    const preset = presetsForDomain("tech").find((p) => p.productType === "smartphone");
    assert.ok(preset?.dimensions.some((d) => d.key === "camera_quality"));
  });
});
