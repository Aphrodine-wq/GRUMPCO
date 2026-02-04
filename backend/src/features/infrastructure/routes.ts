/**
 * Infrastructure Automation Routes
 *
 * API endpoints for generating Kubernetes, Terraform, Docker, and CI/CD configs.
 */

import { Router, type Request, type Response } from "express";
import {
  generateK8sManifests,
  generateTerraform,
  generateDocker,
  generateCICD,
} from "./service.js";
import {
  type K8sGenerationRequest,
  type TerraformGenerationRequest,
  type DockerGenerationRequest,
  type CICDGenerationRequest,
} from "./types.js";

const router = Router();

/**
 * POST /api/infra/kubernetes
 * Generate Kubernetes manifests
 */
router.post("/kubernetes", async (req: Request, res: Response) => {
  try {
    const request = req.body as K8sGenerationRequest;

    if (!request.projectName || !request.services?.length) {
      res.status(400).json({
        error: "Missing projectName or services",
        type: "validation_error",
      });
      return;
    }

    const result = await generateK8sManifests(request);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const err = error as Error;
    console.error("K8s generation error:", err);
    res.status(500).json({
      error: err.message,
      type: "generation_error",
    });
  }
});

/**
 * POST /api/infra/terraform
 * Generate Terraform configuration
 */
router.post("/terraform", async (req: Request, res: Response) => {
  try {
    const request = req.body as TerraformGenerationRequest;

    if (
      !request.provider ||
      !request.projectName ||
      !request.resources?.length
    ) {
      res.status(400).json({
        error: "Missing provider, projectName, or resources",
        type: "validation_error",
      });
      return;
    }

    const validProviders = ["aws", "gcp", "azure"];
    if (!validProviders.includes(request.provider)) {
      res.status(400).json({
        error: `Invalid provider. Must be one of: ${validProviders.join(", ")}`,
        type: "validation_error",
      });
      return;
    }

    const result = await generateTerraform(request);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Terraform generation error:", err);
    res.status(500).json({
      error: err.message,
      type: "generation_error",
    });
  }
});

/**
 * POST /api/infra/docker
 * Generate Docker configuration
 */
router.post("/docker", async (req: Request, res: Response) => {
  try {
    const request = req.body as DockerGenerationRequest;

    if (!request.projectType || !request.projectName) {
      res.status(400).json({
        error: "Missing projectType or projectName",
        type: "validation_error",
      });
      return;
    }

    const validTypes = ["node", "python", "go", "java", "rust", "custom"];
    if (!validTypes.includes(request.projectType)) {
      res.status(400).json({
        error: `Invalid projectType. Must be one of: ${validTypes.join(", ")}`,
        type: "validation_error",
      });
      return;
    }

    const result = await generateDocker(request);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Docker generation error:", err);
    res.status(500).json({
      error: err.message,
      type: "generation_error",
    });
  }
});

/**
 * POST /api/infra/cicd
 * Generate CI/CD pipeline configuration
 */
router.post("/cicd", async (req: Request, res: Response) => {
  try {
    const request = req.body as CICDGenerationRequest;

    if (!request.platform || !request.projectType || !request.stages?.length) {
      res.status(400).json({
        error: "Missing platform, projectType, or stages",
        type: "validation_error",
      });
      return;
    }

    const validPlatforms = [
      "github-actions",
      "gitlab-ci",
      "jenkins",
      "circleci",
    ];
    if (!validPlatforms.includes(request.platform)) {
      res.status(400).json({
        error: `Invalid platform. Must be one of: ${validPlatforms.join(", ")}`,
        type: "validation_error",
      });
      return;
    }

    const result = await generateCICD(request);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const err = error as Error;
    console.error("CI/CD generation error:", err);
    res.status(500).json({
      error: err.message,
      type: "generation_error",
    });
  }
});

/**
 * GET /api/infra/templates
 * Get available templates and options
 */
router.get("/templates", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      kubernetes: {
        description: "Generate Kubernetes manifests",
        options: {
          environments: ["development", "staging", "production"],
          features: ["ingress", "hpa", "configmaps", "secrets"],
        },
      },
      terraform: {
        description: "Generate Terraform infrastructure as code",
        providers: ["aws", "gcp", "azure"],
        resources: {
          aws: [
            "vpc",
            "subnet",
            "ec2",
            "rds",
            "s3",
            "eks",
            "ecs",
            "lambda",
            "api-gateway",
            "cloudfront",
            "elb",
            "security-group",
            "iam",
          ],
          gcp: [
            "vpc",
            "gke",
            "cloud-run",
            "cloud-sql",
            "gcs",
            "cloud-functions",
          ],
          azure: [
            "vnet",
            "aks",
            "app-service",
            "azure-sql",
            "storage",
            "functions",
          ],
        },
      },
      docker: {
        description: "Generate Dockerfile and docker-compose",
        projectTypes: ["node", "python", "go", "java", "rust", "custom"],
        features: ["multi-stage", "compose", "health-check"],
      },
      cicd: {
        description: "Generate CI/CD pipeline configuration",
        platforms: ["github-actions", "gitlab-ci", "jenkins", "circleci"],
        stages: ["lint", "test", "build", "deploy", "security-scan"],
        deployTargets: [
          "kubernetes",
          "ecs",
          "ec2",
          "lambda",
          "vercel",
          "netlify",
        ],
      },
    },
  });
});

/**
 * GET /api/infra/health
 * Health check for infrastructure service
 */
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "infrastructure",
    version: "1.0.0",
  });
});

export default router;
