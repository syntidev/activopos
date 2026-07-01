'use client'

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import styles from '../admin.module.css'

interface RegistrationsChartProps {
  data: { date: string; count: number }[]
}

export function RegistrationsChart({ data }: RegistrationsChartProps) {
  const chartData = data.map(d => ({ ...d, label: d.date.slice(5) }))

  return (
    <div className={styles.chartCard}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#52525b" fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} width={30} />
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#e4e4e7' }}
            itemStyle={{ color: '#e4e4e7' }}
          />
          <Bar dataKey="count" fill="#0038BD" radius={[3, 3, 0, 0]} name="Registros" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
