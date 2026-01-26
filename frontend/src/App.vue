<template>
  <div class="app">
    <!-- Toast Notifications -->
    <Toast />
    
    <!-- Screen Transitions -->
    <Transition name="fade" mode="out-in">
      <!-- Splash Screen -->
      <SplashScreen 
        v-if="currentScreen === SCREENS.SPLASH" 
        @complete="completeSplash" 
        key="splash"
      />
      
      <!-- Auth Screen -->
      <AuthScreen 
        v-else-if="currentScreen === SCREENS.AUTH" 
        @validated="setApiKeyValid" 
        key="auth"
      />
      
      <!-- Setup Screen / Onboarding Wizard -->
      <OnboardingWizard 
        v-else-if="currentScreen === SCREENS.SETUP" 
        @complete="handleSetupComplete"
        @skip="handleSetupSkip"
        key="setup"
      />
      
      <!-- Resume Screen -->
      <ResumeScreen 
        v-else-if="currentScreen === SCREENS.RESUME"
        :lastSession="lastSession ?? undefined"
        @continue="handleContinueSession"
        @new="startNewSession"
        key="resume"
      />
      
      <!-- Main App -->
      <div v-else class="main-app" key="main">
        <MinimalHeader @new-chat="handleNewChat" />
        <div class="main-layout">
          <SessionSidebar 
            @session-selected="handleSessionSelected"
            @new-session="handleNewSession"
          />
          <ChatInterface 
            :key="chatKey"
            :initialMessages="getCurrentMessages() ?? undefined"
            :preferences="preferences ?? undefined"
            :initialPrompt="initialPrompt ?? undefined"
            @messages-updated="handleMessagesUpdate"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, watch, ref } from 'vue';
import { useAppFlow, SCREENS } from './composables/useAppFlow';
import { useAnalytics } from './composables/useAnalytics';
import { useSessions } from './composables/useSessions';
import type { Message, UserPreferences } from './types';
import Toast from './components/Toast.vue';

// Keep SplashScreen static for immediate render
import SplashScreen from './components/SplashScreen.vue';

// Lazy load other screens for better initial bundle size
const AuthScreen = defineAsyncComponent(() => 
  import('./components/AuthScreen.vue')
);
const OnboardingWizard = defineAsyncComponent(() => 
  import('./components/OnboardingWizard.vue')
);
const ResumeScreen = defineAsyncComponent(() => 
  import('./components/ResumeScreen.vue')
);
const MinimalHeader = defineAsyncComponent(() => 
  import('./components/MinimalHeader.vue')
);
const SessionSidebar = defineAsyncComponent(() => 
  import('./components/SessionSidebar.vue')
);
const ChatInterface = defineAsyncComponent(() => 
  import('./components/ChatInterface.vue')
);

const {
  currentScreen,
  lastSession,
  preferences,
  completeSplash,
  setApiKeyValid,
  completeSetup,
  skipSetup,
  continueSession,
  startNewSession,
  saveSession,
  clearSession
} = useAppFlow();

const { trackScreenView, trackSessionResume, trackSetupComplete, trackSetupSkipped } = useAnalytics();

const { 
  currentSession, 
  currentSessionId,
  createSession, 
  updateSession
} = useSessions();

// Store initial prompt from wizard
const initialPrompt = ref<string | null>(null);

// Key to force ChatInterface re-render on session switch
const chatKey = ref(0);

// Track screen views
watch(currentScreen, (screen) => {
  trackScreenView(screen);
}, { immediate: true });

function getCurrentMessages(): Message[] | null {
  // Prefer current session from useSessions
  if (currentSession.value?.messages) {
    return currentSession.value.messages;
  }
  // Fallback to legacy lastSession from useAppFlow
  if (lastSession.value?.messages) {
    return lastSession.value.messages;
  }
  return null;
}

function handleMessagesUpdate(messages: Message[]): void {
  if (messages.length > 1) {
    // Update current session or create new one
    if (currentSessionId.value) {
      updateSession(currentSessionId.value, messages);
    } else {
      createSession(messages);
    }
    // Also save to legacy storage for backward compatibility
    saveSession(messages);
  }
}

function handleSessionSelected(_id: string): void {
  // Force re-render of ChatInterface with new session
  initialPrompt.value = null;
  chatKey.value++;
}

function handleNewSession(): void {
  createSession([]);
  initialPrompt.value = null;
  chatKey.value++;
}

function handleNewChat(): void {
  createSession([]);
  clearSession();
  initialPrompt.value = null;
  chatKey.value++;
}

function handleSetupComplete(data: { preferences: UserPreferences; initialPrompt?: string }): void {
  trackSetupComplete(data.preferences);
  if (data.initialPrompt) {
    initialPrompt.value = data.initialPrompt;
  }
  completeSetup(data.preferences);
}

function handleSetupSkip(): void {
  trackSetupSkipped();
  skipSetup();
}

function handleContinueSession(): void {
  const messageCount = lastSession.value?.messages?.length || 0;
  trackSessionResume(messageCount);
  continueSession();
}
</script>

<style scoped>
.app {
  min-height: 100vh;
  background: #F5F5F5;
  display: flex;
  flex-direction: column;
}

.main-app {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 100vh;
}

.main-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Screen transitions use global classes from style.css */
</style>
