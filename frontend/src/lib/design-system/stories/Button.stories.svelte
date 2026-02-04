<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Button from '../components/Button/Button.svelte';

  const { Story } = defineMeta({
    title: 'Design System/Button',
    component: Button,
    tags: ['autodocs'],
    argTypes: {
      variant: {
        control: 'select',
        options: ['primary', 'secondary', 'ghost', 'danger'],
      },
      size: {
        control: 'select',
        options: ['sm', 'md', 'lg'],
      },
      disabled: { control: 'boolean' },
      loading: { control: 'boolean' },
      fullWidth: { control: 'boolean' },
    },
  });
</script>

<Story name="Primary" args={{ variant: 'primary' }}>
  {#snippet children(args)}
    <Button {...args}>Primary Button</Button>
  {/snippet}
</Story>

<Story name="Secondary" args={{ variant: 'secondary' }}>
  {#snippet children(args)}
    <Button {...args}>Secondary Button</Button>
  {/snippet}
</Story>

<Story name="Ghost" args={{ variant: 'ghost' }}>
  {#snippet children(args)}
    <Button {...args}>Ghost Button</Button>
  {/snippet}
</Story>

<Story name="Danger" args={{ variant: 'danger' }}>
  {#snippet children(args)}
    <Button {...args}>Delete</Button>
  {/snippet}
</Story>

<Story name="Small" args={{ variant: 'primary', size: 'sm' }}>
  {#snippet children(args)}
    <Button {...args}>Small Button</Button>
  {/snippet}
</Story>

<Story name="Large" args={{ variant: 'primary', size: 'lg' }}>
  {#snippet children(args)}
    <Button {...args}>Large Button</Button>
  {/snippet}
</Story>

<Story name="Loading" args={{ variant: 'primary', loading: true }}>
  {#snippet children(args)}
    <Button {...args}>Loading...</Button>
  {/snippet}
</Story>

<Story name="Disabled" args={{ variant: 'primary', disabled: true }}>
  {#snippet children(args)}
    <Button {...args}>Disabled</Button>
  {/snippet}
</Story>

<Story name="Full Width" args={{ variant: 'primary', fullWidth: true }}>
  {#snippet children(args)}
    <Button {...args}>Full Width Button</Button>
  {/snippet}
</Story>

<Story name="All Variants">
  {#snippet children()}
    <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  {/snippet}
</Story>
