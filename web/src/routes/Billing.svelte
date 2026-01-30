<script lang="ts">
  import { onMount } from 'svelte'
  import { trackBillingEvent } from '../lib/analytics'
  
  // Credit balance state
  let credits = $state(500)
  let creditsUsed = $state(150)
  let creditsTotal = $state(650)
  let autoTopUp = $state(false)
  let autoTopUpThreshold = $state(100)
  let autoTopUpPackage = $state('pro')
  let isLoading = $state(false)
  let showPurchaseModal = $state(false)
  let selectedPackage = $state<string | null>(null)
  let purchaseSuccess = $state(false)
  let purchaseError = $state<string | null>(null)
  
  // Usage history for graph (last 30 days)
  let usageData = $state([
    { date: '2026-01-01', used: 20, label: 'Jan 1' },
    { date: '2026-01-02', used: 45, label: 'Jan 2' },
    { date: '2026-01-03', used: 30, label: 'Jan 3' },
    { date: '2026-01-04', used: 60, label: 'Jan 4' },
    { date: '2026-01-05', used: 25, label: 'Jan 5' },
    { date: '2026-01-06', used: 80, label: 'Jan 6' },
    { date: '2026-01-07', used: 40, label: 'Jan 7' },
    { date: '2026-01-08', used: 55, label: 'Jan 8' },
    { date: '2026-01-09', used: 35, label: 'Jan 9' },
    { date: '2026-01-10', used: 70, label: 'Jan 10' },
    { date: '2026-01-11', used: 20, label: 'Jan 11' },
    { date: '2026-01-12', used: 50, label: 'Jan 12' },
    { date: '2026-01-13', used: 40, label: 'Jan 13' },
    { date: '2026-01-14', used: 65, label: 'Jan 14' },
    { date: '2026-01-15', used: 30, label: 'Jan 15' },
    { date: '2026-01-16', used: 45, label: 'Jan 16' },
    { date: '2026-01-17', used: 25, label: 'Jan 17' },
    { date: '2026-01-18', used: 60, label: 'Jan 18' },
    { date: '2026-01-19', used: 35, label: 'Jan 19' },
    { date: '2026-01-20', used: 75, label: 'Jan 20' },
    { date: '2026-01-21', used: 40, label: 'Jan 21' },
    { date: '2026-01-22', used: 55, label: 'Jan 22' },
    { date: '2026-01-23', used: 20, label: 'Jan 23' },
    { date: '2026-01-24', used: 50, label: 'Jan 24' },
    { date: '2026-01-25', used: 45, label: 'Jan 25' },
    { date: '2026-01-26', used: 30, label: 'Jan 26' },
    { date: '2026-01-27', used: 50, label: 'Jan 27' },
    { date: '2026-01-28', used: 25, label: 'Jan 28' },
    { date: '2026-01-29', used: 60, label: 'Jan 29' },
    { date: '2026-01-30', used: 40, label: 'Today' },
  ])
  
  // Credit history
  let creditHistory = $state([
    { date: '2026-01-30', action: 'Code Generation', credits: -25, description: 'React component with tests', icon: 'code' },
    { date: '2026-01-29', action: 'Architecture Design', credits: -50, description: 'API system architecture', icon: 'diagram' },
    { date: '2026-01-28', action: 'Bug Fix', credits: -10, description: 'Authentication bug', icon: 'bug' },
    { date: '2026-01-27', action: 'Code Generation', credits: -25, description: 'Database schema models', icon: 'code' },
    { date: '2026-01-25', action: 'Purchase', credits: 500, description: 'Starter Pack - 500 credits', icon: 'purchase' },
    { date: '2026-01-24', action: 'Multi-Agent Task', credits: -75, description: 'Full-stack feature implementation', icon: 'multi' },
    { date: '2026-01-23', action: 'Code Review', credits: -15, description: 'PR review and suggestions', icon: 'review' },
    { date: '2026-01-22', action: 'Test Generation', credits: -20, description: 'Unit tests for utils', icon: 'test' },
  ])
  
  // Credit packages
  const creditPackages = [
    { id: 'starter', name: 'Starter Pack', credits: 500, price: 9.99, popular: false, savings: 0 },
    { id: 'pro', name: 'Pro Pack', credits: 2500, price: 39.99, popular: true, savings: 20 },
    { id: 'team', name: 'Team Pack', credits: 10000, price: 129.99, popular: false, savings: 35 },
  ]
  
  // Credit costs per action
  const actionCosts = [
    { action: 'Code Generation (simple)', cost: 5 },
    { action: 'Code Generation (complex)', cost: 25 },
    { action: 'Architecture Design', cost: 50 },
    { action: 'Bug Fix / Debug', cost: 10 },
    { action: 'Code Review', cost: 15 },
    { action: 'Test Generation', cost: 20 },
    { action: 'Documentation', cost: 10 },
    { action: 'Multi-Agent Task', cost: 75 },
  ]
  
  // Calculate graph data
  $: maxUsage = Math.max(...usageData.map(d => d.used))
  $: avgUsage = Math.round(usageData.reduce((acc, d) => acc + d.used, 0) / usageData.length)
  
  onMount(() => {
    trackBillingEvent('view', 'credits')
  })
  
  function toggleAutoTopUp() {
    autoTopUp = !autoTopUp
    trackBillingEvent('autotopup_toggle', autoTopUp ? 'enabled' : 'disabled')
    // In production, this would save to the backend
  }
  
  function openPurchaseModal(pkgId: string) {
    selectedPackage = pkgId
    showPurchaseModal = true
    purchaseError = null
    purchaseSuccess = false
    trackBillingEvent('credit_purchase', pkgId)
  }
  
  function closePurchaseModal() {
    showPurchaseModal = false
    selectedPackage = null
    purchaseSuccess = false
    purchaseError = null
  }
  
  async function processPurchase() {
    if (!selectedPackage) return
    
    isLoading = true
    purchaseError = null
    
    try {
      // Simulate Stripe checkout
      // In production, this would:
      // 1. Call backend to create Stripe checkout session
      // 2. Redirect to Stripe
      // 3. Handle webhook for success
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const pkg = creditPackages.find(p => p.id === selectedPackage)
      if (pkg) {
        credits += pkg.credits
        creditsTotal += pkg.credits
        creditHistory.unshift({
          date: new Date().toISOString().split('T')[0],
          action: 'Purchase',
          credits: pkg.credits,
          description: `${pkg.name} - ${pkg.credits.toLocaleString()} credits`,
          icon: 'purchase'
        })
        purchaseSuccess = true
        trackBillingEvent('credit_purchase', selectedPackage)
      }
    } catch (error) {
      purchaseError = 'Payment failed. Please try again.'
      trackBillingEvent('purchase_error', selectedPackage)
    } finally {
      isLoading = false
    }
  }
  
  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }
  
  function getActionIcon(icon: string) {
    const icons: Record<string, string> = {
      code: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>',
      diagram: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>',
      bug: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
      purchase: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
      multi: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>',
      review: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
      test: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>',
    }
    return icons[icon] || icons.code
  }
</script>

<div class="billing responsive-p safe-x safe-bottom overflow-y-auto" role="region" aria-label="Billing and credit management">
  <div class="max-w-6xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Billing</h1>
          <p class="text-gray-600">Manage your credits, view usage, and purchase more.</p>
        </div>
        <a href="/#/pricing" class="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
          View pricing
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </a>
      </div>
    </div>

    <!-- Credits Dashboard -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <!-- Current Balance -->
      <div class="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
        <div class="relative">
          <div class="flex items-center justify-between mb-2">
            <span class="text-purple-100 text-sm font-medium">Available Credits</span>
            <svg class="w-5 h-5 text-purple-200" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
            </svg>
          </div>
          <div class="text-4xl font-bold mb-1">{credits.toLocaleString()}</div>
          <div class="text-purple-200 text-sm">credits remaining</div>
          
          <!-- Progress bar -->
          <div class="mt-4">
            <div class="flex justify-between text-xs text-purple-200 mb-1">
              <span>0</span>
              <span>{creditsTotal.toLocaleString()}</span>
            </div>
            <div class="h-2 bg-purple-900/50 rounded-full overflow-hidden">
              <div 
                class="h-full bg-white/80 rounded-full transition-all duration-500"
                style="width: {(credits / creditsTotal) * 100}%"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Usage This Month -->
      <div class="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        <div class="flex items-center justify-between mb-2">
          <span class="text-gray-600 text-sm font-medium">Used This Month</span>
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
          </svg>
        </div>
        <div class="text-4xl font-bold text-gray-900 mb-1">{creditsUsed.toLocaleString()}</div>
        <div class="text-gray-500 text-sm">credits consumed</div>
        <div class="mt-3 text-sm">
          <span class="text-green-600 font-medium">↓ 12%</span>
          <span class="text-gray-400"> from last month</span>
        </div>
      </div>

      <!-- Est. Actions -->
      <div class="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        <div class="flex items-center justify-between mb-2">
          <span class="text-gray-600 text-sm font-medium">Est. Actions Left</span>
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
        </div>
        <div class="text-4xl font-bold text-gray-900 mb-1">~{Math.floor(credits / 20).toLocaleString()}</div>
        <div class="text-gray-500 text-sm">code generations</div>
        <div class="mt-3 text-sm text-gray-400">Based on avg. 20 credits/action</div>
      </div>

      <!-- Daily Average -->
      <div class="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        <div class="flex items-center justify-between mb-2">
          <span class="text-gray-600 text-sm font-medium">Daily Average</span>
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
          </svg>
        </div>
        <div class="text-4xl font-bold text-gray-900 mb-1">{avgUsage}</div>
        <div class="text-gray-500 text-sm">credits/day</div>
        <div class="mt-3 text-sm text-gray-400">Last 30 days</div>
      </div>
    </div>

    <!-- Usage Graph -->
    <section class="mb-8" aria-labelledby="usage-heading">
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 id="usage-heading" class="text-lg font-semibold text-gray-900">Usage History</h2>
            <p class="text-sm text-gray-500 mt-1">Last 30 days credit consumption</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-purple-500"></div>
              <span class="text-sm text-gray-600">Daily usage</span>
            </div>
          </div>
        </div>
        
        <!-- Graph Container -->
        <div class="graph-container">
          <div class="graph-y-axis">
            <span class="y-label">{maxUsage}</span>
            <span class="y-label">{Math.round(maxUsage / 2)}</span>
            <span class="y-label">0</span>
          </div>
          <div class="graph-content">
            <div class="graph-bars">
              {#each usageData as day, i}
                <div class="bar-wrapper">
                  <div 
                    class="graph-bar"
                    style="height: {(day.used / maxUsage) * 100}%"
                    title="{day.label}: {day.used} credits"
                  ></div>
                  {#if i % 5 === 0 || i === usageData.length - 1}
                    <span class="x-label">{day.label}</span>
                  {/if}
                </div>
              {/each}
            </div>
            <div class="graph-grid-lines">
              <div class="grid-line"></div>
              <div class="grid-line"></div>
              <div class="grid-line"></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Credit Packages -->
    <section class="mb-8" aria-labelledby="packages-heading">
      <h2 id="packages-heading" class="text-xl font-semibold text-gray-900 mb-4">Buy More Credits</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        {#each creditPackages as pkg}
          <div class="relative bg-white rounded-xl border-2 {pkg.popular ? 'border-purple-500 shadow-lg' : 'border-gray-200'} p-6 flex flex-col">
            {#if pkg.popular}
              <div class="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span class="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">MOST POPULAR</span>
              </div>
            {/if}
            
            <div class="mb-4">
              <h3 class="text-lg font-semibold text-gray-900">{pkg.name}</h3>
              <div class="flex items-baseline gap-1 mt-1">
                <span class="text-3xl font-bold text-gray-900">${pkg.price}</span>
              </div>
              <div class="text-gray-600 mt-1">{pkg.credits.toLocaleString()} credits</div>
            </div>
            
            {#if pkg.savings > 0}
              <div class="text-sm text-green-600 font-medium mb-3">Save {pkg.savings}%</div>
            {:else}
              <div class="text-sm text-gray-500 mb-3">Pay as you go</div>
            {/if}
            
            <ul class="text-sm text-gray-600 space-y-2 mb-5 flex-1">
              <li class="flex items-center gap-2">
                <svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                Credits never expire
              </li>
              <li class="flex items-center gap-2">
                <svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                All AI models included
              </li>
              <li class="flex items-center gap-2">
                <svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                {pkg.popular ? 'Priority' : 'Standard'} support
              </li>
            </ul>
            
            <button 
              onclick={() => openPurchaseModal(pkg.id)}
              class="w-full py-2.5 px-4 rounded-lg font-medium transition-colors {pkg.popular ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}"
              aria-label="Purchase {pkg.name} for ${pkg.price}"
            >
              Buy Credits
            </button>
          </div>
        {/each}
      </div>
    </section>

    <!-- Credit Usage Guide -->
    <section class="mb-8" aria-labelledby="costs-heading">
      <h2 id="costs-heading" class="text-xl font-semibold text-gray-900 mb-4">What Actions Cost</h2>
      
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left text-sm font-medium text-gray-700 px-6 py-4">Action</th>
                <th class="text-right text-sm font-medium text-gray-700 px-6 py-4">Credits</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              {#each actionCosts as action}
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 text-sm text-gray-900">{action.action}</td>
                  <td class="px-6 py-4 text-sm text-gray-600 text-right font-medium">{action.cost}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Auto-Top Up Section -->
    <section class="mb-8" aria-labelledby="autotopup-heading">
      <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
        <div class="flex flex-col lg:flex-row lg:items-start gap-6">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <h2 id="autotopup-heading" class="text-lg font-semibold text-gray-900">Auto-Top Up</h2>
            </div>
            <p class="text-gray-600 text-sm mb-4">Never run out of credits during critical work. Automatically purchase credits when your balance drops below your threshold.</p>
            
            {#if autoTopUp}
              <div class="space-y-3">
                <div class="flex items-center gap-4">
                  <label class="text-sm font-medium text-gray-700">When balance drops below:</label>
                  <select 
                    bind:value={autoTopUpThreshold}
                    class="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value={50}>50 credits</option>
                    <option value={100}>100 credits</option>
                    <option value={250}>250 credits</option>
                    <option value={500}>500 credits</option>
                  </select>
                </div>
                <div class="flex items-center gap-4">
                  <label class="text-sm font-medium text-gray-700">Purchase package:</label>
                  <select 
                    bind:value={autoTopUpPackage}
                    class="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="starter">Starter (500 credits - $9.99)</option>
                    <option value="pro">Pro (2500 credits - $39.99)</option>
                    <option value="team">Team (10000 credits - $129.99)</option>
                  </select>
                </div>
              </div>
            {/if}
          </div>
          
          <div class="flex items-center gap-3">
            <button
              onclick={toggleAutoTopUp}
              class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 {autoTopUp ? 'bg-purple-600' : 'bg-gray-300'}"
              role="switch"
              aria-checked={autoTopUp}
              aria-label="Toggle auto-top up"
            >
              <span
                class="inline-block h-5 w-5 transform rounded-full bg-white transition-transform {autoTopUp ? 'translate-x-6' : 'translate-x-1'}"
              ></span>
            </button>
            <span class="text-sm font-medium text-gray-700">{autoTopUp ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Credit History -->
    <section aria-labelledby="history-heading">
      <h2 id="history-heading" class="text-xl font-semibold text-gray-900 mb-4">Credit History</h2>
      
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left text-sm font-medium text-gray-700 px-6 py-4">Date</th>
                <th class="text-left text-sm font-medium text-gray-700 px-6 py-4">Action</th>
                <th class="text-left text-sm font-medium text-gray-700 px-6 py-4">Description</th>
                <th class="text-right text-sm font-medium text-gray-700 px-6 py-4">Credits</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              {#each creditHistory as history}
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{formatDate(history.date)}</td>
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-lg {history.credits > 0 ? 'bg-green-100' : 'bg-purple-100'} flex items-center justify-center flex-shrink-0">
                        <svg class="w-4 h-4 {history.credits > 0 ? 'text-green-600' : 'text-purple-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {@html getActionIcon(history.icon)}
                        </svg>
                      </div>
                      <span class="text-sm font-medium text-gray-900">{history.action}</span>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-600">{history.description}</td>
                  <td class="px-6 py-4 text-sm font-medium text-right {history.credits > 0 ? 'text-green-600' : 'text-gray-900'}">
                    {history.credits > 0 ? '+' : ''}{history.credits}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        
        <!-- Pagination -->
        <div class="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <p class="text-sm text-gray-500">Showing 8 of 24 transactions</p>
          <div class="flex items-center gap-2">
            <button class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" disabled>
              Previous
            </button>
            <button class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</div>

<!-- Purchase Modal -->
{#if showPurchaseModal}
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    <!-- Backdrop -->
    <div 
      class="absolute inset-0 bg-black/50 backdrop-blur-sm"
      onclick={closePurchaseModal}
    ></div>
    
    <!-- Modal Content -->
    <div class="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-slide-up">
      {#if purchaseSuccess}
        <!-- Success State -->
        <div class="text-center py-8">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-2">Purchase Successful!</h3>
          <p class="text-gray-600 mb-6">Your credits have been added to your account.</p>
          <button 
            onclick={closePurchaseModal}
            class="w-full py-3 px-4 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
          >
            Done
          </button>
        </div>
      {:else}
        <!-- Purchase Form -->
        <div class="flex items-center justify-between mb-6">
          <h3 id="modal-title" class="text-xl font-bold text-gray-900">
            {#if selectedPackage}
              {creditPackages.find(p => p.id === selectedPackage)?.name}
            {:else}
              Buy Credits
            {/if}
          </h3>
          <button 
            onclick={closePurchaseModal}
            class="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        {#if selectedPackage}
          {@const pkg = creditPackages.find(p => p.id === selectedPackage)}
          <div class="bg-gray-50 rounded-xl p-4 mb-6">
            <div class="flex justify-between items-center mb-2">
              <span class="text-gray-600">Package</span>
              <span class="font-medium text-gray-900">{pkg?.name}</span>
            </div>
            <div class="flex justify-between items-center mb-2">
              <span class="text-gray-600">Credits</span>
              <span class="font-medium text-gray-900">{pkg?.credits.toLocaleString()}</span>
            </div>
            <div class="border-t border-gray-200 my-2"></div>
            <div class="flex justify-between items-center">
              <span class="font-medium text-gray-900">Total</span>
              <span class="text-2xl font-bold text-gray-900">${pkg?.price}</span>
            </div>
          </div>
        {/if}
        
        {#if purchaseError}
          <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>
            <span class="text-sm text-red-700">{purchaseError}</span>
          </div>
        {/if}
        
        <!-- Stripe Integration Placeholder -->
        <div class="space-y-3">
          <p class="text-sm text-gray-500 mb-4">You'll be redirected to our secure payment processor (Stripe) to complete your purchase.</p>
          
          <button 
            onclick={processPurchase}
            disabled={isLoading}
            class="w-full py-3 px-4 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {#if isLoading}
              <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              Processing...
            {:else}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
              </svg>
              Pay with Stripe
            {/if}
          </button>
          
          <button 
            onclick={closePurchaseModal}
            disabled={isLoading}
            class="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        
        <!-- Security badges -->
        <div class="mt-6 pt-4 border-t border-gray-200">
          <div class="flex items-center justify-center gap-4 text-gray-400">
            <div class="flex items-center gap-1.5 text-xs">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
              SSL Secure
            </div>
            <div class="flex items-center gap-1.5 text-xs">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
              </svg>
              Stripe
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .billing {
    background: linear-gradient(135deg, #fafafa 0%, #f3f0ff 100%);
    min-height: 100vh;
  }

  /* Graph Styles */
  .graph-container {
    display: flex;
    height: 200px;
    gap: 1rem;
  }

  .graph-y-axis {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding-right: 0.5rem;
    min-width: 2rem;
  }

  .y-label {
    font-size: 0.75rem;
    color: #9ca3af;
    text-align: right;
  }

  .graph-content {
    flex: 1;
    position: relative;
  }

  .graph-bars {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    height: 100%;
    gap: 2px;
    position: relative;
    z-index: 2;
  }

  .bar-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .graph-bar {
    width: 100%;
    background: linear-gradient(180deg, #a78bfa 0%, #8b5cf6 100%);
    border-radius: 2px 2px 0 0;
    min-height: 4px;
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .graph-bar:hover {
    background: linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%);
  }

  .x-label {
    font-size: 0.625rem;
    color: #9ca3af;
    white-space: nowrap;
  }

  .graph-grid-lines {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    pointer-events: none;
    z-index: 1;
  }

  .grid-line {
    border-top: 1px dashed #e5e7eb;
    width: 100%;
  }

  /* Toggle Switch Animation */
  [role="switch"] {
    transition: background-color 0.2s ease;
  }

  [role="switch"] span {
    transition: transform 0.2s ease;
  }

  /* Modal Animation */
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-slide-up {
    animation: slideUp 0.3s ease-out;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .graph-container {
      height: 160px;
    }

    .x-label {
      font-size: 0.5rem;
    }
  }
</style>
