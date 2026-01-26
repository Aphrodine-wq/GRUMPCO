import { describe, it, expect, beforeEach } from 'vitest';
import { useAppFlow, resetAppFlowState, SCREENS } from '../useAppFlow';
import { resetMocks } from '../../tests/setup';

describe('useAppFlow', () => {
  beforeEach(() => {
    resetMocks();
    resetAppFlowState();
  });

  describe('initial state', () => {
    it('should start on splash screen', () => {
      const { currentScreen } = useAppFlow();
      expect(currentScreen.value).toBe(SCREENS.SPLASH);
    });

    it('should have apiKeyValid as false initially', () => {
      const { apiKeyValid } = useAppFlow();
      expect(apiKeyValid.value).toBe(false);
    });

    it('should have hasCompletedSetup as false initially', () => {
      const { hasCompletedSetup } = useAppFlow();
      expect(hasCompletedSetup.value).toBe(false);
    });

    it('should have no lastSession initially', () => {
      const { lastSession } = useAppFlow();
      expect(lastSession.value).toBeNull();
    });
  });

  describe('computed properties', () => {
    it('isLoading should be true when on splash screen', () => {
      const { isLoading } = useAppFlow();
      expect(isLoading.value).toBe(true);
    });

    it('needsAuth should be true when apiKeyValid is false', () => {
      const { needsAuth } = useAppFlow();
      expect(needsAuth.value).toBe(true);
    });

    it('needsSetup should be true when hasCompletedSetup is false', () => {
      const { needsSetup } = useAppFlow();
      expect(needsSetup.value).toBe(true);
    });

    it('hasSession should be false when lastSession is null', () => {
      const { hasSession } = useAppFlow();
      expect(hasSession.value).toBe(false);
    });
  });

  describe('completeSplash', () => {
    it('should go to auth screen when api key is not valid', () => {
      const { currentScreen, completeSplash } = useAppFlow();
      completeSplash();
      expect(currentScreen.value).toBe(SCREENS.AUTH);
    });

    it('should go to setup screen when api key is valid but setup not completed', () => {
      const { currentScreen, completeSplash, apiKeyValid } = useAppFlow();
      apiKeyValid.value = true;
      completeSplash();
      expect(currentScreen.value).toBe(SCREENS.SETUP);
    });

    it('should go to main screen when api key valid and setup completed', () => {
      const { currentScreen, completeSplash, apiKeyValid, hasCompletedSetup } = useAppFlow();
      apiKeyValid.value = true;
      hasCompletedSetup.value = true;
      completeSplash();
      expect(currentScreen.value).toBe(SCREENS.MAIN);
    });

    it('should go to resume screen when has session', () => {
      const { currentScreen, completeSplash, apiKeyValid, hasCompletedSetup, lastSession } = useAppFlow();
      apiKeyValid.value = true;
      hasCompletedSetup.value = true;
      lastSession.value = { messages: [], timestamp: Date.now() };
      completeSplash();
      expect(currentScreen.value).toBe(SCREENS.RESUME);
    });
  });

  describe('setApiKeyValid', () => {
    it('should go to setup screen when valid and setup not completed', () => {
      const { currentScreen, setApiKeyValid } = useAppFlow();
      setApiKeyValid(true);
      expect(currentScreen.value).toBe(SCREENS.SETUP);
    });

    it('should go to main screen when valid and setup already completed', () => {
      const { currentScreen, setApiKeyValid, hasCompletedSetup } = useAppFlow();
      hasCompletedSetup.value = true;
      setApiKeyValid(true);
      expect(currentScreen.value).toBe(SCREENS.MAIN);
    });
  });

  describe('session management', () => {
    it('saveSession should store messages', () => {
      const { lastSession, saveSession, hasSession } = useAppFlow();
      const messages = [{ role: 'user' as const, content: 'test' }];
      saveSession(messages);
      expect(lastSession.value?.messages).toEqual(messages);
      expect(hasSession.value).toBe(true);
    });

    it('clearSession should remove session', () => {
      const { lastSession, saveSession, clearSession, hasSession } = useAppFlow();
      saveSession([{ role: 'user' as const, content: 'test' }]);
      clearSession();
      expect(lastSession.value).toBeNull();
      expect(hasSession.value).toBe(false);
    });
  });

  describe('resetApp', () => {
    it('should reset all state to initial values', () => {
      const flow = useAppFlow();
      
      // Set some state
      flow.apiKeyValid.value = true;
      flow.hasCompletedSetup.value = true;
      flow.saveSession([{ role: 'user' as const, content: 'test' }]);
      flow.goToScreen(SCREENS.MAIN);
      
      // Reset
      flow.resetApp();
      
      expect(flow.currentScreen.value).toBe(SCREENS.SPLASH);
      expect(flow.apiKeyValid.value).toBe(false);
      expect(flow.hasCompletedSetup.value).toBe(false);
      expect(flow.lastSession.value).toBeNull();
    });
  });

  describe('navigation', () => {
    it('goToScreen should change current screen', () => {
      const { currentScreen, goToScreen } = useAppFlow();
      goToScreen(SCREENS.AUTH);
      expect(currentScreen.value).toBe(SCREENS.AUTH);
    });

    it('completeSetup should go to resume if has session', () => {
      const { currentScreen, completeSetup, lastSession } = useAppFlow();
      lastSession.value = { messages: [], timestamp: Date.now() };
      completeSetup();
      expect(currentScreen.value).toBe(SCREENS.RESUME);
    });

    it('completeSetup should go to main if no session', () => {
      const { currentScreen, completeSetup } = useAppFlow();
      completeSetup();
      expect(currentScreen.value).toBe(SCREENS.MAIN);
    });

    it('skipSetup should go to main', () => {
      const { currentScreen, skipSetup, hasCompletedSetup } = useAppFlow();
      skipSetup();
      expect(currentScreen.value).toBe(SCREENS.MAIN);
      expect(hasCompletedSetup.value).toBe(true);
    });

    it('continueSession should go to main', () => {
      const { currentScreen, continueSession, goToScreen } = useAppFlow();
      goToScreen(SCREENS.RESUME);
      continueSession();
      expect(currentScreen.value).toBe(SCREENS.MAIN);
    });

    it('startNewSession should clear session and go to main', () => {
      const { currentScreen, startNewSession, saveSession, lastSession } = useAppFlow();
      saveSession([{ role: 'user' as const, content: 'test' }]);
      startNewSession();
      expect(currentScreen.value).toBe(SCREENS.MAIN);
      expect(lastSession.value).toBeNull();
    });
  });
});
