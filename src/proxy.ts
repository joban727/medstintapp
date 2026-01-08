import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
    '/dashboard(.*)',
    '/onboarding(.*)',
    '/api/((?!webhooks).*)',
]);

// Security headers to prevent "not secure" warnings and grayware flagging
const securityHeaders = {
    // Strict Transport Security - Force HTTPS
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    // Prevent clickjacking
    "X-Frame-Options": "DENY",
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",
    // XSS Protection
    "X-XSS-Protection": "1; mode=block",
    // Referrer Policy
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Permissions Policy - Disable unnecessary features
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(self), payment=()",
    // Content Security Policy - Secure but compatible
    "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://clerk.com https://*.clerk.accounts.dev https://challenges.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data: https://fonts.gstatic.com",
        "connect-src 'self' https://clerk.com https://*.clerk.accounts.dev https://api.clerk.com wss://*.clerk.accounts.dev",
        "frame-src 'self' https://clerk.com https://*.clerk.accounts.dev https://challenges.cloudflare.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
    ].join("; "),
};

export default clerkMiddleware(async (auth, req) => {
    // Handle protected routes
    if (isProtectedRoute(req)) {
        const { userId, redirectToSignIn } = await auth();
        if (!userId) {
            return redirectToSignIn();
        }
    }

    // Create response with security headers
    const response = NextResponse.next();

    // Apply all security headers
    for (const [key, value] of Object.entries(securityHeaders)) {
        response.headers.set(key, value);
    }

    return response;
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
};
