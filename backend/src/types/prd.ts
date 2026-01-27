/**
 * PRD (Product Requirements Document) Types
 */

export interface Persona {
  id: string;
  name: string;
  role: string;
  description: string;
  goals: string[];
  painPoints: string[];
  successCriteria: string[];
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  priority: 'must' | 'should' | 'could' | 'wont';
  userStories: string[];
  acceptanceCriteria: string[];
  estimatedEffort?: string;
}

export interface UserStory {
  id: string;
  title: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: string[];
  relatedFeature?: string;
}

export interface APIEndpointSpec {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  authentication?: 'none' | 'bearer' | 'api_key';
  requestBody?: {
    type: string;
    required: boolean;
    example?: Record<string, any>;
  };
  responses: {
    status: number;
    description: string;
    example?: Record<string, any>;
  }[];
}

export interface NonFunctionalRequirement {
  id: string;
  category: 'performance' | 'security' | 'scalability' | 'reliability' | 'usability';
  requirement: string;
  metric?: string;
  targetValue?: string;
}

export interface SuccessMetric {
  id: string;
  name: string;
  description: string;
  targetValue: string;
  measurementMethod: string;
  reviewFrequency: string;
}

export interface PRD {
  id: string;
  projectName: string;
  projectDescription: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  sections: {
    overview: {
      vision: string;
      problem: string;
      solution: string;
      targetMarket: string;
    };
    personas: Persona[];
    features: Feature[];
    userStories: UserStory[];
    nonFunctionalRequirements: NonFunctionalRequirement[];
    apis: APIEndpointSpec[];
    dataModels: {
      name: string;
      fields: {
        name: string;
        type: string;
        required: boolean;
        description?: string;
      }[];
    }[];
    successMetrics: SuccessMetric[];
  };
}

export interface PRDRequest {
  architectureId: string;
  projectName: string;
  projectDescription: string;
  refinements?: string[];
}

export interface PRDResponse {
  id: string;
  status: 'generating' | 'complete' | 'error';
  prd?: PRD;
  error?: string;
  timestamp: string;
}
