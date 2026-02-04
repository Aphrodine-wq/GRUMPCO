<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Input from '../components/Input/Input.svelte';

  const { Story } = defineMeta({
    title: 'Design System/Input',
    component: Input,
    tags: ['autodocs'],
    argTypes: {
      type: {
        control: 'select',
        options: ['text', 'email', 'password', 'number', 'search', 'url', 'tel'],
      },
      size: {
        control: 'select',
        options: ['sm', 'md', 'lg'],
      },
      disabled: { control: 'boolean' },
      error: { control: 'text' },
      placeholder: { control: 'text' },
      label: { control: 'text' },
      hint: { control: 'text' },
    },
  });
</script>

<Story name="Default" args={{ placeholder: 'Enter text...' }}>
  {#snippet children(args)}
    <Input {...args} />
  {/snippet}
</Story>

<Story
  name="With Label"
  args={{ label: 'Email Address', placeholder: 'you@example.com', type: 'email' }}
>
  {#snippet children(args)}
    <Input {...args} />
  {/snippet}
</Story>

<Story
  name="With Hint"
  args={{ label: 'Password', type: 'password', hint: 'Must be at least 8 characters' }}
>
  {#snippet children(args)}
    <Input {...args} />
  {/snippet}
</Story>

<Story
  name="With Error"
  args={{ label: 'Email', placeholder: 'Enter email', error: 'Please enter a valid email address' }}
>
  {#snippet children(args)}
    <Input {...args} />
  {/snippet}
</Story>

<Story
  name="Disabled"
  args={{ label: 'Disabled Input', placeholder: 'Cannot edit', disabled: true }}
>
  {#snippet children(args)}
    <Input {...args} />
  {/snippet}
</Story>

<Story name="Small" args={{ placeholder: 'Small input', size: 'sm' }}>
  {#snippet children(args)}
    <Input {...args} />
  {/snippet}
</Story>

<Story name="Large" args={{ placeholder: 'Large input', size: 'lg' }}>
  {#snippet children(args)}
    <Input {...args} />
  {/snippet}
</Story>

<Story name="Search Type" args={{ type: 'search', placeholder: 'Search...' }}>
  {#snippet children(args)}
    <Input {...args} />
  {/snippet}
</Story>
