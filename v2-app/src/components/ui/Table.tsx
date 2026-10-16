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
    <div className="overflow-x-auto rounded-2xl border border-navy-700/60 bg-navy-900">
      <table className="w-full text-start text-sm">
        <thead className="bg-navy-800 text-slate-300">
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
              <td colSpan={columns.length} className="px-4 py-10 text-center text-gold-400">
                <Spinner />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-navy-800 hover:bg-navy-800/50">
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-4 py-3 text-slate-200', column.className)}>
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
