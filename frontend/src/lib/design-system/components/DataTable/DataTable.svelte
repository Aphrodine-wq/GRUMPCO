<script lang="ts">
  /**
   * G-Rump Design System - DataTable Component
   * A flexible, sortable, and paginated data table
   */
  import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-svelte';

  interface Column<T = Record<string, unknown>> {
    key: string;
    label: string;
    sortable?: boolean;
    width?: string;
    align?: 'left' | 'center' | 'right';
    render?: (value: unknown, row: T, index: number) => string;
  }

  interface Props<T = Record<string, unknown>> {
    columns: Column<T>[];
    data: T[];
    sortable?: boolean;
    paginated?: boolean;
    pageSize?: number;
    striped?: boolean;
    hoverable?: boolean;
    compact?: boolean;
    emptyMessage?: string;
    loading?: boolean;
    onRowClick?: (row: T, index: number) => void;
    selectedRows?: Set<number>;
    selectable?: boolean;
    onSelectionChange?: (selected: Set<number>) => void;
  }

  let {
    columns,
    data,
    sortable = false,
    paginated = false,
    pageSize = 10,
    striped = true,
    hoverable = true,
    compact = false,
    emptyMessage = 'No data available',
    loading = false,
    onRowClick,
    selectedRows = new Set<number>(),
    selectable = false,
    onSelectionChange,
  }: Props = $props();

  // Sorting state
  let sortKey = $state<string | null>(null);
  let sortDirection = $state<'asc' | 'desc'>('asc');

  // Pagination state
  let currentPage = $state(1);

  // Derived values
  const sortedData = $derived.by(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey!];
      const bVal = (b as Record<string, unknown>)[sortKey!];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  });

  const totalPages = $derived(Math.ceil(sortedData.length / pageSize));

  const paginatedData = $derived.by(() => {
    if (!paginated) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  });

  const allSelected = $derived(
    selectable &&
      paginatedData.length > 0 &&
      paginatedData.every((_, i) => selectedRows.has((currentPage - 1) * pageSize + i))
  );

  function handleSort(key: string) {
    if (!sortable) return;
    const column = columns.find((c) => c.key === key);
    if (!column?.sortable && column?.sortable !== undefined) return;

    if (sortKey === key) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDirection = 'asc';
    }
  }

  function handleRowClick(row: unknown, index: number) {
    const actualIndex = paginated ? (currentPage - 1) * pageSize + index : index;
    onRowClick?.(row as Record<string, unknown>, actualIndex);
  }

  function toggleRowSelection(index: number) {
    const actualIndex = paginated ? (currentPage - 1) * pageSize + index : index;
    const newSelection = new Set(selectedRows);
    if (newSelection.has(actualIndex)) {
      newSelection.delete(actualIndex);
    } else {
      newSelection.add(actualIndex);
    }
    onSelectionChange?.(newSelection);
  }

  function toggleAllSelection() {
    const newSelection = new Set(selectedRows);
    const startIndex = (currentPage - 1) * pageSize;

    if (allSelected) {
      // Deselect all on current page
      paginatedData.forEach((_, i) => newSelection.delete(startIndex + i));
    } else {
      // Select all on current page
      paginatedData.forEach((_, i) => newSelection.add(startIndex + i));
    }
    onSelectionChange?.(newSelection);
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }

  function getCellValue(row: unknown, column: Column): string {
    const value = (row as Record<string, unknown>)[column.key];
    if (column.render) {
      const index = data.indexOf(row as Record<string, unknown>);
      return column.render(value, row as Record<string, unknown>, index);
    }
    if (value === null || value === undefined) return '';
    return String(value);
  }
</script>

<div class="datatable-container" class:compact>
  <div class="table-wrapper">
    <table class="datatable" class:striped class:hoverable>
      <thead>
        <tr>
          {#if selectable}
            <th class="checkbox-cell">
              <input
                type="checkbox"
                checked={allSelected}
                onchange={toggleAllSelection}
                aria-label="Select all rows"
              />
            </th>
          {/if}
          {#each columns as column}
            <th
              class:sortable={sortable && column.sortable !== false}
              class:sorted={sortKey === column.key}
              style:width={column.width}
              style:text-align={column.align ?? 'left'}
              onclick={() => sortable && column.sortable !== false && handleSort(column.key)}
            >
              <div class="th-content">
                <span>{column.label}</span>
                {#if sortable && column.sortable !== false}
                  <span class="sort-icon">
                    {#if sortKey === column.key}
                      {#if sortDirection === 'asc'}
                        <ChevronUp size={14} />
                      {:else}
                        <ChevronDown size={14} />
                      {/if}
                    {:else}
                      <ChevronsUpDown size={14} />
                    {/if}
                  </span>
                {/if}
              </div>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#if loading}
          <tr class="loading-row">
            <td colspan={columns.length + (selectable ? 1 : 0)}>
              <div class="loading-content">
                <div class="loading-spinner"></div>
                <span>Loading...</span>
              </div>
            </td>
          </tr>
        {:else if paginatedData.length === 0}
          <tr class="empty-row">
            <td colspan={columns.length + (selectable ? 1 : 0)}>
              <div class="empty-content">
                {emptyMessage}
              </div>
            </td>
          </tr>
        {:else}
          {#each paginatedData as row, index}
            {@const actualIndex = paginated ? (currentPage - 1) * pageSize + index : index}
            <tr
              class:selected={selectedRows.has(actualIndex)}
              class:clickable={!!onRowClick}
              onclick={() => handleRowClick(row, index)}
            >
              {#if selectable}
                <td class="checkbox-cell" onclick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedRows.has(actualIndex)}
                    onchange={() => toggleRowSelection(index)}
                    aria-label="Select row"
                  />
                </td>
              {/if}
              {#each columns as column}
                <td style:text-align={column.align ?? 'left'}>
                  {getCellValue(row, column)}
                </td>
              {/each}
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>

  {#if paginated && totalPages > 1}
    <div class="pagination">
      <span class="pagination-info">
        Showing {(currentPage - 1) * pageSize + 1} to {Math.min(
          currentPage * pageSize,
          sortedData.length
        )} of {sortedData.length}
      </span>
      <div class="pagination-controls">
        <button
          class="pagination-btn"
          disabled={currentPage === 1}
          onclick={() => goToPage(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        {#each Array(Math.min(5, totalPages)) as _, i}
          {@const pageNum =
            currentPage <= 3
              ? i + 1
              : currentPage >= totalPages - 2
                ? totalPages - 4 + i
                : currentPage - 2 + i}
          {#if pageNum >= 1 && pageNum <= totalPages}
            <button
              class="pagination-btn"
              class:active={pageNum === currentPage}
              onclick={() => goToPage(pageNum)}
            >
              {pageNum}
            </button>
          {/if}
        {/each}

        <button
          class="pagination-btn"
          disabled={currentPage === totalPages}
          onclick={() => goToPage(currentPage + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .datatable-container {
    width: 100%;
    background: white;
    border: 1px solid #e4e4e7;
    border-radius: 12px;
    overflow: hidden;
  }

  .table-wrapper {
    overflow-x: auto;
  }

  .datatable {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .compact .datatable {
    font-size: 13px;
  }

  /* Header */
  thead {
    background: #fafafa;
    border-bottom: 1px solid #e4e4e7;
  }

  th {
    padding: 12px 16px;
    font-weight: 600;
    color: #3f3f46;
    text-align: left;
    white-space: nowrap;
  }

  .compact th {
    padding: 8px 12px;
  }

  th.sortable {
    cursor: pointer;
    user-select: none;
    transition: background 150ms ease;
  }

  th.sortable:hover {
    background: #f4f4f5;
  }

  th.sorted {
    color: #7c3aed;
  }

  .th-content {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .sort-icon {
    display: flex;
    color: #a1a1aa;
  }

  th.sorted .sort-icon {
    color: #7c3aed;
  }

  /* Body */
  td {
    padding: 12px 16px;
    color: #18181b;
    border-bottom: 1px solid #f4f4f5;
  }

  .compact td {
    padding: 8px 12px;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  .striped tbody tr:nth-child(even) {
    background: #fafafa;
  }

  .hoverable tbody tr:hover {
    background: #f8f5ff;
  }

  tr.selected {
    background: #f3e8ff !important;
  }

  tr.clickable {
    cursor: pointer;
  }

  /* Checkbox cell */
  .checkbox-cell {
    width: 40px;
    padding: 12px;
    text-align: center;
  }

  .compact .checkbox-cell {
    padding: 8px;
  }

  .checkbox-cell input[type='checkbox'] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: #7c3aed;
  }

  /* Empty and loading states */
  .empty-row td,
  .loading-row td {
    padding: 48px 16px;
    text-align: center;
  }

  .empty-content {
    color: #a1a1aa;
    font-size: 14px;
  }

  .loading-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #71717a;
  }

  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e4e4e7;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Pagination */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-top: 1px solid #e4e4e7;
    background: #fafafa;
  }

  .pagination-info {
    font-size: 13px;
    color: #71717a;
  }

  .pagination-controls {
    display: flex;
    gap: 4px;
  }

  .pagination-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    padding: 0 8px;
    background: white;
    border: 1px solid #e4e4e7;
    border-radius: 6px;
    color: #3f3f46;
    font-size: 13px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .pagination-btn:hover:not(:disabled) {
    background: #f4f4f5;
    border-color: #d4d4d8;
  }

  .pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pagination-btn.active {
    background: #7c3aed;
    border-color: #7c3aed;
    color: white;
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation: none;
    }
  }
</style>
