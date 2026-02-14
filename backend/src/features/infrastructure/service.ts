/**
 * Infrastructure Automation Service
 *
 * Generates Kubernetes, Terraform, Docker, and CI/CD configurations.
 */

import { getStream, type StreamParams } from '../../services/ai-providers/llmGateway.js';
import {
  type K8sGenerationRequest,
  type K8sGenerationResult,
  type K8sManifest,
  type TerraformGenerationRequest,
  type TerraformGenerationResult,
  type DockerGenerationRequest,
  type DockerGenerationResult,
  type CICDGenerationRequest,
  type CICDGenerationResult,
} from './types.js';

const DEFAULT_MODEL = 'moonshotai/kimi-k2.5';

/**
 * Helper to call LLM via gateway and get complete response text
 */
async function callLLM(params: StreamParams): Promise<string> {
  const stream = getStream(params, {
    provider: 'nim',
    modelId: params.model || DEFAULT_MODEL,
  });
  let responseText = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      responseText += event.delta.text;
    }
  }
  return responseText;
}

const INFRA_SYSTEM_PROMPT = `You are an expert DevOps engineer and infrastructure architect. You specialize in:
- Kubernetes manifests and Helm charts
- Terraform/OpenTofu infrastructure as code
- Docker and container orchestration
- CI/CD pipelines (GitHub Actions, GitLab CI, Jenkins)
- Cloud architecture (AWS, GCP, Azure)

When generating infrastructure code:
1. Follow best practices and security guidelines
2. Use proper resource limits and requests
3. Include health checks and readiness probes
4. Add appropriate labels and annotations
5. Consider scalability and high availability
6. Include comments explaining configuration choices

Generate production-ready, well-documented infrastructure code.`;

/**
 * Generate Kubernetes manifests
 */
export async function generateK8sManifests(
  request: K8sGenerationRequest
): Promise<K8sGenerationResult> {
  const {
    projectName,
    services,
    ingress,
    namespace = 'default',
    environment = 'production',
  } = request;

  const prompt = `Generate Kubernetes manifests for the following application:

Project: ${projectName}
Environment: ${environment}
Namespace: ${namespace}

Services:
${services
  .map(
    (s) => `- ${s.name}: image=${s.image}, port=${s.port}, replicas=${s.replicas || 1}
  Resources: CPU=${s.resources?.cpu || '100m'}, Memory=${s.resources?.memory || '128Mi'}
  Env vars: ${s.env?.map((e) => e.name).join(', ') || 'none'}`
  )
  .join('\n')}

${ingress ? `Ingress: host=${ingress.host}, tls=${ingress.tls}` : 'No ingress required'}

Generate the following Kubernetes resources as valid YAML:
1. Namespace (if not default)
2. Deployments for each service
3. Services for each deployment
4. ConfigMap for non-sensitive config
5. Ingress (if specified)
6. HorizontalPodAutoscaler for production workloads

Include:
- Resource limits and requests
- Liveness and readiness probes
- Pod anti-affinity for HA
- Security contexts
- Proper labels

Respond with each manifest as a separate YAML block:
\`\`\`yaml
# Deployment for [service-name]
...
\`\`\``;

  const responseText = await callLLM({
    model: DEFAULT_MODEL,
    max_tokens: 8192,
    system: INFRA_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  // Parse YAML blocks from response
  const yamlBlocks = responseText.match(/```yaml\n?([\s\S]*?)\n?```/g) || [];
  const manifests = yamlBlocks.map((block) =>
    block.replace(/```yaml\n?/, '').replace(/\n?```/, '')
  );

  // Categorize manifests
  const deployments: K8sManifest[] = [];
  const k8sServices: K8sManifest[] = [];
  const configMaps: K8sManifest[] = [];
  const secrets: K8sManifest[] = [];
  const hpas: K8sManifest[] = [];
  let ingressManifest: K8sManifest | undefined;
  let namespaceManifest: string | undefined;

  for (const manifest of manifests) {
    if (manifest.includes('kind: Deployment')) {
      deployments.push({
        kind: 'Deployment',
        apiVersion: 'apps/v1',
        metadata: { name: '' },
        spec: {},
      });
    } else if (manifest.includes('kind: Service')) {
      k8sServices.push({
        kind: 'Service',
        apiVersion: 'v1',
        metadata: { name: '' },
        spec: {},
      });
    } else if (manifest.includes('kind: ConfigMap')) {
      configMaps.push({
        kind: 'ConfigMap',
        apiVersion: 'v1',
        metadata: { name: '' },
        spec: {},
      });
    } else if (manifest.includes('kind: Secret')) {
      secrets.push({
        kind: 'Secret',
        apiVersion: 'v1',
        metadata: { name: '' },
        spec: {},
      });
    } else if (manifest.includes('kind: Ingress')) {
      ingressManifest = {
        kind: 'Ingress',
        apiVersion: 'networking.k8s.io/v1',
        metadata: { name: '' },
        spec: {},
      };
    } else if (manifest.includes('kind: HorizontalPodAutoscaler')) {
      hpas.push({
        kind: 'HorizontalPodAutoscaler',
        apiVersion: 'autoscaling/v2',
        metadata: { name: '' },
        spec: {},
      });
    } else if (manifest.includes('kind: Namespace')) {
      namespaceManifest = manifest;
    }
  }

  return {
    namespace: namespaceManifest,
    deployments,
    services: k8sServices,
    configMaps: configMaps.length > 0 ? configMaps : undefined,
    secrets: secrets.length > 0 ? secrets : undefined,
    ingress: ingressManifest,
    hpa: hpas.length > 0 ? hpas : undefined,
    combined: manifests.join('\n---\n'),
  };
}

/**
 * Generate Terraform configuration
 */
export async function generateTerraform(
  request: TerraformGenerationRequest
): Promise<TerraformGenerationResult> {
  const {
    provider,
    projectName,
    resources,
    region,
    environment = 'production',
    tags = {},
  } = request;

  const providerConfig: Record<string, string> = {
    aws: 'us-east-1',
    gcp: 'us-central1',
    azure: 'eastus',
  };

  const prompt = `Generate Terraform configuration for ${provider.toUpperCase()}:

Project: ${projectName}
Region: ${region || providerConfig[provider]}
Environment: ${environment}

Resources requested:
${resources.map((r) => `- ${r.type}: ${r.name}${r.config ? ` (config: ${JSON.stringify(r.config)})` : ''}`).join('\n')}

Default tags: ${JSON.stringify({ ...tags, Environment: environment, Project: projectName, ManagedBy: 'Terraform' })}

Generate the following Terraform files:

1. **main.tf** - Main resource definitions
2. **variables.tf** - Input variables with descriptions and defaults
3. **outputs.tf** - Output values
4. **providers.tf** - Provider configuration with version constraints

Include:
- Proper resource naming conventions
- Security best practices
- Cost optimization where applicable
- Data sources for existing resources
- Locals for computed values

Respond with each file as a separate code block:
\`\`\`hcl
# main.tf
...
\`\`\``;

  const responseText = await callLLM({
    model: DEFAULT_MODEL,
    max_tokens: 8192,
    system: INFRA_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract HCL blocks
  const extractFile = (filename: string): string => {
    const pattern = new RegExp(`# ${filename}[\\s\\S]*?\`\`\`hcl\\n?([\\s\\S]*?)\\n?\`\`\``, 'i');
    const match = responseText.match(pattern);
    return match ? match[1].trim() : '';
  };

  return {
    mainTf: extractFile('main.tf') || responseText,
    variablesTf: extractFile('variables.tf'),
    outputsTf: extractFile('outputs.tf'),
    providersTf: extractFile('providers.tf'),
  };
}

/**
 * Generate Docker configuration
 */
export async function generateDocker(
  request: DockerGenerationRequest
): Promise<DockerGenerationResult> {
  const {
    projectType,
    projectName,
    baseImage,
    port = 3000,
    buildCommand,
    startCommand,
    multiStage = true,
    includeCompose = true,
    services,
  } = request;

  const baseImages: Record<string, string> = {
    node: 'node:20-alpine',
    python: 'python:3.11-slim',
    go: 'golang:1.21-alpine',
    java: 'eclipse-temurin:17-jdk-alpine',
    rust: 'rust:1.74-alpine',
    custom: baseImage || 'alpine:latest',
  };

  const prompt = `Generate Docker configuration for a ${projectType} application:

Project: ${projectName}
Base Image: ${baseImages[projectType]}
Port: ${port}
Multi-stage: ${multiStage}
${buildCommand ? `Build Command: ${buildCommand}` : ''}
${startCommand ? `Start Command: ${startCommand}` : ''}

Generate:

1. **Dockerfile** - Production-ready, multi-stage (if applicable)
   - Use specific version tags, not :latest
   - Non-root user
   - Proper layer caching
   - Health check
   - Security best practices

2. **.dockerignore** - Exclude unnecessary files

${
  includeCompose
    ? `3. **docker-compose.yml** - Development setup
${services ? `Services: ${services.map((s) => s.name).join(', ')}` : 'Include main application service'}`
    : ''
}

Respond with each file as a separate code block:
\`\`\`dockerfile
# Dockerfile
...
\`\`\`

\`\`\`
# .dockerignore
...
\`\`\`

${
  includeCompose
    ? `\`\`\`yaml
# docker-compose.yml
...
\`\`\``
    : ''
}`;

  const responseText = await callLLM({
    model: DEFAULT_MODEL,
    max_tokens: 4096,
    system: INFRA_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract files
  const dockerfileMatch = responseText.match(/```dockerfile\n?([\s\S]*?)\n?```/i);
  const dockerignoreMatch = responseText.match(/# \.dockerignore[\s\S]*?```\n?([\s\S]*?)\n?```/);
  const composeMatch = responseText.match(
    /# docker-compose\.yml[\s\S]*?```yaml\n?([\s\S]*?)\n?```/i
  );

  return {
    dockerfile: dockerfileMatch ? dockerfileMatch[1].trim() : '',
    dockerignore: dockerignoreMatch
      ? dockerignoreMatch[1].trim()
      : 'node_modules\n.git\n*.log\n.env*\ndist\ncoverage',
    composeFile: composeMatch ? composeMatch[1].trim() : undefined,
  };
}

/**
 * Generate CI/CD pipeline
 */
export async function generateCICD(request: CICDGenerationRequest): Promise<CICDGenerationResult> {
  const {
    platform,
    projectType,
    stages,
    deployTarget,
    branches = { main: 'main', develop: 'develop' },
  } = request;

  const platformConfigs: Record<string, { filename: string; format: string }> = {
    'github-actions': {
      filename: '.github/workflows/ci.yml',
      format: 'yaml',
    },
    'gitlab-ci': { filename: '.gitlab-ci.yml', format: 'yaml' },
    jenkins: { filename: 'Jenkinsfile', format: 'groovy' },
    circleci: { filename: '.circleci/config.yml', format: 'yaml' },
  };

  const config = platformConfigs[platform];

  const prompt = `Generate a ${platform} CI/CD pipeline for a ${projectType} project:

Stages: ${stages.join(', ')}
Main branch: ${branches.main}
Develop branch: ${branches.develop}
${deployTarget ? `Deploy target: ${deployTarget}` : ''}

Requirements:
- Run on push to main and develop branches
- Run on pull requests
- Cache dependencies for faster builds
- Parallel jobs where possible
- ${stages.includes('security-scan') ? 'Include security scanning' : ''}
- ${stages.includes('deploy') ? `Deploy to ${deployTarget} on main branch` : ''}

Generate a complete, production-ready pipeline configuration.

Respond with:
\`\`\`${config.format}
# ${config.filename}
...
\`\`\``;

  const responseText = await callLLM({
    model: DEFAULT_MODEL,
    max_tokens: 4096,
    system: INFRA_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract pipeline file
  const pattern = new RegExp(`\`\`\`${config.format}\\n?([\\s\\S]*?)\\n?\`\`\``, 'i');
  const match = responseText.match(pattern);

  return {
    workflowFile: match ? match[1].trim() : responseText,
    filename: config.filename,
  };
}
