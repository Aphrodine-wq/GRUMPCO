/**
 * Vision API: POST /api/vision/design-to-code – screenshot/image + description → generated code.
 */

import { Router, type Request, type Response } from "express";
import { designToCode } from "../services/kimiVisionService.js";
import type { DesignToCodeFramework } from "../services/kimiVisionService.js";
import logger from "../middleware/logger.js";

const router = Router();

/**
 * POST /api/vision/design-to-code
 * Body: { image: base64 string, figmaUrl?: string, description: string, targetFramework: 'svelte' | 'react' | 'vue' | 'flutter' }
 * Returns: { code: string, explanation?: string }
 */
router.post("/design-to-code", async (req: Request, res: Response) => {
  try {
    const { image, figmaUrl, description, targetFramework } = req.body as {
      image?: string;
      figmaUrl?: string;
      description?: string;
      targetFramework?: string;
    };
    if (!image && !figmaUrl) {
      return res
        .status(400)
        .json({ error: "image (base64) or figmaUrl is required" });
    }
    if (typeof description !== "string" || !description.trim()) {
      return res
        .status(400)
        .json({
          error: "description is required and must be a non-empty string",
        });
    }
    const validFrameworks: DesignToCodeFramework[] = [
      "svelte",
      "react",
      "vue",
      "flutter",
    ];
    const framework = (
      validFrameworks.includes(targetFramework as DesignToCodeFramework)
        ? targetFramework
        : "svelte"
    ) as DesignToCodeFramework;

    const imageData =
      typeof image === "string" && image.trim().length > 0
        ? image.replace(/^data:image\/\w+;base64,/, "").trim()
        : undefined;
    const input = {
      description: description.trim(),
      targetFramework: framework,
      ...(imageData && { image: imageData }),
      ...(typeof figmaUrl === "string" &&
        figmaUrl.trim() && { figmaUrl: figmaUrl.trim() }),
    };
    const result = await designToCode(
      input as import("../services/kimiVisionService.js").DesignToCodeInput,
    );
    return res.json(result);
  } catch (e) {
    logger.warn({ error: (e as Error).message }, "Vision design-to-code error");
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
