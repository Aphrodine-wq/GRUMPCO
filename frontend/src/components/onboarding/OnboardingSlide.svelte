<script lang="ts">
  import { onMount } from 'svelte';
  import { Hand, Rocket, Settings, Key, Plug } from 'lucide-svelte';

  interface Slide {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    illustration: string;
    background: 'white' | 'purple';
    isInteractive?: boolean;
    ctaLabel?: string;
    ctaAction?: string;
  }

  interface Props {
    slide: Slide;
    isActive: boolean;
    children?: import('svelte').Snippet;
  }

  let { slide, children }: Props = $props();

  const isPurple = $derived(slide.background === 'purple');

  let illustrationMounted = $state(false);

  onMount(() => {
    // Delay illustration animation for stagger effect
    setTimeout(() => {
      illustrationMounted = true;
    }, 100);
  });
</script>

<div class="flex flex-col items-center text-center w-full">
  <!-- Illustration -->
  <div
    class="w-48 h-48 mb-8 relative transition-all duration-500
           {illustrationMounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}"
  >
    {#if slide.illustration === 'mascot'}
      <!-- G-Rump Mascot - Hand wave -->
      <div class="w-full h-full relative flex items-center justify-center">
        <div
          class="absolute inset-0 {isPurple
            ? 'bg-white/20'
            : 'bg-[#7C3AED]/10'} rounded-[40%_60%_70%_30%/40%_50%_60%_50%] animate-morph"
        ></div>
        <div
          class="absolute inset-4 {isPurple
            ? 'bg-white/30'
            : 'bg-[#7C3AED]/15'} rounded-[60%_40%_30%_70%/50%_60%_40%_50%] animate-morph-reverse"
        ></div>
        <span class="animate-bounce-slow inline-flex">
          <Hand
            class="relative z-10 w-24 h-24 {isPurple
              ? 'text-white'
              : 'text-[#7C3AED]'} filter drop-shadow-lg"
            strokeWidth={1.5}
          />
        </span>
      </div>
    {:else if slide.illustration === 'architecture'}
      <!-- Architecture diagram illustration -->
      <svg viewBox="0 0 200 200" class="w-full h-full" fill="none">
        <!-- Nodes -->
        <g class="animate-draw-in">
          <rect
            x="70"
            y="20"
            width="60"
            height="35"
            rx="8"
            class="node-1"
            fill={isPurple ? 'white' : '#7C3AED'}
            fill-opacity={isPurple ? '0.9' : '0.2'}
          />
          <rect
            x="20"
            y="90"
            width="50"
            height="35"
            rx="8"
            class="node-2"
            fill={isPurple ? 'white' : '#7C3AED'}
            fill-opacity={isPurple ? '0.7' : '0.15'}
          />
          <rect
            x="130"
            y="90"
            width="50"
            height="35"
            rx="8"
            class="node-3"
            fill={isPurple ? 'white' : '#7C3AED'}
            fill-opacity={isPurple ? '0.7' : '0.15'}
          />
          <rect
            x="70"
            y="145"
            width="60"
            height="35"
            rx="8"
            class="node-4"
            fill={isPurple ? 'white' : '#7C3AED'}
            fill-opacity={isPurple ? '0.9' : '0.2'}
          />
        </g>
        <!-- Connecting lines -->
        <g
          stroke={isPurple ? 'white' : '#7C3AED'}
          stroke-width="2"
          stroke-opacity={isPurple ? '0.6' : '0.4'}
          class="animate-draw-lines"
        >
          <line x1="100" y1="55" x2="45" y2="90" class="line-1" />
          <line x1="100" y1="55" x2="155" y2="90" class="line-2" />
          <line x1="45" y1="125" x2="100" y2="145" class="line-3" />
          <line x1="155" y1="125" x2="100" y2="145" class="line-4" />
        </g>
        <!-- Icons in nodes -->
        <text
          x="100"
          y="43"
          text-anchor="middle"
          fill={isPurple ? '#7C3AED' : '#6D28D9'}
          font-size="16">API</text
        >
        <text
          x="45"
          y="113"
          text-anchor="middle"
          fill={isPurple ? '#7C3AED' : '#6D28D9'}
          font-size="12">DB</text
        >
        <text
          x="155"
          y="113"
          text-anchor="middle"
          fill={isPurple ? '#7C3AED' : '#6D28D9'}
          font-size="12">Cache</text
        >
        <text
          x="100"
          y="168"
          text-anchor="middle"
          fill={isPurple ? '#7C3AED' : '#6D28D9'}
          font-size="14">UI</text
        >
      </svg>
    {:else if slide.illustration === 'document'}
      <!-- Document with checkmarks -->
      <svg viewBox="0 0 200 200" class="w-full h-full" fill="none">
        <!-- Document shape -->
        <rect
          x="40"
          y="20"
          width="120"
          height="160"
          rx="12"
          fill="white"
          fill-opacity="0.95"
          stroke={isPurple ? 'transparent' : '#7C3AED'}
          stroke-opacity="0.3"
          stroke-width="2"
        />
        <rect x="40" y="20" width="120" height="35" rx="12" fill="white" />
        <rect x="40" y="43" width="120" height="137" fill="white" fill-opacity="0.95" />

        <!-- Header bar -->
        <rect x="50" y="30" width="60" height="8" rx="4" fill="#7C3AED" fill-opacity="0.3" />

        <!-- Checklist items -->
        <g class="animate-checklist">
          <!-- Item 1 -->
          <circle cx="60" cy="70" r="8" fill="#10B981" class="check-1" />
          <path
            d="M56 70 L59 73 L65 67"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="checkmark-1"
          />
          <rect x="76" y="66" width="70" height="8" rx="4" fill="#7C3AED" fill-opacity="0.2" />

          <!-- Item 2 -->
          <circle cx="60" cy="100" r="8" fill="#10B981" class="check-2" />
          <path
            d="M56 100 L59 103 L65 97"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="checkmark-2"
          />
          <rect x="76" y="96" width="55" height="8" rx="4" fill="#7C3AED" fill-opacity="0.2" />

          <!-- Item 3 -->
          <circle cx="60" cy="130" r="8" fill="#10B981" class="check-3" />
          <path
            d="M56 130 L59 133 L65 127"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="checkmark-3"
          />
          <rect x="76" y="126" width="65" height="8" rx="4" fill="#7C3AED" fill-opacity="0.2" />

          <!-- Item 4 -->
          <circle cx="60" cy="160" r="8" fill="#10B981" class="check-4" />
          <path
            d="M56 160 L59 163 L65 157"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="checkmark-4"
          />
          <rect x="76" y="156" width="45" height="8" rx="4" fill="#7C3AED" fill-opacity="0.2" />
        </g>
      </svg>
    {:else if slide.illustration === 'code'}
      <!-- Code blocks floating -->
      <div class="w-full h-full relative">
        <!-- Floating code blocks -->
        <div
          class="absolute top-0 left-0 bg-white/90 rounded-lg p-3 shadow-xl animate-code-float-1 w-32"
        >
          <div class="flex gap-1 mb-2">
            <div class="w-2 h-2 rounded-full bg-red-400"></div>
            <div class="w-2 h-2 rounded-full bg-yellow-400"></div>
            <div class="w-2 h-2 rounded-full bg-green-400"></div>
          </div>
          <div class="space-y-1">
            <div class="h-1.5 bg-purple-300 rounded w-16"></div>
            <div class="h-1.5 bg-blue-300 rounded w-20"></div>
            <div class="h-1.5 bg-purple-200 rounded w-12"></div>
          </div>
        </div>

        <div
          class="absolute top-8 right-0 bg-white/90 rounded-lg p-3 shadow-xl animate-code-float-2 w-28"
        >
          <div class="flex gap-1 mb-2">
            <div class="w-2 h-2 rounded-full bg-red-400"></div>
            <div class="w-2 h-2 rounded-full bg-yellow-400"></div>
            <div class="w-2 h-2 rounded-full bg-green-400"></div>
          </div>
          <div class="space-y-1">
            <div class="h-1.5 bg-green-300 rounded w-14"></div>
            <div class="h-1.5 bg-purple-300 rounded w-18"></div>
          </div>
        </div>

        <div
          class="absolute bottom-4 left-4 bg-white/90 rounded-lg p-3 shadow-xl animate-code-float-3 w-36"
        >
          <div class="flex gap-1 mb-2">
            <div class="w-2 h-2 rounded-full bg-red-400"></div>
            <div class="w-2 h-2 rounded-full bg-yellow-400"></div>
            <div class="w-2 h-2 rounded-full bg-green-400"></div>
          </div>
          <div class="space-y-1">
            <div class="h-1.5 bg-orange-300 rounded w-24"></div>
            <div class="h-1.5 bg-purple-300 rounded w-16"></div>
            <div class="h-1.5 bg-blue-300 rounded w-28"></div>
          </div>
        </div>

        <!-- Central rocket icon -->
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-rocket">
          <Rocket
            class="w-16 h-16 {isPurple ? 'text-white' : 'text-[#7C3AED]'}"
            strokeWidth={1.5}
          />
        </div>
      </div>
    {:else if slide.illustration === 'apiKey'}
      <!-- API Key illustration -->
      <div class="w-full h-full flex items-center justify-center">
        <div class="relative">
          <div
            class="absolute inset-0 {isPurple
              ? 'bg-white/20'
              : 'bg-[#7C3AED]/10'} rounded-full w-32 h-32 animate-pulse-scale"
          ></div>
          <span class="animate-bounce-slow inline-flex">
            <Key
              class="relative z-10 w-20 h-20 {isPurple ? 'text-white' : 'text-[#7C3AED]'}"
              strokeWidth={1.5}
            />
          </span>
        </div>
      </div>
    {:else if slide.illustration === 'integrations'}
      <!-- Integrations / connected platforms illustration -->
      <div class="w-full h-full flex items-center justify-center relative">
        <div class="absolute top-2 left-4">
          <Plug
            class="w-10 h-10 {isPurple ? 'text-white/80' : 'text-[#7C3AED]/70'}"
            strokeWidth={2}
          />
        </div>
        <div class="absolute top-4 right-6">
          <Plug
            class="w-8 h-8 {isPurple ? 'text-white/70' : 'text-[#7C3AED]/60'}"
            strokeWidth={2}
          />
        </div>
        <div class="absolute bottom-6 left-8">
          <Plug
            class="w-8 h-8 {isPurple ? 'text-white/70' : 'text-[#7C3AED]/60'}"
            strokeWidth={2}
          />
        </div>
        <div class="absolute bottom-8 right-4">
          <Plug
            class="w-10 h-10 {isPurple ? 'text-white/80' : 'text-[#7C3AED]/70'}"
            strokeWidth={2}
          />
        </div>
        <div
          class="relative z-10 w-16 h-16 rounded-xl {isPurple
            ? 'bg-white/30'
            : 'bg-[#7C3AED]/20'} flex items-center justify-center"
        >
          <Plug class="w-10 h-10 {isPurple ? 'text-white' : 'text-[#7C3AED]'}" strokeWidth={2} />
        </div>
      </div>
    {:else if slide.illustration === 'setup'}
      <!-- Settings gear illustration (setup slide is white background) -->
      <div class="w-full h-full flex items-center justify-center relative">
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-32 h-32 border-4 border-[#7C3AED]/30 rounded-full animate-spin-slow"></div>
        </div>
        <div class="absolute inset-0 flex items-center justify-center">
          <div
            class="w-24 h-24 border-4 border-[#7C3AED]/20 rounded-full animate-spin-reverse"
          ></div>
        </div>
        <Settings
          class="w-20 h-20 text-[#7C3AED] relative z-10 animate-pulse-scale"
          strokeWidth={1.5}
        />
      </div>
    {/if}
  </div>

  <!-- Text content -->
  <div class="space-y-4 animate-text-in" style="animation-delay: 150ms;">
    <h1
      class="text-3xl md:text-4xl font-bold tracking-tight {isPurple
        ? 'text-white'
        : 'text-gray-900'}"
    >
      {slide.title}
    </h1>
    <p class="text-lg md:text-xl font-medium {isPurple ? 'text-white/80' : 'text-gray-600'}">
      {slide.subtitle}
    </p>
    <p
      class="text-base max-w-md mx-auto leading-relaxed {isPurple
        ? 'text-white/60'
        : 'text-gray-500'}"
    >
      {slide.description}
    </p>
  </div>

  <!-- Slot for interactive content -->
  {#if children}
    {@render children()}
  {/if}
</div>

<style>
  /* Morphing blob animation */
  @keyframes morph {
    0%,
    100% {
      border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
    }
    25% {
      border-radius: 70% 30% 50% 50% / 30% 30% 70% 70%;
    }
    50% {
      border-radius: 50% 60% 30% 60% / 70% 40% 70% 50%;
    }
    75% {
      border-radius: 60% 40% 60% 40% / 50% 60% 30% 60%;
    }
  }

  .animate-morph {
    animation: morph 8s ease-in-out infinite;
  }

  .animate-morph-reverse {
    animation: morph 8s ease-in-out infinite reverse;
    animation-delay: -4s;
  }

  /* Slow bounce */
  @keyframes bounceSlow {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  .animate-bounce-slow {
    animation: bounceSlow 3s ease-in-out infinite;
  }

  /* Draw in animation for architecture */
  .animate-draw-in rect {
    opacity: 0;
    animation: drawIn 500ms ease-out forwards;
  }

  .animate-draw-in .node-1 {
    animation-delay: 0ms;
  }
  .animate-draw-in .node-2 {
    animation-delay: 150ms;
  }
  .animate-draw-in .node-3 {
    animation-delay: 300ms;
  }
  .animate-draw-in .node-4 {
    animation-delay: 450ms;
  }

  @keyframes drawIn {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Line drawing animation */
  .animate-draw-lines line {
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    animation: drawLine 400ms ease-out forwards;
  }

  .animate-draw-lines .line-1 {
    animation-delay: 200ms;
  }
  .animate-draw-lines .line-2 {
    animation-delay: 350ms;
  }
  .animate-draw-lines .line-3 {
    animation-delay: 500ms;
  }
  .animate-draw-lines .line-4 {
    animation-delay: 650ms;
  }

  @keyframes drawLine {
    to {
      stroke-dashoffset: 0;
    }
  }

  /* Checklist animation */
  .animate-checklist circle,
  .animate-checklist path {
    opacity: 0;
    animation: popIn 300ms ease-out forwards;
  }

  .animate-checklist .check-1,
  .animate-checklist .checkmark-1 {
    animation-delay: 200ms;
  }
  .animate-checklist .check-2,
  .animate-checklist .checkmark-2 {
    animation-delay: 400ms;
  }
  .animate-checklist .check-3,
  .animate-checklist .checkmark-3 {
    animation-delay: 600ms;
  }
  .animate-checklist .check-4,
  .animate-checklist .checkmark-4 {
    animation-delay: 800ms;
  }

  @keyframes popIn {
    from {
      opacity: 0;
      transform: scale(0);
    }
    50% {
      transform: scale(1.2);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Floating code blocks */
  @keyframes codeFloat1 {
    0%,
    100% {
      transform: translate(0, 0) rotate(-2deg);
    }
    50% {
      transform: translate(5px, -8px) rotate(2deg);
    }
  }

  @keyframes codeFloat2 {
    0%,
    100% {
      transform: translate(0, 0) rotate(3deg);
    }
    50% {
      transform: translate(-8px, 5px) rotate(-1deg);
    }
  }

  @keyframes codeFloat3 {
    0%,
    100% {
      transform: translate(0, 0) rotate(1deg);
    }
    50% {
      transform: translate(10px, -5px) rotate(-2deg);
    }
  }

  .animate-code-float-1 {
    animation: codeFloat1 4s ease-in-out infinite;
  }

  .animate-code-float-2 {
    animation: codeFloat2 5s ease-in-out infinite;
    animation-delay: -1s;
  }

  .animate-code-float-3 {
    animation: codeFloat3 4.5s ease-in-out infinite;
    animation-delay: -2s;
  }

  /* Rocket animation */
  @keyframes rocket {
    0%,
    100% {
      transform: translate(-50%, -50%) rotate(-5deg);
    }
    50% {
      transform: translate(-50%, -60%) rotate(5deg);
    }
  }

  .animate-rocket {
    animation: rocket 2s ease-in-out infinite;
  }

  /* Spin animations */
  .animate-spin-slow {
    animation: spin 20s linear infinite;
  }

  .animate-spin-reverse {
    animation: spin 15s linear infinite reverse;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Pulse scale */
  @keyframes pulseScale {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }

  .animate-pulse-scale {
    animation: pulseScale 2s ease-in-out infinite;
  }

  /* Text entrance animation */
  @keyframes textIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-text-in {
    animation: textIn 500ms ease-out forwards;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .animate-morph,
    .animate-morph-reverse,
    .animate-bounce-slow,
    .animate-code-float-1,
    .animate-code-float-2,
    .animate-code-float-3,
    .animate-rocket,
    .animate-spin-slow,
    .animate-spin-reverse,
    .animate-pulse-scale {
      animation: none;
    }

    .animate-draw-in rect,
    .animate-draw-lines line,
    .animate-checklist circle,
    .animate-checklist path {
      animation-duration: 0ms;
      opacity: 1;
      stroke-dashoffset: 0;
    }
  }
</style>
