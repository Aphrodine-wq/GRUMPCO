<script lang="ts">
  import { push } from 'svelte-spa-router'
  import { onMount } from 'svelte'
  
  // Credit packages
  const packages = [
    {
      id: 'starter',
      name: 'Starter',
      credits: 500,
      price: 9.99,
      description: 'Perfect for hobbyists and small projects',
      features: [
        { text: '~100 code generations', highlight: false },
        { text: 'All AI models included', highlight: false },
        { text: 'Standard support', highlight: false },
        { text: 'Email support', highlight: false },
      ],
      popular: false,
      savings: 0,
      cta: 'Get Started'
    },
    {
      id: 'pro',
      name: 'Pro',
      credits: 2500,
      price: 39.99,
      description: 'Best for professional developers',
      features: [
        { text: '~500 code generations', highlight: true },
        { text: 'All AI models included', highlight: false },
        { text: 'Priority support', highlight: true },
        { text: 'Advanced analytics', highlight: false },
        { text: 'API access', highlight: false },
      ],
      popular: true,
      savings: 20,
      cta: 'Buy Pro Pack'
    },
    {
      id: 'team',
      name: 'Team',
      credits: 10000,
      price: 129.99,
      description: 'For teams building at scale',
      features: [
        { text: '~2,000 code generations', highlight: true },
        { text: 'All AI models included', highlight: false },
        { text: '24/7 priority support', highlight: true },
        { text: 'Advanced analytics', highlight: false },
        { text: 'API access', highlight: false },
        { text: 'Team collaboration', highlight: true },
        { text: 'Custom integrations', highlight: false },
      ],
      popular: false,
      savings: 35,
      cta: 'Buy Team Pack'
    }
  ]
  
  // Comparison features
  const comparisonFeatures = [
    { name: 'Code generations', starter: '~100', pro: '~500', team: '~2,000' },
    { name: 'AI Models', starter: 'All', pro: 'All', team: 'All' },
    { name: 'Context window', starter: '128K tokens', pro: '128K tokens', team: '200K tokens' },
    { name: 'Support', starter: 'Email', pro: 'Priority', team: '24/7 Priority' },
    { name: 'Analytics', starter: 'Basic', pro: 'Advanced', team: 'Advanced' },
    { name: 'API Access', starter: '—', pro: '✓', team: '✓' },
    { name: 'Team seats', starter: '1', pro: '1', team: 'Unlimited' },
    { name: 'Custom integrations', starter: '—', pro: '—', team: '✓' },
    { name: 'SLA guarantee', starter: '—', pro: '—', team: '99.9%' },
  ]
  
  // FAQs
  const faqs = [
    {
      question: 'What are credits and how do they work?',
      answer: 'Credits are our usage-based currency. Each AI action (code generation, architecture design, bug fix, etc.) costs a specific number of credits. Simple code generations start at 5 credits, while complex multi-agent tasks can use up to 75 credits. Credits never expire.'
    },
    {
      question: 'Can I buy more credits after I run out?',
      answer: 'Absolutely! You can purchase additional credit packs anytime. We also offer auto-top up, which automatically purchases credits when your balance drops below a threshold you set.'
    },
    {
      question: 'Do credits expire?',
      answer: 'No, credits never expire. Once purchased, they remain in your account until used. You can also enable auto-top up to ensure you never run out during critical work.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards (Visa, Mastercard, American Express), PayPal, and bank transfers for Team plans. All payments are securely processed through Stripe.'
    },
    {
      question: 'Can I switch between packages?',
      answer: 'Yes! You can purchase any package at any time. Credits stack, so buying a Pro pack when you have Starter credits remaining will simply add to your balance.'
    },
    {
      question: 'Is there a refund policy?',
      answer: 'If you\'re not satisfied, contact us within 14 days of purchase for unused credits. We\'ll refund the remaining balance pro-rata. Credits that have been used are non-refundable.'
    },
    {
      question: 'What\'s included in Team collaboration?',
      answer: 'Team plans include shared workspaces, collaborative editing, team analytics dashboard, centralized billing, role-based access control, and the ability to share credit pools across your organization.'
    }
  ]
  
  let openFaq = $state<number | null>(null)
  
  function toggleFaq(index: number) {
    openFaq = openFaq === index ? null : index
  }
  
  function handleCtaClick(pkgId: string) {
    // Track analytics event
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'pricing_cta_click', {
        package_id: pkgId,
        event_category: 'conversion',
        event_label: pkgId
      })
    }
    push('/billing')
  }
  
  onMount(() => {
    // Track page view
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'page_view', {
        page_title: 'Pricing - G-Rump',
        page_location: window.location.href
      })
    }
  })
</script>

<div class="pricing-page" role="main" aria-label="Pricing page">
  <!-- Hero Section -->
  <section class="hero-section" aria-labelledby="pricing-heading">
    <div class="hero-content">
      <div class="badge-container">
        <span class="hero-badge">
          <svg class="badge-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
          </svg>
          Simple, usage-based pricing
        </span>
      </div>
      <h1 id="pricing-heading" class="hero-title">
        Pay only for what you use
      </h1>
      <p class="hero-subtitle">
        No subscriptions, no hidden fees. Buy credits once, use them forever. Perfect for developers who want flexibility.
      </p>
      
      <!-- Trust badges -->
      <div class="trust-badges">
        <div class="trust-item">
          <svg class="trust-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
          <span>Secure payments</span>
        </div>
        <div class="trust-item">
          <svg class="trust-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>Credits never expire</span>
        </div>
        <div class="trust-item">
          <svg class="trust-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          <span>14-day refund</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Pricing Cards -->
  <section class="pricing-section" aria-labelledby="packages-heading">
    <h2 id="packages-heading" class="section-title sr-only">Credit Packages</h2>
    <div class="pricing-grid">
      {#each packages as pkg}
        <div 
          class="pricing-card {pkg.popular ? 'popular' : ''}"
          role="article"
          aria-label="{pkg.name} package"
        >
          {#if pkg.popular}
            <div class="popular-badge">
              <span>Most Popular</span>
            </div>
          {/if}
          
          <div class="card-header">
            <h3 class="package-name">{pkg.name}</h3>
            <p class="package-description">{pkg.description}</p>
          </div>
          
          <div class="price-section">
            <div class="price">
              <span class="currency">$</span>
              <span class="amount">{pkg.price}</span>
            </div>
            <div class="credits-info">
              <span class="credits-amount">{pkg.credits.toLocaleString()}</span>
              <span class="credits-label">credits</span>
            </div>
            {#if pkg.savings > 0}
              <div class="savings-badge">
                Save {pkg.savings}%
              </div>
            {/if}
          </div>
          
          <div class="features-section">
            <ul class="features-list" role="list">
              {#each pkg.features as feature}
                <li class="feature-item {feature.highlight ? 'highlight' : ''}">
                  <svg class="feature-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                  </svg>
                  <span>{feature.text}</span>
                </li>
              {/each}
            </ul>
          </div>
          
          <div class="cta-section">
            <button 
              class="cta-button {pkg.popular ? 'primary' : 'secondary'}"
              onclick={() => handleCtaClick(pkg.id)}
              aria-label="Purchase {pkg.name} package for ${pkg.price}"
            >
              {pkg.cta}
            </button>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- Comparison Table -->
  <section class="comparison-section" aria-labelledby="comparison-heading">
    <div class="section-header">
      <h2 id="comparison-heading" class="section-title">Compare plans</h2>
      <p class="section-subtitle">Find the perfect package for your needs</p>
    </div>
    
    <div class="comparison-container">
      <div class="comparison-table-wrapper">
        <table class="comparison-table" role="table" aria-label="Feature comparison">
          <thead>
            <tr>
              <th scope="col" class="feature-header">Features</th>
              <th scope="col" class="plan-header starter">
                <div class="plan-name">Starter</div>
                <div class="plan-price">$9.99</div>
              </th>
              <th scope="col" class="plan-header pro popular">
                <div class="popular-tag">Popular</div>
                <div class="plan-name">Pro</div>
                <div class="plan-price">$39.99</div>
              </th>
              <th scope="col" class="plan-header team">
                <div class="plan-name">Team</div>
                <div class="plan-price">$129.99</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {#each comparisonFeatures as feature, i}
              <tr class={i % 2 === 0 ? 'even' : 'odd'}>
                <td class="feature-cell">{feature.name}</td>
                <td class="value-cell starter">{feature.starter}</td>
                <td class="value-cell pro">{feature.pro}</td>
                <td class="value-cell team">{feature.team}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- FAQ Section -->
  <section class="faq-section" aria-labelledby="faq-heading">
    <div class="section-header">
      <h2 id="faq-heading" class="section-title">Frequently asked questions</h2>
      <p class="section-subtitle">Everything you need to know about our pricing</p>
    </div>
    
    <div class="faq-grid">
      {#each faqs as faq, index}
        <div class="faq-item">
          <button 
            class="faq-question"
            onclick={() => toggleFaq(index)}
            aria-expanded={openFaq === index}
            aria-controls="faq-answer-{index}"
          >
            <span>{faq.question}</span>
            <svg 
              class="faq-icon {openFaq === index ? 'open' : ''}" 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
          <div 
            id="faq-answer-{index}"
            class="faq-answer {openFaq === index ? 'open' : ''}"
            role="region"
          >
            <p>{faq.answer}</p>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- CTA Section -->
  <section class="cta-section-bottom" aria-labelledby="cta-heading">
    <div class="cta-container">
      <div class="cta-content">
        <h2 id="cta-heading" class="cta-title">Ready to start building?</h2>
        <p class="cta-subtitle">Join thousands of developers using G-Rump to ship faster.</p>
        <div class="cta-buttons">
          <button 
            class="cta-button-main"
            onclick={() => handleCtaClick('pro')}
          >
            Get Started
            <svg class="cta-arrow" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
          <a href="/#/workspace" class="cta-button-secondary">Try it free</a>
        </div>
        <p class="cta-note">No credit card required for free tier. Credits purchased are yours forever.</p>
      </div>
    </div>
  </section>
</div>

<style>
  .pricing-page {
    min-height: 100vh;
    background: 
      radial-gradient(1200px 600px at 0% 0%, rgba(139, 92, 246, 0.06) 0%, transparent 60%),
      radial-gradient(1000px 500px at 100% 0%, rgba(124, 58, 237, 0.04) 0%, transparent 60%),
      radial-gradient(800px 400px at 50% 100%, rgba(167, 139, 250, 0.03) 0%, transparent 60%),
      linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
    background-attachment: fixed;
  }

  /* Hero Section */
  .hero-section {
    padding: 4rem 1.5rem 3rem;
    text-align: center;
  }

  .hero-content {
    max-width: 800px;
    margin: 0 auto;
  }

  .badge-container {
    margin-bottom: 1.5rem;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #7c3aed;
  }

  .badge-icon {
    width: 1rem;
    height: 1rem;
  }

  .hero-title {
    font-size: 3rem;
    font-weight: 700;
    color: #111827;
    line-height: 1.1;
    margin-bottom: 1rem;
    letter-spacing: -0.02em;
  }

  .hero-subtitle {
    font-size: 1.25rem;
    color: #6b7280;
    line-height: 1.6;
    max-width: 600px;
    margin: 0 auto 2rem;
  }

  .trust-badges {
    display: flex;
    justify-content: center;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .trust-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .trust-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #10b981;
  }

  /* Pricing Section */
  .pricing-section {
    padding: 3rem 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.5rem;
    align-items: stretch;
  }

  .pricing-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 1rem;
    padding: 2rem;
    position: relative;
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  }

  .pricing-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.1);
  }

  .pricing-card.popular {
    border: 2px solid #8b5cf6;
    box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1), 0 20px 40px -10px rgba(139, 92, 246, 0.15);
  }

  .popular-badge {
    position: absolute;
    top: -1px;
    left: 50%;
    transform: translateX(-50%);
  }

  .popular-badge span {
    display: block;
    padding: 0.375rem 1rem;
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 0 0 0.5rem 0.5rem;
    white-space: nowrap;
  }

  .card-header {
    margin-bottom: 1.5rem;
    padding-top: 0.5rem;
  }

  .package-name {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 0.5rem;
  }

  .package-description {
    font-size: 0.9375rem;
    color: #6b7280;
    line-height: 1.5;
  }

  .price-section {
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .price {
    display: flex;
    align-items: flex-start;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .currency {
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
    margin-top: 0.25rem;
  }

  .amount {
    font-size: 3.5rem;
    font-weight: 700;
    color: #111827;
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .credits-info {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
    margin-bottom: 0.75rem;
  }

  .credits-amount {
    font-size: 1.25rem;
    font-weight: 600;
    color: #7c3aed;
  }

  .credits-label {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .savings-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    background: #d1fae5;
    color: #047857;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 9999px;
  }

  .features-section {
    flex: 1;
    margin-bottom: 1.5rem;
  }

  .features-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.9375rem;
    color: #4b5563;
  }

  .feature-item.highlight {
    color: #7c3aed;
    font-weight: 500;
  }

  .feature-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #10b981;
    flex-shrink: 0;
  }

  .cta-section {
    margin-top: auto;
  }

  .cta-button {
    width: 100%;
    padding: 0.875rem 1.5rem;
    border-radius: 0.75rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
  }

  .cta-button.primary {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    color: white;
    box-shadow: 0 4px 6px -1px rgba(139, 92, 246, 0.2);
  }

  .cta-button.primary:hover {
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    transform: translateY(-1px);
    box-shadow: 0 6px 12px -2px rgba(139, 92, 246, 0.3);
  }

  .cta-button.secondary {
    background: #f3f4f6;
    color: #111827;
    border: 1px solid #e5e7eb;
  }

  .cta-button.secondary:hover {
    background: #e5e7eb;
    border-color: #d1d5db;
  }

  /* Comparison Section */
  .comparison-section {
    padding: 4rem 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .section-header {
    text-align: center;
    margin-bottom: 3rem;
  }

  .section-title {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 0.75rem;
    letter-spacing: -0.01em;
  }

  .section-subtitle {
    font-size: 1.125rem;
    color: #6b7280;
  }

  .comparison-container {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 1rem;
    overflow: hidden;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  }

  .comparison-table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .comparison-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 600px;
  }

  .comparison-table th,
  .comparison-table td {
    padding: 1rem 1.5rem;
    text-align: left;
  }

  .comparison-table thead th {
    background: #f9fafb;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
  }

  .comparison-table tbody tr.even {
    background: #fafafa;
  }

  .comparison-table tbody tr:hover {
    background: #f3f4f6;
  }

  .feature-header {
    width: 40%;
  }

  .plan-header {
    width: 20%;
    text-align: center !important;
    position: relative;
  }

  .plan-header.popular {
    background: linear-gradient(180deg, rgba(139, 92, 246, 0.05) 0%, rgba(139, 92, 246, 0.02) 100%);
  }

  .popular-tag {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.25rem 0.75rem;
    background: #8b5cf6;
    color: white;
    font-size: 0.625rem;
    font-weight: 600;
    border-radius: 0 0 0.375rem 0.375rem;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .plan-name {
    font-size: 1rem;
    color: #111827;
    margin-bottom: 0.25rem;
    margin-top: 0.5rem;
  }

  .plan-price {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .feature-cell {
    font-weight: 500;
    color: #374151;
  }

  .value-cell {
    text-align: center !important;
    color: #4b5563;
    font-weight: 500;
  }

  .value-cell.pro {
    color: #7c3aed;
    font-weight: 600;
    background: rgba(139, 92, 246, 0.03);
  }

  /* FAQ Section */
  .faq-section {
    padding: 4rem 1.5rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .faq-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .faq-item {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .faq-item:hover {
    border-color: #d1d5db;
  }

  .faq-question {
    width: 100%;
    padding: 1.25rem;
    background: none;
    border: none;
    text-align: left;
    font-size: 1rem;
    font-weight: 500;
    color: #111827;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    transition: all 0.2s ease;
  }

  .faq-question:hover {
    color: #7c3aed;
  }

  .faq-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #6b7280;
    flex-shrink: 0;
    transition: transform 0.2s ease;
  }

  .faq-icon.open {
    transform: rotate(180deg);
    color: #7c3aed;
  }

  .faq-answer {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease, padding 0.3s ease;
  }

  .faq-answer.open {
    max-height: 500px;
    padding: 0 1.25rem 1.25rem;
  }

  .faq-answer p {
    margin: 0;
    font-size: 0.9375rem;
    color: #6b7280;
    line-height: 1.6;
  }

  /* CTA Section */
  .cta-section-bottom {
    padding: 4rem 1.5rem 6rem;
  }

  .cta-container {
    max-width: 800px;
    margin: 0 auto;
    background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
    border-radius: 1.5rem;
    padding: 3rem 2rem;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .cta-container::before {
    content: '';
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(600px 300px at 20% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
      radial-gradient(400px 200px at 80% 80%, rgba(255, 255, 255, 0.08) 0%, transparent 50%);
  }

  .cta-content {
    position: relative;
    z-index: 1;
  }

  .cta-title {
    font-size: 2.25rem;
    font-weight: 700;
    color: white;
    margin-bottom: 1rem;
    letter-spacing: -0.01em;
  }

  .cta-subtitle {
    font-size: 1.125rem;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 2rem;
  }

  .cta-buttons {
    display: flex;
    justify-content: center;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1.5rem;
  }

  .cta-button-main {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 2rem;
    background: white;
    color: #7c3aed;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 0.75rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
  }

  .cta-button-main:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.2);
  }

  .cta-arrow {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.2s ease;
  }

  .cta-button-main:hover .cta-arrow {
    transform: translateX(4px);
  }

  .cta-button-secondary {
    display: inline-flex;
    align-items: center;
    padding: 1rem 2rem;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
  }

  .cta-button-secondary:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .cta-note {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .hero-section {
      padding: 3rem 1rem 2rem;
    }

    .hero-title {
      font-size: 2rem;
    }

    .hero-subtitle {
      font-size: 1.125rem;
    }

    .trust-badges {
      gap: 1rem;
    }

    .pricing-grid {
      grid-template-columns: 1fr;
      max-width: 400px;
      margin: 0 auto;
    }

    .amount {
      font-size: 2.5rem;
    }

    .section-title {
      font-size: 1.5rem;
    }

    .comparison-table th,
    .comparison-table td {
      padding: 0.75rem 1rem;
    }

    .cta-container {
      padding: 2rem 1.5rem;
    }

    .cta-title {
      font-size: 1.75rem;
    }

    .cta-buttons {
      flex-direction: column;
      align-items: stretch;
    }

    .cta-button-main,
    .cta-button-secondary {
      justify-content: center;
    }
  }

  @media (max-width: 640px) {
    .comparison-table {
      font-size: 0.875rem;
    }

    .comparison-table th,
    .comparison-table td {
      padding: 0.625rem 0.75rem;
    }

    .faq-question {
      padding: 1rem;
      font-size: 0.9375rem;
    }

    .faq-answer.open {
      padding: 0 1rem 1rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .pricing-card,
    .cta-button,
    .faq-question,
    .faq-icon,
    .faq-answer,
    .cta-arrow {
      transition: none;
    }

    .pricing-card:hover {
      transform: none;
    }
  }
</style>
