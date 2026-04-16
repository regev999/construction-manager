import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl === 'your-supabase-url' || !supabaseUrl.startsWith('http')) {
    return NextResponse.next()
  }

  // Allow access if dev mode cookie is set
  if (request.cookies.get('bm_dev_role')?.value) {
    return NextResponse.next()
  }

  // Determine if the user has an active session by checking for the Supabase
  // auth cookie directly — zero network calls, runs instantly in edge middleware.
  // The cookie name is sb-{project-ref}-auth-token (set by @supabase/ssr).
  let projectRef: string
  try {
    projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  } catch {
    return NextResponse.next()
  }
  const hasSession =
    request.cookies.has(`sb-${projectRef}-auth-token`) ||
    request.cookies.has(`sb-${projectRef}-auth-token.0`) // chunked cookie

  const isAuthPage = request.nextUrl.pathname.startsWith('/auth')

  if (!hasSession && !isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  if (hasSession && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
