import type { NextRequest } from "next/server"

// Network security configuration for school environments
export interface NetworkSecurityConfig {
  allowedNetworks: string[]
  blockedNetworks: string[]
  requireVPN: boolean
  allowedDomains: string[]
  maxConnectionsPerIP: number
  sessionTimeout: number
  requireHTTPS: boolean
  allowedPorts: number[]
}

// Default security configuration
const DEFAULT_NETWORK_CONFIG: NetworkSecurityConfig = {
  allowedNetworks: [
    "10.0.0.0/8", // Private Class A
    "172.16.0.0/12", // Private Class B
    "192.168.0.0/16", // Private Class C
    "127.0.0.0/8", // Loopback
  ],
  blockedNetworks: [
    "0.0.0.0/8", // Invalid
    "169.254.0.0/16", // Link-local
    "224.0.0.0/4", // Multicast
  ],
  requireVPN: false,
  allowedDomains: [
    "localhost",
    "*.edu", // Educational domains
    "*.school", // School domains
    "*.university", // University domains
  ],
  maxConnectionsPerIP: 100,
  sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours in milliseconds
  requireHTTPS: process.env.NODE_ENV === "production",
  allowedPorts: [80, 443, 3000, 8080],
}

// School-specific network configurations
const SCHOOL_NETWORK_CONFIGS: Record<string, Partial<NetworkSecurityConfig>> = {
  // Example configurations for different school types
  "medical-school": {
    requireVPN: true,
    allowedNetworks: ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"],
    sessionTimeout: 4 * 60 * 60 * 1000, // 4 hours for medical schools
    maxConnectionsPerIP: 50,
  },
  "nursing-school": {
    requireVPN: false,
    sessionTimeout: 6 * 60 * 60 * 1000, // 6 hours
    maxConnectionsPerIP: 75,
  },
  university: {
    requireVPN: false,
    allowedNetworks: [
      "10.0.0.0/8",
      "172.16.0.0/12",
      "192.168.0.0/16",
      "0.0.0.0/0", // Allow all for universities (more open)
    ],
    sessionTimeout: 12 * 60 * 60 * 1000, // 12 hours
    maxConnectionsPerIP: 200,
  },
}

// IP address utilities
export function parseIPAddress(ip: string): number[] {
  return ip.split(".").map(Number)
}

export function ipToNumber(ip: string): number {
  const parts = parseIPAddress(ip)
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

export function isIPInRange(ip: string, cidr: string): boolean {
  const [network, prefixLength] = cidr.split("/")
  const ipNum = ipToNumber(ip)
  const networkNum = ipToNumber(network)
  const mask = (0xffffffff << (32 - Number.parseInt(prefixLength))) >>> 0

  return (ipNum & mask) === (networkNum & mask)
}

export function isPrivateIP(ip: string): boolean {
  const privateRanges = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8"]

  return privateRanges.some((range) => isIPInRange(ip, range))
}

// Get client IP address from request
export function getClientIP(request: NextRequest): string {
  // Check various headers for the real IP
  const forwardedFor = request.headers.get("x-forwarded-for")
  const realIP = request.headers.get("x-real-ip")
  const cfConnectingIP = request.headers.get("cf-connecting-ip")
  const remoteAddr = request.headers.get("x-remote-addr")

  // Priority order for IP detection
  if (cfConnectingIP) return cfConnectingIP
  if (realIP) return realIP
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim()
  }
  if (remoteAddr) return remoteAddr

  // Fallback to connection remote address
  return (request as { ip?: string }).ip || "127.0.0.1"
}

// Get network configuration for a school
export function getSchoolNetworkConfig(schoolType?: string): NetworkSecurityConfig {
  const baseConfig = { ...DEFAULT_NETWORK_CONFIG }

  // eslint-disable-next-line security/detect-object-injection
  if (schoolType && SCHOOL_NETWORK_CONFIGS[schoolType]) {
    // eslint-disable-next-line security/detect-object-injection
    return { ...baseConfig, ...SCHOOL_NETWORK_CONFIGS[schoolType] }
  }

  return baseConfig
}

// Validate if IP is allowed based on network rules
export function validateNetworkAccess(
  ip: string,
  config: NetworkSecurityConfig
): { allowed: boolean; reason?: string } {
  // Check if IP is in blocked networks
  for (const blockedNetwork of config.blockedNetworks) {
    if (isIPInRange(ip, blockedNetwork)) {
      return {
        allowed: false,
        reason: `IP ${ip} is in blocked network range ${blockedNetwork}`,
      }
    }
  }

  // Check if IP is in allowed networks
  const isInAllowedNetwork = config.allowedNetworks.some((network) => isIPInRange(ip, network))

  if (!isInAllowedNetwork) {
    return {
      allowed: false,
      reason: `IP ${ip} is not in any allowed network range`,
    }
  }

  return { allowed: true }
}

// Validate domain access
export function validateDomainAccess(
  domain: string,
  config: NetworkSecurityConfig
): { allowed: boolean; reason?: string } {
  const isAllowed = config.allowedDomains.some((allowedDomain) => {
    if (allowedDomain.startsWith("*.")) {
      const suffix = allowedDomain.substring(2)
      return domain.endsWith(suffix)
    }
    return domain === allowedDomain
  })

  if (!isAllowed) {
    return {
      allowed: false,
      reason: `Domain ${domain} is not in allowed domains list`,
    }
  }

  return { allowed: true }
}

// Connection tracking for rate limiting
const connectionTracker = new Map<string, { count: number; lastReset: number }>()

export function trackConnection(ip: string, maxConnections: number): boolean {
  const now = Date.now()
  const resetInterval = 60 * 1000 // Reset every minute

  const existing = connectionTracker.get(ip)

  if (!existing || now - existing.lastReset > resetInterval) {
    connectionTracker.set(ip, { count: 1, lastReset: now })
    return true
  }

  if (existing.count >= maxConnections) {
    return false
  }

  existing.count++
  return true
}

// Comprehensive network security validation
export function validateSchoolNetworkAccess(
  request: NextRequest,
  schoolType?: string
): {
  allowed: boolean
  reason?: string
  config: NetworkSecurityConfig
  clientInfo: {
    ip: string
    domain: string
    userAgent: string
    isPrivate: boolean
  }
} {
  const config = getSchoolNetworkConfig(schoolType)
  const clientIP = getClientIP(request)
  const domain = request.headers.get("host") || "localhost"
  const userAgent = request.headers.get("user-agent") || "unknown"
  const isPrivate = isPrivateIP(clientIP)

  const clientInfo = {
    ip: clientIP,
    domain,
    userAgent,
    isPrivate,
  }

  // Validate HTTPS requirement
  if (config.requireHTTPS && request.url.startsWith("http://")) {
    return {
      allowed: false,
      reason: "HTTPS is required for this school network",
      config,
      clientInfo,
    }
  }

  // Validate network access
  const networkValidation = validateNetworkAccess(clientIP, config)
  if (!networkValidation.allowed) {
    return {
      allowed: false,
      reason: networkValidation.reason,
      config,
      clientInfo,
    }
  }

  // Validate domain access
  const domainValidation = validateDomainAccess(domain, config)
  if (!domainValidation.allowed) {
    return {
      allowed: false,
      reason: domainValidation.reason,
      config,
      clientInfo,
    }
  }

  // Validate connection limits
  if (!trackConnection(clientIP, config.maxConnectionsPerIP)) {
    return {
      allowed: false,
      reason: `Too many connections from IP ${clientIP}. Limit: ${config.maxConnectionsPerIP} per minute`,
      config,
      clientInfo,
    }
  }

  return {
    allowed: true,
    config,
    clientInfo,
  }
}

// School network setup utilities
export function generateSchoolNetworkConfig(schoolInfo: {
  type: string
  domain: string
  ipRanges?: string[]
  requiresVPN?: boolean
  sessionDuration?: number
}): NetworkSecurityConfig {
  const baseConfig = getSchoolNetworkConfig(schoolInfo.type)

  return {
    ...baseConfig,
    allowedDomains: [...baseConfig.allowedDomains, schoolInfo.domain, `*.${schoolInfo.domain}`],
    allowedNetworks: schoolInfo.ipRanges || baseConfig.allowedNetworks,
    requireVPN: schoolInfo.requiresVPN ?? baseConfig.requireVPN,
    sessionTimeout: schoolInfo.sessionDuration || baseConfig.sessionTimeout,
  }
}

// Network diagnostics
export function diagnoseNetworkIssues(
  request: NextRequest,
  schoolType?: string
): {
  status: "healthy" | "warning" | "error"
  issues: string[]
  recommendations: string[]
  clientInfo: {
    ip: string
    userAgent: string
    headers: Record<string, string | null>
  }
} {
  const validation = validateSchoolNetworkAccess(request, schoolType)
  const issues: string[] = []
  const recommendations: string[] = []

  if (!validation.allowed) {
    issues.push(validation.reason || "Network access denied")
  }

  if (!validation.clientInfo.isPrivate) {
    issues.push("Connection from public IP address")
    recommendations.push("Consider using VPN or private network")
  }

  if (!request.url.startsWith("https://")) {
    issues.push("Insecure HTTP connection")
    recommendations.push("Use HTTPS for secure communication")
  }

  const status =
    issues.length === 0
      ? "healthy"
      : issues.some((issue) => issue.includes("denied") || issue.includes("blocked"))
        ? "error"
        : "warning"

  // Create headers object from request (safe from prototype pollution)
  const headers: Record<string, string | null> = {}
  request.headers.forEach((value, key) => {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return
    }
    // eslint-disable-next-line security/detect-object-injection
    headers[key] = value
  })

  return {
    status,
    issues,
    recommendations,
    clientInfo: {
      ip: validation.clientInfo.ip,
      userAgent: validation.clientInfo.userAgent,
      headers,
    },
  }
}

// Export for use in middleware and API routes
export { DEFAULT_NETWORK_CONFIG, SCHOOL_NETWORK_CONFIGS }
