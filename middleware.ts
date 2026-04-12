import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuth } from './lib/auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 로그인 페이지
  if (pathname === '/login') {
    const { role } = getAuth(request);
    if (role) {
      return NextResponse.redirect(new URL('/staff', request.url));
    }
    return NextResponse.next();
  }

  // 보호된 페이지들
  if (pathname.startsWith('/staff') || pathname.startsWith('/admin') || pathname.startsWith('/pos')) {
    const { role } = getAuth(request);
    if (!role) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/staff/:path*',
    '/admin/:path*',
    '/pos/:path*',
  ],
};
