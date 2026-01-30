/**
 * G-Rump Design System - Animation Tokens
 * Motion design for smooth, purposeful animations.
 * Respect prefers-reduced-motion via global CSS in App.svelte.
 */

export const prefersReducedMotionMedia = '(prefers-reduced-motion: reduce)';

export const animations = {
  // Durations
  duration: {
    instant: '0ms',
    fast: '100ms',
    quick: '150ms',
    normal: '250ms',
    slow: '350ms',
    slower: '500ms',
    screen: '400ms',    // Page transitions
  },

  // Easing functions
  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.68, -0.15, 0.265, 1.15)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  },

  // Pre-composed transitions
  transition: {
    // Micro-interactions
    fast: '150ms cubic-bezier(0, 0, 0.2, 1)',
    // Standard transitions
    default: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
    // Slow, deliberate transitions
    slow: '350ms cubic-bezier(0.4, 0, 0.2, 1)',
    // Spring for playful motion
    spring: '400ms cubic-bezier(0.68, -0.15, 0.265, 1.15)',
    // Colors only
    color: 'color 150ms cubic-bezier(0, 0, 0.2, 1), background-color 150ms cubic-bezier(0, 0, 0.2, 1)',
    // Transform transitions
    transform: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    // Opacity
    opacity: 'opacity 200ms cubic-bezier(0, 0, 0.2, 1)',
    // All properties
    all: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// Keyframe animations (as CSS strings for use in style blocks)
export const keyframes = {
  fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,

  fadeOut: `
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `,

  slideInRight: `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `,

  slideInLeft: `
    @keyframes slideInLeft {
      from {
        transform: translateX(-100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `,

  slideInUp: `
    @keyframes slideInUp {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `,

  slideInDown: `
    @keyframes slideInDown {
      from {
        transform: translateY(-20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `,

  scaleIn: `
    @keyframes scaleIn {
      from {
        transform: scale(0.95);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
  `,

  pulse: `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `,

  shimmer: `
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `,

  spin: `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `,

  bounce: `
    @keyframes bounce {
      0%, 100% {
        transform: translateY(-5%);
        animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
      }
      50% {
        transform: translateY(0);
        animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
      }
    }
  `,

  // Thinking blob animation
  thinkingBlob: `
    @keyframes thinkingBlob {
      0%, 100% { transform: scale(1) rotate(0deg); }
      25% { transform: scale(1.05) rotate(2deg); }
      50% { transform: scale(0.98) rotate(-1deg); }
      75% { transform: scale(1.02) rotate(1deg); }
    }
  `,

  // Success checkmark animation
  successCheck: `
    @keyframes successCheck {
      0% {
        transform: scale(0) rotate(-45deg);
        opacity: 0;
      }
      50% {
        transform: scale(1.2) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: scale(1) rotate(0deg);
        opacity: 1;
      }
    }
  `,

  // Error shake animation
  shake: `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
      20%, 40%, 60%, 80% { transform: translateX(4px); }
    }
  `,

  // Button ripple effect
  ripple: `
    @keyframes ripple {
      0% {
        transform: scale(0);
        opacity: 0.5;
      }
      100% {
        transform: scale(4);
        opacity: 0;
      }
    }
  `,

  // Message send animation
  messageSend: `
    @keyframes messageSend {
      0% {
        transform: translateY(10px) scale(0.95);
        opacity: 0;
      }
      60% {
        transform: translateY(-3px) scale(1.02);
        opacity: 1;
      }
      100% {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
    }
  `,

  // Pop-in animation for notifications
  popIn: `
    @keyframes popIn {
      0% {
        transform: scale(0.8);
        opacity: 0;
      }
      50% {
        transform: scale(1.1);
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }
  `,

  // Checkmark draw animation
  drawCheck: `
    @keyframes drawCheck {
      0% { stroke-dashoffset: 24; }
      100% { stroke-dashoffset: 0; }
    }
  `,

  // Loading dots animation
  loadingDots: `
    @keyframes loadingDots {
      0%, 20% { opacity: 0; }
      40% { opacity: 1; }
      100% { opacity: 0; }
    }
  `,
} as const;

// Animation presets for common use cases
export const animationPresets = {
  // Fade animations
  fadeIn: `fadeIn ${animations.duration.normal} ${animations.easing.easeOut} forwards`,
  fadeOut: `fadeOut ${animations.duration.normal} ${animations.easing.easeIn} forwards`,

  // Slide animations
  slideInRight: `slideInRight ${animations.duration.normal} ${animations.easing.easeOut} forwards`,
  slideInLeft: `slideInLeft ${animations.duration.normal} ${animations.easing.easeOut} forwards`,
  slideInUp: `slideInUp ${animations.duration.normal} ${animations.easing.easeOut} forwards`,
  slideInDown: `slideInDown ${animations.duration.normal} ${animations.easing.easeOut} forwards`,

  // Scale
  scaleIn: `scaleIn ${animations.duration.quick} ${animations.easing.spring} forwards`,

  // Looping
  pulse: `pulse 2s ${animations.easing.easeInOut} infinite`,
  shimmer: `shimmer 1.5s ${animations.easing.linear} infinite`,
  spin: `spin 1s ${animations.easing.linear} infinite`,
  bounce: `bounce 1s infinite`,

  // Thinking state
  thinking: `thinkingBlob 2.2s ${animations.easing.easeInOut} infinite`,

  // Micro-interactions
  successCheck: `successCheck 400ms ${animations.easing.spring} forwards`,
  shake: `shake 400ms ${animations.easing.easeInOut}`,
  ripple: `ripple 600ms ${animations.easing.easeOut} forwards`,
  messageSend: `messageSend 300ms ${animations.easing.spring} forwards`,
  popIn: `popIn 200ms ${animations.easing.bounce} forwards`,
} as const;

export type Animations = typeof animations;
export type Keyframes = typeof keyframes;
export type AnimationPresets = typeof animationPresets;
