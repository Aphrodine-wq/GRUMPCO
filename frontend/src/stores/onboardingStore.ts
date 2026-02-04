import { writable, derived, get } from 'svelte/store';

const ONBOARDING_SEEN_KEY = 'g-rump-onboarding-seen';

function loadOnboardingSeen(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(ONBOARDING_SEEN_KEY);
    if (stored === null) return false;
    return stored === 'true';
  } catch {
    return false;
  }
}

const onboardingSeen = writable<boolean>(loadOnboardingSeen());

export const onboardingSeenOnDevice = derived(onboardingSeen, ($v) => $v);

export const onboardingStore = {
  isOnboardingSeenOnDevice: (): boolean => get(onboardingSeen),

  markOnboardingSeenOnDevice: (): void => {
    onboardingSeen.set(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
      }
    } catch (e) {
      console.warn('Failed to persist onboarding seen:', e);
    }
  },

  resetOnboarding: (): void => {
    onboardingSeen.set(false);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(ONBOARDING_SEEN_KEY);
      }
    } catch (e) {
      console.warn('Failed to reset onboarding:', e);
    }
  },
};

export default onboardingSeenOnDevice;
