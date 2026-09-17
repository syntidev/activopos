import { Fraunces } from 'next/font/google'

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['700', '900'],
  variable: '--font-fraunces',
  display: 'swap',
})

export default function CatalogoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className={fraunces.variable}>{children}</div>
}
