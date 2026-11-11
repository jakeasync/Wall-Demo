import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Facebook | The Wall (2008 Edition)',
  description: 'A pixel-perfect retro 2008 Facebook Wall built with Next.js, React 19, Supabase Realtime, and Tailwind CSS.',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f7f7f7] text-[#333333] antialiased">
        {children}
      </body>
    </html>
  )
}
