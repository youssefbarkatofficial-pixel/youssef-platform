import type { ReactNode } from 'react';
import { cn } from './cn';
import Spinner from './Spinner';

export interface TableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
}

export default function Table<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyMessage = 'لا توجد بيانات',
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-card border border-theme-border bg-theme-surface shadow-soft">
      <table className="w-full text-start text-sm">
        <thead className="bg-theme-surface-hover text-theme-text-secondary">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={cn('px-4 py-3 text-start font-bold', column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-theme-gold">
                <Spinner />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-theme-text-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-theme-border/60 hover:bg-theme-surface-hover/50 transition-colors">
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-4 py-3 text-theme-text', column.className)}>
                    {column.render
                      ? column.render(row)
                      : String((row as unknown as Record<string, unknown>)[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
