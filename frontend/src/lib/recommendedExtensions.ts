/**
 * Recommended VS Code extensions for "Start dev work" / G-Rump users.
 * Open in Marketplace: https://marketplace.visualstudio.com/items?itemName=<publisher>.<name>
 */

export interface RecommendedExtension {
  name: string;
  id: string;
  publisher: string;
  description: string;
}

export const RECOMMENDED_EXTENSIONS: RecommendedExtension[] = [
  {
    name: 'ESLint',
    id: 'dbaeumer.vscode-eslint',
    publisher: 'Microsoft',
    description: 'Lint and fix JavaScript/TypeScript.',
  },
  {
    name: 'Prettier',
    id: 'esbenp.prettier-vscode',
    publisher: 'Prettier',
    description: 'Code formatter.',
  },
  {
    name: 'Docker',
    id: 'ms-azuretools.vscode-docker',
    publisher: 'Microsoft',
    description: 'Build and run Docker containers.',
  },
  {
    name: 'GitLens',
    id: 'eamodio.gitlens',
    publisher: 'GitKraken',
    description: 'Git blame, history, and insights.',
  },
  {
    name: 'Thunder Client',
    id: 'rangav.vscode-thunder-client',
    publisher: 'Ranga Vadhineni',
    description: 'Lightweight REST API client.',
  },
];

export function marketplaceUrl(ext: RecommendedExtension): string {
  return `https://marketplace.visualstudio.com/items?itemName=${encodeURIComponent(ext.id)}`;
}

export function vscodeUri(ext: RecommendedExtension): string {
  return `vscode://marketplace.${ext.publisher}.${ext.name.replace(/\s+/g, '')}`;
}
