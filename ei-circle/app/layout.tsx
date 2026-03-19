import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'The EI Circle — Exposure It Rewards',
  description: 'Client rewards portal for Exposure It Real Estate Media',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen relative">
        {children}
      </body>
    </html>
  )
}
