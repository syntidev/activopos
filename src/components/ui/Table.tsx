import type { ReactNode } from 'react'
import { Skeleton } from './Skeleton'
import { EmptyState } from './EmptyState'
import { FileX } from 'lucide-react'
import styles from './Table.module.css'

export interface TableColumn<T> {
  key: string
  header: string
  render?: (row: T, index: number) => ReactNode
  align?: 'left' | 'center' | 'right'
  width?: string
}

export interface TableProps<T extends Record<string, unknown>> {
  columns: TableColumn<T>[]
  data: T[]
  loading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  keyExtractor?: (row: T, index: number) => string
}

const SKELETON_ROWS = 5

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyTitle = 'Sin resultados',
  emptyDescription,
  keyExtractor,
}: TableProps<T>) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.scrollArea}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={styles.th}
                  style={{ width: col.width, textAlign: col.align ?? 'left' }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className={styles.tbody}>
            {loading ? (
              Array.from({ length: SKELETON_ROWS }).map((_, ri) => (
                <tr key={`skel-${ri}`} className={styles.skeletonRow} aria-hidden="true">
                  {columns.map((col) => (
                    <td key={col.key} className={styles.td}>
                      <Skeleton variant="text" height="14px" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={styles.emptyCell}>
                  <EmptyState
                    icon={FileX}
                    title={emptyTitle}
                    description={emptyDescription}
                  />
                </td>
              </tr>
            ) : (
              data.map((row, ri) => {
                const rowKey = keyExtractor ? keyExtractor(row, ri) : String(ri)
                return (
                  <tr key={rowKey} className={styles.row}>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={styles.td}
                        style={{ textAlign: col.align ?? 'left' }}
                      >
                        {col.render
                          ? col.render(row, ri)
                          : (row[col.key] as ReactNode)}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
