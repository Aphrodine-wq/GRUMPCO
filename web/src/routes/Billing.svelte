<script lang="ts">
  let tier = $state<'free' | 'pro' | 'team'>('free')
</script>

<div class="billing p-6">
  <h1 class="text-2xl font-semibold text-gray-800 mb-4">Billing</h1>
  <p class="text-gray-600 mb-6">Manage your subscription and usage.</p>
  <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
    <h2 class="text-lg font-medium text-gray-900 mb-4">Current plan</h2>
    <p class="text-gray-600 capitalize">{tier}</p>
    <p class="mt-2 text-sm text-gray-500">
      Upgrade or change plan in the billing dashboard (Stripe integration).
    </p>
  </div>
</div>
