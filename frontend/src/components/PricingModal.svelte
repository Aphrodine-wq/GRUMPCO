<script lang="ts">
  import { Button } from '../lib/design-system';
  import { X, Check } from 'lucide-svelte';

  interface Props {
    onClose: () => void;
    onSelectPlan?: (planId: string) => void;
  }

  let { onClose, onSelectPlan }: Props = $props();

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: 'forever',
      features: [
        '50 API calls/month',
        'Basic architecture diagrams',
        'Community support',
        'Single project',
      ],
      recommended: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$29',
      period: 'per month',
      features: [
        '1,000 API calls/month',
        'Unlimited projects',
        'Priority support',
        'Advanced code generation',
        'Custom templates',
        'Team collaboration',
      ],
      recommended: true,
    },
    {
      id: 'team',
      name: 'Team',
      price: '$99',
      period: 'per month',
      features: [
        '5,000 API calls/month',
        'Everything in Pro',
        'Admin dashboard',
        'Team analytics',
        'SSO integration',
        'Dedicated support',
      ],
      recommended: false,
    },
  ];

  function handleSelectPlan(planId: string) {
    onSelectPlan?.(planId);
    onClose();
  }
</script>

<div
  class="modal-overlay"
  onclick={onClose}
  role="button"
  tabindex="0"
  onkeydown={(e) => e.key === 'Escape' && onClose()}
>
  <div
    class="modal-content"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onkeydown={(e) => e.stopPropagation()}
  >
    <button class="close-btn" onclick={onClose} aria-label="Close pricing modal">
      <X class="w-5 h-5" strokeWidth={2} />
    </button>

    <div class="modal-header">
      <h2>Choose Your Plan</h2>
      <p>Build faster with AI-powered development tools</p>
    </div>

    <div class="plans-grid">
      {#each plans as plan}
        <div class="plan-card" class:recommended={plan.recommended}>
          {#if plan.recommended}
            <div class="recommended-badge">Most Popular</div>
          {/if}

          <h3 class="plan-name">{plan.name}</h3>
          <div class="plan-price">
            <span class="price">{plan.price}</span>
            <span class="period">{plan.period}</span>
          </div>

          <ul class="features-list">
            {#each plan.features as feature}
              <li>
                <Check class="w-4 h-4 shrink-0" strokeWidth={2.5} />
                {feature}
              </li>
            {/each}
          </ul>

          <Button
            variant={plan.recommended ? 'primary' : 'secondary'}
            onclick={() => handleSelectPlan(plan.id)}
            class="select-btn"
          >
            {plan.id === 'free' ? 'Get Started' : 'Upgrade Now'}
          </Button>
        </div>
      {/each}
    </div>

    <div class="modal-footer">
      <p>All plans include a 14-day free trial. No credit card required.</p>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-content {
    background: white;
    border-radius: 24px;
    max-width: 1000px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    padding: 48px;
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .close-btn {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: #f4f4f5;
    color: #71717a;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: #e4e4e7;
    color: #18181b;
  }

  .modal-header {
    text-align: center;
    margin-bottom: 48px;
  }

  .modal-header h2 {
    font-size: 32px;
    font-weight: 800;
    color: #18181b;
    margin-bottom: 12px;
    letter-spacing: -0.02em;
  }

  .modal-header p {
    font-size: 16px;
    color: #71717a;
  }

  .plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
    margin-bottom: 32px;
  }

  .plan-card {
    background: white;
    border: 2px solid #e4e4e7;
    border-radius: 16px;
    padding: 32px 24px;
    display: flex;
    flex-direction: column;
    position: relative;
    transition: all 0.3s;
  }

  .plan-card:hover {
    border-color: #18181b;
    transform: translateY(-4px);
    box-shadow: 0 20px 40px -20px rgba(0, 0, 0, 0.15);
  }

  .plan-card.recommended {
    border-color: var(--color-primary);
    box-shadow: 0 10px 30px -10px rgba(14, 165, 233, 0.2);
  }

  .plan-card.recommended:hover {
    box-shadow: 0 20px 40px -20px rgba(14, 165, 233, 0.3);
  }

  .recommended-badge {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-primary);
    color: white;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 6px 16px;
    border-radius: 20px;
  }

  .plan-name {
    font-size: 20px;
    font-weight: 700;
    color: #18181b;
    margin-bottom: 12px;
  }

  .plan-price {
    margin-bottom: 24px;
  }

  .price {
    font-size: 40px;
    font-weight: 800;
    color: #18181b;
    letter-spacing: -0.02em;
  }

  .period {
    font-size: 14px;
    color: #71717a;
    margin-left: 4px;
  }

  .features-list {
    list-style: none;
    padding: 0;
    margin: 0 0 32px 0;
    flex: 1;
  }

  .features-list li {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: #3f3f46;
    margin-bottom: 12px;
    line-height: 1.5;
  }

  .features-list li :global(svg) {
    flex-shrink: 0;
    color: #10b981;
  }

  .plan-card.recommended .features-list li :global(svg) {
    color: var(--color-primary);
  }

  .modal-footer {
    text-align: center;
    padding-top: 24px;
    border-top: 1px solid #e4e4e7;
  }

  .modal-footer p {
    font-size: 14px;
    color: #71717a;
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .modal-content {
      padding: 32px 24px;
      border-radius: 16px;
    }

    .modal-header {
      margin-bottom: 32px;
    }

    .modal-header h2 {
      font-size: 24px;
    }

    .modal-header p {
      font-size: 14px;
    }

    .plans-grid {
      grid-template-columns: 1fr;
      gap: 20px;
    }

    .plan-card {
      padding: 24px 20px;
    }

    .price {
      font-size: 32px;
    }
  }
</style>
