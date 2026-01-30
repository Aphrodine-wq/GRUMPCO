<script lang="ts">
  import { onMount } from 'svelte'
  import { consentStore, analytics } from '../lib/analytics'

  let visible = $state(false)
  let showDetails = $state(false)

  onMount(() => {
    // Check if user has already made a consent choice
    const consent = localStorage.getItem('grump-consent')
    if (!consent) {
      // Show banner after a short delay for better UX
      setTimeout(() => {
        visible = true
      }, 1000)
    } else {
      // Update analytics with stored consent
      const parsed = JSON.parse(consent)
      consentStore.grantConsent({
        analytics: parsed.analytics,
        marketing: parsed.marketing,
        functional: parsed.functional
      })
      analytics.updateConsent(parsed)
    }
  })

  function acceptAll() {
    consentStore.grantConsent({
      analytics: true,
      marketing: true,
      functional: true
    })
    analytics.updateConsent({
      analytics: true,
      marketing: true,
      functional: true,
      timestamp: Date.now(),
      version: '1.0'
    })
    analytics.trackEvent('consent', 'accept_all', undefined, undefined, {
      timestamp: Date.now()
    })
    visible = false
  }

  function acceptNecessaryOnly() {
    consentStore.grantConsent({
      analytics: false,
      marketing: false,
      functional: true
    })
    analytics.updateConsent({
      analytics: false,
      marketing: false,
      functional: true,
      timestamp: Date.now(),
      version: '1.0'
    })
    analytics.trackEvent('consent', 'accept_necessary', undefined, undefined, {
      timestamp: Date.now()
    })
    visible = false
  }

  function customize() {
    showDetails = !showDetails
  }
</script>

{#if visible}
  <div 
    class="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg p-4 sm:p-6"
    role="dialog"
    aria-labelledby="cookie-consent-title"
    aria-describedby="cookie-consent-desc"
  >
    <div class="max-w-4xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-start gap-4">
        <div class="flex-1">
          <h3 id="cookie-consent-title" class="text-lg font-semibold text-gray-900 mb-2">
            Privacy Preferences
          </h3>
          <p id="cookie-consent-desc" class="text-sm text-gray-600 mb-4">
            We use cookies and similar technologies to enhance your experience, analyze site usage, 
            and assist in our marketing efforts. You can customize your preferences or accept all cookies.
            <a href="/#/privacy" class="text-primary-600 hover:underline ml-1" target="_blank" rel="noopener">
              Learn more
            </a>
          </p>

          {#if showDetails}
            <div class="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium text-gray-900">Essential</p>
                  <p class="text-xs text-gray-500">Required for the site to function</p>
                </div>
                <span class="text-sm text-green-600 font-medium">Always On</span>
              </div>
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium text-gray-900">Analytics</p>
                  <p class="text-xs text-gray-500">Helps us improve our website</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    class="sr-only peer"
                    checked={$consentStore.analytics}
                    onchange={(e) => consentStore.grantConsent({ analytics: (e.target as HTMLInputElement).checked })}
                  />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium text-gray-900">Marketing</p>
                  <p class="text-xs text-gray-500">Used for personalized advertising</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    class="sr-only peer"
                    checked={$consentStore.marketing}
                    onchange={(e) => consentStore.grantConsent({ marketing: (e.target as HTMLInputElement).checked })}
                  />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>
          {/if}
        </div>

        <div class="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:flex-shrink-0">
          <button
            onclick={customize}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition"
          >
            {showDetails ? 'Hide Details' : 'Customize'}
          </button>
          <button
            onclick={acceptNecessaryOnly}
            class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition"
          >
            Necessary Only
          </button>
          <button
            onclick={acceptAll}
            class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
