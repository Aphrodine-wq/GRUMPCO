/**
 * Infrastructure Automation Feature - Type Definitions
 */

export interface K8sManifest {
  kind: string;
  apiVersion: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: Record<string, unknown>;
}

export interface K8sGenerationRequest {
  projectName: string;
  services: Array<{
    name: string;
    image: string;
    port: number;
    replicas?: number;
    resources?: {
      cpu: string;
      memory: string;
    };
    env?: Array<{ name: string; value?: string; secretRef?: string }>;
  }>;
  ingress?: {
    host: string;
    tls?: boolean;
  };
  namespace?: string;
  environment?: 'development' | 'staging' | 'production';
}

export interface K8sGenerationResult {
  namespace?: string;
  deployments: K8sManifest[];
  services: K8sManifest[];
  configMaps?: K8sManifest[];
  secrets?: K8sManifest[];
  ingress?: K8sManifest;
  hpa?: K8sManifest[];
  combined: string;
}

export interface TerraformResource {
  type: string;
  name: string;
  config: Record<string, unknown>;
}

export interface TerraformGenerationRequest {
  provider: 'aws' | 'gcp' | 'azure';
  projectName: string;
  resources: Array<{
    type: 'vpc' | 'subnet' | 'ec2' | 'rds' | 's3' | 'eks' | 'ecs' | 'lambda' |
          'api-gateway' | 'cloudfront' | 'elb' | 'security-group' | 'iam' | 'custom';
    name: string;
    config?: Record<string, unknown>;
  }>;
  region?: string;
  environment?: 'development' | 'staging' | 'production';
  tags?: Record<string, string>;
}

export interface TerraformGenerationResult {
  mainTf: string;
  variablesTf: string;
  outputsTf: string;
  providersTf: string;
  terraformTfvars?: string;
  modules?: Record<string, string>;
}

export interface DockerGenerationRequest {
  projectType: 'node' | 'python' | 'go' | 'java' | 'rust' | 'custom';
  projectName: string;
  baseImage?: string;
  port?: number;
  buildCommand?: string;
  startCommand?: string;
  multiStage?: boolean;
  includeCompose?: boolean;
  services?: Array<{
    name: string;
    image?: string;
    build?: string;
    ports?: string[];
    environment?: Record<string, string>;
    volumes?: string[];
    depends_on?: string[];
  }>;
}

export interface DockerGenerationResult {
  dockerfile: string;
  dockerignore: string;
  composeFile?: string;
}

export interface CICDGenerationRequest {
  platform: 'github-actions' | 'gitlab-ci' | 'jenkins' | 'circleci';
  projectType: 'node' | 'python' | 'go' | 'java' | 'rust';
  stages: Array<'lint' | 'test' | 'build' | 'deploy' | 'security-scan'>;
  deployTarget?: 'kubernetes' | 'ecs' | 'ec2' | 'lambda' | 'vercel' | 'netlify';
  branches?: {
    main?: string;
    develop?: string;
  };
}

export interface CICDGenerationResult {
  workflowFile: string;
  filename: string;
  additionalFiles?: Record<string, string>;
}
