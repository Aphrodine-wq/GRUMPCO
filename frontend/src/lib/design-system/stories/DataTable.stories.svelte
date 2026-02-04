<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import DataTable from '../components/DataTable/DataTable.svelte';

  const { Story } = defineMeta({
    title: 'Design System/DataTable',
    component: DataTable,
    tags: ['autodocs'],
    argTypes: {
      loading: { control: 'boolean' },
      compact: { control: 'boolean' },
      selectable: { control: 'boolean' },
    },
  });
</script>

<script>
  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'role', label: 'Role', sortable: true },
    { key: 'status', label: 'Status' },
  ];

  const rows = [
    { id: '1', name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'Active' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'User', status: 'Active' },
    { id: '3', name: 'Bob Johnson', email: 'bob@example.com', role: 'User', status: 'Inactive' },
    { id: '4', name: 'Alice Brown', email: 'alice@example.com', role: 'Editor', status: 'Active' },
    {
      id: '5',
      name: 'Charlie Wilson',
      email: 'charlie@example.com',
      role: 'User',
      status: 'Pending',
    },
  ];

  const modelColumns = [
    { key: 'name', label: 'Model', sortable: true },
    { key: 'provider', label: 'Provider', sortable: true },
    { key: 'contextWindow', label: 'Context', sortable: true },
    { key: 'costPer1k', label: 'Cost/1K tokens' },
  ];

  const modelRows = [
    { id: '1', name: 'GPT-4o', provider: 'OpenAI', contextWindow: '128K', costPer1k: '$0.005' },
    {
      id: '2',
      name: 'Claude 3.5 Sonnet',
      provider: 'Anthropic',
      contextWindow: '200K',
      costPer1k: '$0.003',
    },
    { id: '3', name: 'Gemini Pro', provider: 'Google', contextWindow: '32K', costPer1k: '$0.001' },
    {
      id: '4',
      name: 'Llama 3.1 70B',
      provider: 'Meta',
      contextWindow: '128K',
      costPer1k: '$0.0008',
    },
  ];
</script>

<Story name="Default">
  {#snippet children()}
    <DataTable {columns} {rows} />
  {/snippet}
</Story>

<Story name="With Selection">
  {#snippet children()}
    <DataTable {columns} {rows} selectable />
  {/snippet}
</Story>

<Story name="Compact">
  {#snippet children()}
    <DataTable {columns} {rows} compact />
  {/snippet}
</Story>

<Story name="Loading">
  {#snippet children()}
    <DataTable {columns} rows={[]} loading />
  {/snippet}
</Story>

<Story name="Empty State">
  {#snippet children()}
    <DataTable {columns} rows={[]} emptyMessage="No users found" />
  {/snippet}
</Story>

<Story name="Model Comparison">
  {#snippet children()}
    <DataTable columns={modelColumns} rows={modelRows} />
  {/snippet}
</Story>

<Story name="With Pagination">
  {#snippet children()}
    <DataTable {columns} {rows} pagination={{ page: 1, pageSize: 3, total: 5 }} />
  {/snippet}
</Story>
