import { NextResponse } from 'next/server'

export function middleware(request) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
    const cookies = request.cookies.getAll()
    const hasSession = cookies.some(c => 
      c.name.startsWith('sb-') && 
      (c.name.includes('auth-token') || c.name.includes('session'))
    )
    if (!hasSession) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
}