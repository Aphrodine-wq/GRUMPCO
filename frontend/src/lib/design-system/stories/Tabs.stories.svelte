<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Tabs from '../components/Tabs/Tabs.svelte';
  import Accordion from '../components/Tabs/Accordion.svelte';
  import { Settings, User, Bell, Shield } from 'lucide-svelte';

  const { Story } = defineMeta({
    title: 'Design System/Tabs & Accordion',
    component: Tabs,
    tags: ['autodocs'],
  });
</script>

<script>
  let activeTab1 = $state('general');
  let activeTab2 = $state('profile');

  const basicTabs = [
    { id: 'general', label: 'General' },
    { id: 'advanced', label: 'Advanced' },
    { id: 'about', label: 'About' },
  ];

  const iconTabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  const accordionItems = [
    {
      id: 'what',
      title: 'What is G-Rump?',
      content:
        'G-Rump is an AI-powered development platform that helps you build applications faster.',
    },
    {
      id: 'how',
      title: 'How does it work?',
      content:
        'Simply describe what you want to build, and G-Rump will generate the code, explain its reasoning, and help you iterate.',
    },
    {
      id: 'pricing',
      title: 'Is it free?',
      content:
        'G-Rump offers a free tier with limited usage. Pro plans are available for power users and teams.',
    },
  ];
</script>

<Story name="Basic Tabs">
  {#snippet children()}
    <div style="width: 500px;">
      <Tabs tabs={basicTabs} bind:activeTab={activeTab1} />
      <div
        style="padding: 16px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;"
      >
        {#if activeTab1 === 'general'}
          <p>General settings content goes here.</p>
        {:else if activeTab1 === 'advanced'}
          <p>Advanced settings content goes here.</p>
        {:else}
          <p>About information goes here.</p>
        {/if}
      </div>
    </div>
  {/snippet}
</Story>

<Story name="Tabs with Icons">
  {#snippet children()}
    <div style="width: 600px;">
      <Tabs tabs={iconTabs} bind:activeTab={activeTab2} />
      <div
        style="padding: 16px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;"
      >
        <p>Content for: <strong>{activeTab2}</strong></p>
      </div>
    </div>
  {/snippet}
</Story>

<Story name="Accordion">
  {#snippet children()}
    <div style="width: 500px;">
      <Accordion items={accordionItems} />
    </div>
  {/snippet}
</Story>

<Story name="Accordion - Multiple Open">
  {#snippet children()}
    <div style="width: 500px;">
      <Accordion items={accordionItems} multiple />
    </div>
  {/snippet}
</Story>
