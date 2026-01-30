<script lang="ts">
  /**
   * KimiModelSelector - Enhanced model selection with Kimi K2.5 focus
   * 
   * Features:
   * - Visual highlighting of Kimi K2.5 as primary
   * - Cost comparison display
   * - Context window visualization
   * - Language support indicators
   * - Smart recommendations
   */
  import { Badge, Card, Button } from '../lib/design-system';
  import { colors } from '../lib/design-system/tokens/colors';
  import { showToast } from '../stores/toastStore';
  
  interface ModelOption {
    id: string;
    provider: string;
    name: string;
    description: string;
    contextWindow: number;
    inputPrice: number;
    outputPrice: number;
    capabilities: string[];
    languages: string[];
    recommended?: boolean;
    isPrimary?: boolean;
  }
  
  interface Props {
    selectedModel: string;
    onSelect: (modelId: string) => void;
    showCostComparison?: boolean;
    taskType?: 'coding' | 'chat' | 'analysis' | 'creative' | 'vision';
  }
  
  let { 
    selectedModel, 
    onSelect, 
    showCostComparison = true,
    taskType = 'coding'
  }: Props = $props();
  
  const models: ModelOption[] = [
    {
      id: 'moonshotai/kimi-k2.5',
      provider: 'nim',
      name: 'Kimi K2.5',
      description: 'Primary model - Best multilingual support, 256K context, cost-effective',
      contextWindow: 256000,
      inputPrice: 0.6,
      outputPrice: 0.6,
      capabilities: ['code', 'vision', 'multilingual', 'long-context'],
      languages: ['中文', '日本語', '한국어', 'English', 'Español', 'Français', 'Deutsch', 'Русский', 'العربية', 'हिन्दी'],
      recommended: true,
      isPrimary: true,
    },
    {
      id: 'openrouter/google/gemini-2.5-pro',
      provider: 'openrouter',
      name: 'Gemini 2.5 Pro',
      description: 'Massive 1M context window for extremely large documents',
      contextWindow: 1000000,
      inputPrice: 3.5,
      outputPrice: 10.5,
      capabilities: ['long-context', 'multilingual', 'vision'],
      languages: ['English', '中文', '日本語', 'Español', 'Français'],
    },
    {
      id: 'glm-4',
      provider: 'zhipu',
      name: 'GLM-4',
      description: 'Strong Chinese language capabilities via Zhipu',
      contextWindow: 128000,
      inputPrice: 0.0,
      outputPrice: 0.0,
      capabilities: ['multilingual', 'code'],
      languages: ['中文', 'English', '日本語', 'Español'],
    },
    {
      id: 'copilot-codex',
      provider: 'copilot',
      name: 'Copilot Codex',
      description: 'GitHub Copilot integration for coding tasks',
      contextWindow: 32000,
      inputPrice: 0.0,
      outputPrice: 0.0,
      capabilities: ['code'],
      languages: ['English'],
    },
    {
      id: 'local/llama-3.1-70b',
      provider: 'local',
      name: 'Llama 3.1 70B (Local)',
      description: 'Self-hosted model for privacy-sensitive applications',
      contextWindow: 128000,
      inputPrice: 0.0,
      outputPrice: 0.0,
      capabilities: ['code', 'agent'],
      languages: ['English', 'Deutsch', 'Français', 'Español', 'Italiano'],
    },
  ];
  
  function formatContextWindow(tokens: number): string {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
    return tokens.toString();
  }
  
  function formatPrice(price: number): string {
    if (price === 0) return 'Free';
    return `$${price.toFixed(2)}/M`;
  }
  
  function getRecommendationReason(model: ModelOption): string {
    if (model.isPrimary) return 'Recommended for all tasks';
    if (model.contextWindow >= 500000) return 'Best for very long documents';
    if (model.languages.includes('中文') && model.provider === 'zhipu') return 'Optimized for Chinese';
    if (model.provider === 'copilot') return 'Best for GitHub integration';
    if (model.provider === 'local') return 'Privacy-focused option';
    return 'Alternative option';
  }
  
  function calculateSavings(vsModel: ModelOption): { percent: number; amount: string } {
    const kimi = models.find(m => m.isPrimary)!;
    const kimiCost = (kimi.inputPrice + kimi.outputPrice) / 2;
    const vsCost = (vsModel.inputPrice + vsModel.outputPrice) / 2;
    
    if (vsCost === 0) return { percent: 0, amount: 'N/A' };
    
    const savings = ((vsCost - kimiCost) / vsCost) * 100;
    return {
      percent: Math.round(savings),
      amount: `$${(vsCost - kimiCost).toFixed(2)}/M`,
    };
  }
</script>

<div class="kimi-model-selector">
  <div class="selector-header">
    <h3>Select AI Model</h3>
    <p class="subtitle">Kimi K2.5 is recommended for best performance and value</p>
  </div>
  
  <div class="models-grid">
    {#each models as model}
      <Card 
        class="model-card {selectedModel === model.id ? 'selected' : ''} {model.isPrimary ? 'primary' : ''}"
        onclick={() => onSelect(model.id)}
      >
        <div class="model-header">
          <div class="model-info">
            <h4 class="model-name">
              {model.name}
              {#if model.isPrimary}
                <Badge variant="primary" size="sm">Primary</Badge>
              {/if}
              {#if model.recommended && !model.isPrimary}
                <Badge variant="success" size="sm">Recommended</Badge>
              {/if}
            </h4>
            <span class="provider">{model.provider}</span>
          </div>
          
          {#if selectedModel === model.id}
            <div class="selected-indicator">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          {/if}
        </div>
        
        <p class="description">{model.description}</p>
        
        <div class="capabilities">
          {#each model.capabilities as cap}
            <Badge variant="default" size="sm">{cap}</Badge>
          {/each}
        </div>
        
        <div class="specs">
          <div class="spec">
            <span class="spec-label">Context:</span>
            <span class="spec-value">{formatContextWindow(model.contextWindow)} tokens</span>
            {#if model.contextWindow > 256000}
              <Badge variant="info" size="sm">Extra Large</Badge>
            {/if}
          </div>
          
          <div class="spec">
            <span class="spec-label">Price:</span>
            <span class="spec-value">
              {formatPrice(model.inputPrice)} in / {formatPrice(model.outputPrice)} out
            </span>
          </div>
        </div>
        
        {#if showCostComparison && !model.isPrimary && model.inputPrice > 0}
          {@const savings = calculateSavings(model)}
          <div class="savings-badge">
            <Badge variant="success" size="sm">
              Save {savings.percent}% vs this model
            </Badge>
          </div>
        {/if}
        
        <div class="languages">
          <span class="languages-label">Languages:</span>
          <div class="language-badges">
            {#each model.languages.slice(0, 5) as lang}
              <span class="language-badge">{lang}</span>
            {/each}
            {#if model.languages.length > 5}
              <span class="language-badge more">+{model.languages.length - 5}</span>
            {/if}
          </div>
        </div>
        
        <div class="recommendation">
          <span class="recommendation-text">{getRecommendationReason(model)}</span>
        </div>
      </Card>
    {/each}
  </div>
  
  {#if showCostComparison}
    {@const modelsWithPrice = models.filter(m => m.inputPrice > 0)}
    {@const maxPrice = Math.max(...modelsWithPrice.map(m => (m.inputPrice + m.outputPrice) / 2))}
    <div class="cost-comparison">
      <h4>Cost Comparison (per 1M tokens)</h4>
      <div class="comparison-chart">
        {#each modelsWithPrice as model}
          {@const avgPrice = (model.inputPrice + model.outputPrice) / 2}
          {@const percentage = (avgPrice / maxPrice) * 100}
          <div class="comparison-bar">
            <span class="bar-label">{model.name}</span>
            <div class="bar-container">
              <div 
                class="bar-fill {model.isPrimary ? 'primary' : ''}" 
                style="width: {percentage}%"
              ></div>
              <span class="bar-value">${avgPrice.toFixed(2)}</span>
            </div>
          </div>
        {/each}
      </div>
      <p class="savings-summary">
        Kimi K2.5 saves up to 93% compared to other premium models
      </p>
    </div>
  {/if}
</div>

<style>
  .kimi-model-selector {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .selector-header h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .subtitle {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  .models-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
  }
  
  :global(.model-card) {
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;
  }
  
  :global(.model-card:hover) {
    border-color: var(--primary-color);
    transform: translateY(-2px);
  }
  
  :global(.model-card.selected) {
    border-color: var(--primary-color);
    background: var(--primary-color-light);
  }
  
  :global(.model-card.primary) {
    border-color: var(--success-color);
    background: linear-gradient(135deg, var(--success-color-light) 0%, transparent 100%);
  }
  
  .model-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }
  
  .model-name {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .provider {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .selected-indicator {
    color: var(--primary-color);
  }
  
  .description {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }
  
  .capabilities {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
  }
  
  .specs {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    padding: 0.5rem;
    background: var(--bg-secondary);
    border-radius: 0.375rem;
  }
  
  .spec {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }
  
  .spec-label {
    color: var(--text-secondary);
    font-weight: 500;
  }
  
  .spec-value {
    color: var(--text-primary);
    font-weight: 600;
  }
  
  .savings-badge {
    margin-bottom: 0.75rem;
  }
  
  .languages {
    margin-bottom: 0.75rem;
  }
  
  .languages-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    display: block;
    margin-bottom: 0.25rem;
  }
  
  .language-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  
  .language-badge {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    background: var(--bg-tertiary);
    border-radius: 0.25rem;
    color: var(--text-secondary);
  }
  
  .language-badge.more {
    background: var(--primary-color-light);
    color: var(--primary-color);
  }
  
  .recommendation {
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color);
  }
  
  .recommendation-text {
    font-size: 0.875rem;
    color: var(--success-color);
    font-weight: 500;
  }
  
  .cost-comparison {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 0.75rem;
    margin-top: 1rem;
  }
  
  .cost-comparison h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
  }
  
  .comparison-chart {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .comparison-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .bar-label {
    width: 120px;
    font-size: 0.875rem;
    flex-shrink: 0;
  }
  
  .bar-container {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 24px;
    background: var(--bg-tertiary);
    border-radius: 0.25rem;
    overflow: hidden;
  }
  
  .bar-fill {
    height: 100%;
    background: var(--text-secondary);
    border-radius: 0.25rem;
    transition: width 0.3s ease;
  }
  
  .bar-fill.primary {
    background: var(--success-color);
  }
  
  .bar-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    padding-right: 0.5rem;
  }
  
  .savings-summary {
    margin: 1rem 0 0 0;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
    font-size: 0.875rem;
    color: var(--success-color);
    font-weight: 500;
    text-align: center;
  }
</style>
