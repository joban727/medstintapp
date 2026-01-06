/**
 * Comprehensive Security Utilities
 * Provides CSRF protection, security headers, input validation,
 * and other security measures for the application
 */

import crypto from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { logger } from "./logger"

// Security configuration
export interface SecurityConfig {
  csrf: {
    enabled: boolean
    tokenLength: number
    cookieName: string
    headerName: string
    sameSite: "strict" | "lax" | "none"
    secure: boolean
    httpOnly: boolean
  }
  headers: {
    hsts: {
      enabled: boolean
      maxAge: number
      includeSubDomains: boolean
      preload: boolean
    }
    csp: {
      enabled: boolean
      directives: Record<string, string[]>
    }
    frameOptions: "DENY" | "SAMEORIGIN" | "ALLOW-FROM"
    contentTypeOptions: boolean
    referrerPolicy: string
    permissionsPolicy: Record<string, string[]>
  }
  validation: {
    maxRequestSize: number // in bytes
    allowedMethods: string[]
    blockedUserAgents: RegExp[]
    suspiciousPatterns: RegExp[]
  }
}

// Default security configuration
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  csrf: {
    enabled: true,
    tokenLength: 32,
    cookieName: "__csrf_token",
    headerName: "x-csrf-token",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  },
  headers: {
    hsts: {
      enabled: process.env.NODE_ENV === "production",
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    csp: {
      enabled: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": [
          "'self'",
          "https://clerk.medstint.com",
          "https://*.clerk.accounts.dev",
          "https://js.stripe.com",
        ],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com"],
        "img-src": ["'self'", "data:", "https:", "blob:"],
        "connect-src": [
          "'self'",
          "https://clerk.medstint.com",
          "https://*.clerk.accounts.dev",
          "https://api.stripe.com",
        ],
        "frame-src": ["'self'", "https://js.stripe.com"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"],
        "upgrade-insecure-requests": [],
      },
    },
    frameOptions: "DENY",
    contentTypeOptions: true,
    referrerPolicy: "strict-origin-when-cross-origin",
    permissionsPolicy: {
      camera: ["()"],
      microphone: ["()"],

      payment: ["self"],
    },
  },
  validation: {
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    blockedUserAgents: [/bot/i, /crawler/i, /spider/i, /scraper/i, /curl/i, /wget/i],
    suspiciousPatterns: [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /\beval\s*\(/gi,
      /\bexec\s*\(/gi,
      /\.\.\//g,
      /\bselect\s+.*\bfrom\s+/gi,
      /\bunion\s+.*\bselect\s+/gi,
      /\binsert\s+into\s+/gi,
      /\bupdate\s+.*\bset\s+/gi,
      /\bdelete\s+from\s+/gi,
      /\bdrop\s+table\s+/gi,
    ],
  },
}

// CSRF Token Manager
export class CSRFTokenManager {
  private config: SecurityConfig["csrf"]
  private tokenStore = new Map<string, { token: string; expires: number }>()

  constructor(config: SecurityConfig["csrf"]) {
    this.config = config

    // Clean up expired tokens every hour
    setInterval(
      () => {
        this.cleanupExpiredTokens()
      },
      60 * 60 * 1000
    )
  }

  generateToken(sessionId: string): string {
    const token = crypto.randomBytes(this.config.tokenLength).toString("hex")
    const expires = Date.now() + 24 * 60 * 60 * 1000 // 24 hours

    this.tokenStore.set(sessionId, { token, expires })
    return token
  }

  validateToken(sessionId: string, providedToken: string): boolean {
    const stored = this.tokenStore.get(sessionId)

    if (!stored || stored.expires < Date.now()) {
      this.tokenStore.delete(sessionId)
      return false
    }

    return crypto.timingSafeEqual(
      Buffer.from(stored.token, "hex"),
      Buffer.from(providedToken, "hex")
    )
  }

  private cleanupExpiredTokens(): void {
    const now = Date.now()
    for (const [sessionId, data] of this.tokenStore.entries()) {
      if (data.expires < now) {
        this.tokenStore.delete(sessionId)
      }
    }
  }
}

// Input Validator
export class InputValidator {
  private config: SecurityConfig["validation"]

  constructor(config: SecurityConfig["validation"]) {
    this.config = config
  }

  validateRequest(req: NextRequest): { valid: boolean; reason?: string } {
    // Check request method
    if (!this.config.allowedMethods.includes(req.method)) {
      return { valid: false, reason: "Method not allowed" }
    }

    // Check user agent
    const userAgent = req.headers.get("user-agent") || ""
    for (const pattern of this.config.blockedUserAgents) {
      if (pattern.test(userAgent)) {
        return { valid: false, reason: "Blocked user agent" }
      }
    }

    // Check for suspicious patterns in URL
    const url = req.url
    for (const pattern of this.config.suspiciousPatterns) {
      if (pattern.test(url)) {
        return { valid: false, reason: "Suspicious URL pattern detected" }
      }
    }

    return { valid: true }
  }

  async validateRequestBody(req: Request): Promise<{ valid: boolean; reason?: string }> {
    try {
      const contentLength = req.headers.get("content-length")
      if (contentLength && Number.parseInt(contentLength) > this.config.maxRequestSize) {
        return { valid: false, reason: "Request body too large" }
      }

      // Only validate text-based content types
      const contentType = req.headers.get("content-type") || ""
      if (contentType.includes("application/json") || contentType.includes("text/")) {
        const body = await req.text()

        for (const pattern of this.config.suspiciousPatterns) {
          if (pattern.test(body)) {
            return { valid: false, reason: "Suspicious content detected in request body" }
          }
        }
      }

      return { valid: true }
    } catch (error) {
      logger.error({ error: String(error) }, "Error validating request body")
      return { valid: false, reason: "Invalid request body" }
    }
  }

  sanitizeInput(input: string): string {
    return input
      .replace(/[<>"'&]/g, (match) => {
        const entities: Record<string, string> = {
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#x27;",
          "&": "&amp;",
        }
        return entities[match] || match
      })
      .trim()
  }
}

// Security Headers Manager
export class SecurityHeadersManager {
  private config: SecurityConfig["headers"]

  constructor(config: SecurityConfig["headers"]) {
    this.config = config
  }

  applySecurityHeaders(response: NextResponse): NextResponse {
    // HSTS Header
    if (this.config.hsts.enabled) {
      const hstsValue = [
        `max-age=${this.config.hsts.maxAge}`,
        this.config.hsts.includeSubDomains ? "includeSubDomains" : "",
        this.config.hsts.preload ? "preload" : "",
      ]
        .filter(Boolean)
        .join("; ")

      response.headers.set("Strict-Transport-Security", hstsValue)
    }

    // Content Security Policy
    if (this.config.csp.enabled) {
      const cspValue = Object.entries(this.config.csp.directives)
        .map(([directive, sources]) => {
          if (sources.length === 0) {
            return directive
          }
          return `${directive} ${sources.join(" ")}`
        })
        .join("; ")

      response.headers.set("Content-Security-Policy", cspValue)
    }

    // X-Frame-Options
    response.headers.set("X-Frame-Options", this.config.frameOptions)

    // X-Content-Type-Options
    if (this.config.contentTypeOptions) {
      response.headers.set("X-Content-Type-Options", "nosniff")
    }

    // Referrer Policy
    response.headers.set("Referrer-Policy", this.config.referrerPolicy)

    // Permissions Policy
    const permissionsPolicyValue = Object.entries(this.config.permissionsPolicy)
      .map(([feature, allowlist]) => `${feature}=(${allowlist.join(" ")})`)
      .join(", ")
    response.headers.set("Permissions-Policy", permissionsPolicyValue)

    // Additional security headers
    response.headers.set("X-DNS-Prefetch-Control", "off")
    response.headers.set("X-Download-Options", "noopen")
    response.headers.set("X-Permitted-Cross-Domain-Policies", "none")
    response.headers.set("Cross-Origin-Embedder-Policy", "require-corp")
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin")
    response.headers.set("Cross-Origin-Resource-Policy", "same-origin")

    return response
  }
}

// Main Security Manager
export class SecurityManager {
  private config: SecurityConfig
  private csrfManager: CSRFTokenManager
  private inputValidator: InputValidator
  private headersManager: SecurityHeadersManager

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_SECURITY_CONFIG, config)
    this.csrfManager = new CSRFTokenManager(this.config.csrf)
    this.inputValidator = new InputValidator(this.config.validation)
    this.headersManager = new SecurityHeadersManager(this.config.headers)
  }

  private mergeConfig(
    defaultConfig: SecurityConfig,
    userConfig: Partial<SecurityConfig>
  ): SecurityConfig {
    return {
      csrf: { ...defaultConfig.csrf, ...userConfig.csrf },
      headers: {
        hsts: { ...defaultConfig.headers.hsts, ...userConfig.headers?.hsts },
        csp: {
          enabled: userConfig.headers?.csp?.enabled ?? defaultConfig.headers.csp.enabled,
          directives: {
            ...defaultConfig.headers.csp.directives,
            ...userConfig.headers?.csp?.directives,
          },
        },
        frameOptions: userConfig.headers?.frameOptions ?? defaultConfig.headers.frameOptions,
        contentTypeOptions:
          userConfig.headers?.contentTypeOptions ?? defaultConfig.headers.contentTypeOptions,
        referrerPolicy: userConfig.headers?.referrerPolicy ?? defaultConfig.headers.referrerPolicy,
        permissionsPolicy: {
          ...defaultConfig.headers.permissionsPolicy,
          ...userConfig.headers?.permissionsPolicy,
        },
      },
      validation: { ...defaultConfig.validation, ...userConfig.validation },
    }
  }

  async validateRequest(
    req: NextRequest,
    sessionId?: string
  ): Promise<{ valid: boolean; reason?: string; response?: NextResponse }> {
    // Basic request validation
    const basicValidation = this.inputValidator.validateRequest(req)
    if (!basicValidation.valid) {
      logger.warn({ reason: basicValidation.reason, url: req.url }, "Request validation failed")
      return {
        valid: false,
        reason: basicValidation.reason,
        response: NextResponse.json(
          { error: "Bad Request", message: "Invalid request" },
          { status: 400 }
        ),
      }
    }

    // CSRF validation for state-changing requests
    if (this.config.csrf.enabled && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      if (!sessionId) {
        return {
          valid: false,
          reason: "CSRF validation requires session ID",
          response: NextResponse.json(
            { error: "Forbidden", message: "CSRF token required" },
            { status: 403 }
          ),
        }
      }

      const csrfToken =
        req.headers.get(this.config.csrf.headerName) ||
        req.cookies.get(this.config.csrf.cookieName)?.value

      if (!csrfToken || !this.csrfManager.validateToken(sessionId, csrfToken)) {
        logger.warn({ sessionId, hasToken: !!csrfToken }, "CSRF validation failed")
        return {
          valid: false,
          reason: "Invalid CSRF token",
          response: NextResponse.json(
            { error: "Forbidden", message: "Invalid CSRF token" },
            { status: 403 }
          ),
        }
      }
    }

    // Request body validation
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      const bodyValidation = await this.inputValidator.validateRequestBody(req.clone())
      if (!bodyValidation.valid) {
        logger.warn(
          {
            reason: bodyValidation.reason,
            url: req.url,
          },
          "Request body validation failed"
        )
        return {
          valid: false,
          reason: bodyValidation.reason,
          response: NextResponse.json(
            { error: "Bad Request", message: "Invalid request content" },
            { status: 400 }
          ),
        }
      }
    }

    return { valid: true }
  }

  generateCSRFToken(sessionId: string): string {
    return this.csrfManager.generateToken(sessionId)
  }

  applySecurityHeaders(response: NextResponse): NextResponse {
    return this.headersManager.applySecurityHeaders(response)
  }

  sanitizeInput(input: string): string {
    return this.inputValidator.sanitizeInput(input)
  }
}

// Export singleton instance
export const securityManager = new SecurityManager()

// Export for custom configurations
export { DEFAULT_SECURITY_CONFIG }
