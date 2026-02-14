/**
 * Utility functions for the CloudDashboard component.
 * Extracted to keep the main component under ~500 lines.
 */

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function formatDuration(seconds?: number): string {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'ready':
    case 'running':
    case 'healthy':
      return 'text-green-500';
    case 'building':
    case 'pending':
    case 'queued':
      return 'text-yellow-500';
    case 'error':
    case 'warning':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}

export function getStatusBg(status: string): string {
  switch (status) {
    case 'ready':
    case 'running':
    case 'healthy':
      return 'bg-green-500/10 border-green-500/30';
    case 'building':
    case 'pending':
    case 'queued':
      return 'bg-yellow-500/10 border-yellow-500/30';
    case 'error':
    case 'warning':
      return 'bg-red-500/10 border-red-500/30';
    default:
      return 'bg-gray-500/10 border-gray-500/30';
  }
}

export function getProviderIcon(provider: string): string {
  switch (provider) {
    case 'vercel':
      return 'M12 2L2 20h20L12 2z';
    case 'netlify':
      return 'M12 2L2 12l10 10 10-10L12 2z';
    case 'aws':
      return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z';
    case 'gcp':
      return 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5';
    case 'azure':
      return 'M12 2L2 12l10 10 10-10L12 2z';
    default:
      return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z';
  }
}

export function getResourceIcon(type: string): string {
  switch (type) {
    case 'compute':
      return 'M4 6h16M4 10h16M4 14h16M4 18h16';
    case 'database':
      return 'M12 2C6.48 2 2 4.5 2 7.5v9C2 19.5 6.48 22 12 22s10-2.5 10-5.5v-9C22 4.5 17.52 2 12 2z';
    case 'storage':
      return 'M20 6H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z';
    case 'serverless':
      return 'M13 10V3L4 14h7v7l9-11h-7z';
    case 'container':
      return 'M21 8v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM7 12h2M11 12h2M15 12h2';
    default:
      return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z';
  }
}

// Re-export types used by CloudDashboard sub-components
export interface Integration {
  id: string;
  name: string;
  icon: string;
  category: 'deploy' | 'cloud' | 'baas' | 'vcs' | 'pm';
  connected: boolean;
  lastSync?: string;
  status?: 'healthy' | 'warning' | 'error';
}

export interface Deployment {
  id: string;
  project: string;
  provider: 'vercel' | 'netlify';
  status: 'ready' | 'building' | 'error' | 'queued';
  url?: string;
  branch: string;
  commit: string;
  createdAt: string;
  duration?: number;
}

export interface CloudResource {
  id: string;
  name: string;
  provider: 'aws' | 'gcp' | 'azure';
  type: 'compute' | 'database' | 'storage' | 'serverless' | 'container';
  status: 'running' | 'stopped' | 'pending' | 'error';
  region: string;
  cost?: number;
}

export interface CostSummary {
  provider: string;
  current: number;
  forecast: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}
