//! Visualization Engine - Generate graphs and dashboards for verdict analytics
//! Supports D3.js, chart.js, and custom SVG rendering

export interface ChartData {
  labels: string[];
  datasets: Dataset[];
}

export interface Dataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string;
  fill?: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'founder' | 'mentor' | 'investor' | 'peer';
  influence: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
  strength: number;
}

// ============================================================================
// Accuracy Trends Visualization
// ============================================================================

export function generateAccuracyTrendChart(
  verdictTypes: string[],
  accuracyRates: number[]
): ChartData {
  return {
    labels: verdictTypes,
    datasets: [
      {
        label: 'Verdict Accuracy %',
        data: accuracyRates,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        fill: true,
      },
    ],
  };
}

// ============================================================================
// Success Probability Distribution
// ============================================================================

export function generateSuccessProbabilityChart(
  verdictTypes: string[],
  successRates: number[]
): ChartData {
  const colors = {
    BuildNow: '#10b981',
    BuildButPivot: '#f59e0b',
    Skip: '#ef4444',
    ThinkHarder: '#3b82f6',
  };

  return {
    labels: verdictTypes,
    datasets: [
      {
        label: 'Success Probability %',
        data: successRates,
        backgroundColor: verdictTypes.map((v) => colors[v as keyof typeof colors] || '#6b7280'),
      },
    ],
  };
}

// ============================================================================
// Verdict Distribution Pie Chart
// ============================================================================

export function generateVerdictDistribution(verdictCounts: Record<string, number>): ChartData {
  const colors = {
    BuildNow: '#10b981',
    BuildButPivot: '#f59e0b',
    Skip: '#ef4444',
    ThinkHarder: '#3b82f6',
  };

  return {
    labels: Object.keys(verdictCounts),
    datasets: [
      {
        label: 'Verdict Distribution',
        data: Object.values(verdictCounts),
        backgroundColor: Object.keys(verdictCounts).map(
          (v) => colors[v as keyof typeof colors] || '#6b7280'
        ),
      },
    ],
  };
}

// ============================================================================
// Network Visualization
// ============================================================================

export interface NetworkGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

export function generateNetworkGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number = 800,
  height: number = 600
): NetworkGraph {
  return {
    nodes,
    edges,
    width,
    height,
  };
}

export function generateNetworkSVG(graph: NetworkGraph): string {
  // Generate SVG string for network visualization
  let svg = `<svg width="${graph.width}" height="${graph.height}" xmlns="http://www.w3.org/2000/svg">`;

  // Draw edges first (so they're behind nodes)
  for (const edge of graph.edges) {
    const sourceNode = graph.nodes.find((n) => n.id === edge.source);
    const targetNode = graph.nodes.find((n) => n.id === edge.target);

    if (sourceNode && targetNode) {
      // Simple circle packing layout
      const sourceX = 100 + sourceNode.influence * 200;
      const sourceY = 100 + sourceNode.influence * 150;
      const targetX = 400 + targetNode.influence * 200;
      const targetY = 400 + targetNode.influence * 150;

      svg += `<line x1="${sourceX}" y1="${sourceY}" x2="${targetX}" y2="${targetY}" stroke="#d1d5db" stroke-width="${Math.max(1, edge.strength * 3)}" opacity="${edge.strength}" />`;
    }
  }

  // Draw nodes
  const nodeTypeColors: Record<string, string> = {
    founder: '#10b981',
    mentor: '#3b82f6',
    investor: '#f59e0b',
    peer: '#8b5cf6',
  };

  for (const node of graph.nodes) {
    const x = 100 + node.influence * 200;
    const y = 100 + node.influence * 150;
    const radius = 10 + node.influence * 15;
    const color = nodeTypeColors[node.type] || '#6b7280';

    svg += `<circle cx="${x}" cy="${y}" r="${radius}" fill="${color}" opacity="0.8" />`;
    svg += `<text x="${x}" y="${y + radius + 15}" text-anchor="middle" font-size="12" fill="#1f2937">${node.label}</text>`;
  }

  svg += '</svg>';
  return svg;
}

// ============================================================================
// Time Series Analysis
// ============================================================================

export interface TimeSeriesPoint {
  date: string;
  value: number;
  label: string;
}

export function generateTimeSeriesChart(dataPoints: TimeSeriesPoint[]): ChartData {
  return {
    labels: dataPoints.map((p) => p.date),
    datasets: [
      {
        label: 'Model Accuracy Over Time',
        data: dataPoints.map((p) => p.value),
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        fill: true,
      },
    ],
  };
}

// ============================================================================
// Founder Cohort Analysis
// ============================================================================

export interface CohortMetrics {
  verdict: string;
  cohortSize: number;
  pmfRate: number;
  fundingRate: number;
  shutdownRate: number;
}

export function generateCohortComparisonChart(cohorts: CohortMetrics[]): ChartData {
  return {
    labels: cohorts.map((c) => `${c.verdict} (n=${c.cohortSize})`),
    datasets: [
      {
        label: 'Product-Market Fit %',
        data: cohorts.map((c) => c.pmfRate * 100),
        backgroundColor: '#10b981',
      },
      {
        label: 'Raised Funding %',
        data: cohorts.map((c) => c.fundingRate * 100),
        backgroundColor: '#f59e0b',
      },
      {
        label: 'Shutdown %',
        data: cohorts.map((c) => c.shutdownRate * 100),
        backgroundColor: '#ef4444',
      },
    ],
  };
}

// ============================================================================
// ML Model Performance Dashboard
// ============================================================================

export interface ModelPerformance {
  modelVersion: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainingDate: string;
}

export function generateModelPerformanceChart(models: ModelPerformance[]): ChartData {
  return {
    labels: models.map((m) => `v${m.modelVersion}`),
    datasets: [
      {
        label: 'Accuracy',
        data: models.map((m) => m.accuracy * 100),
        borderColor: '#667eea',
      },
      {
        label: 'Precision',
        data: models.map((m) => m.precision * 100),
        borderColor: '#10b981',
      },
      {
        label: 'Recall',
        data: models.map((m) => m.recall * 100),
        borderColor: '#f59e0b',
      },
      {
        label: 'F1 Score',
        data: models.map((m) => m.f1Score * 100),
        borderColor: '#8b5cf6',
      },
    ],
  };
}

// ============================================================================
// Feature Importance Visualization
// ============================================================================

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export function generateFeatureImportanceChart(features: FeatureImportance[]): ChartData {
  // Sort by importance descending
  const sorted = [...features].sort((a, b) => b.importance - a.importance);

  return {
    labels: sorted.map((f) => f.feature),
    datasets: [
      {
        label: 'Feature Importance Score',
        data: sorted.map((f) => f.importance),
        backgroundColor: '#667eea',
      },
    ],
  };
}

// ============================================================================
// Market Opportunity Heatmap
// ============================================================================

export interface MarketHeatmapPoint {
  market: string;
  tam: number;
  growth: number;
  saturation: number;
}

export function generateMarketHeatmap(markets: MarketHeatmapPoint[]): ChartData {
  return {
    labels: markets.map((m) => m.market),
    datasets: [
      {
        label: 'TAM ($B)',
        data: markets.map((m) => m.tam),
        backgroundColor: '#10b981',
      },
      {
        label: 'Growth Rate %',
        data: markets.map((m) => m.growth * 100),
        backgroundColor: '#3b82f6',
      },
      {
        label: 'Saturation (0-1)',
        data: markets.map((m) => m.saturation * 100),
        backgroundColor: '#ef4444',
      },
    ],
  };
}

// ============================================================================
// Dashboard Layout
// ============================================================================

export interface DashboardSection {
  title: string;
  description: string;
  chartType: 'line' | 'bar' | 'pie' | 'network';
  data: ChartData | NetworkGraph;
  span: number; // grid span
}

export function generateDashboardLayout(metrics: {
  accuracy: number[];
  verdictDistribution: Record<string, number>;
  modelPerformance: ModelPerformance[];
  networkNodes: GraphNode[];
  networkEdges: GraphEdge[];
}): DashboardSection[] {
  return [
    {
      title: 'Verdict Accuracy Trends',
      description: 'Historical accuracy by verdict type',
      chartType: 'line',
      data: generateAccuracyTrendChart(
        ['BuildNow', 'BuildButPivot', 'Skip', 'ThinkHarder'],
        metrics.accuracy
      ),
      span: 2,
    },
    {
      title: 'Verdict Distribution',
      description: 'Breakdown of verdicts issued',
      chartType: 'pie',
      data: generateVerdictDistribution(metrics.verdictDistribution),
      span: 1,
    },
    {
      title: 'Model Performance',
      description: 'ML model metrics over versions',
      chartType: 'line',
      data: generateModelPerformanceChart(metrics.modelPerformance),
      span: 2,
    },
    {
      title: 'Founder Network',
      description: 'Network relationships and influence',
      chartType: 'network',
      data: generateNetworkGraph(metrics.networkNodes, metrics.networkEdges),
      span: 2,
    },
  ];
}

// ============================================================================
// CSV Export
// ============================================================================

export function exportChartDataAsCSV(data: ChartData, _filename: string): string {
  let csv = 'Label,' + data.datasets.map((d) => d.label).join(',') + '\n';

  for (let i = 0; i < data.labels.length; i++) {
    csv += data.labels[i];
    for (const dataset of data.datasets) {
      csv += ',' + dataset.data[i];
    }
    csv += '\n';
  }

  return csv;
}
