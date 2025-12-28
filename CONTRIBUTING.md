# Contributing to MedStint Clerk

This document provides comprehensive guidelines for contributing to the MedStint Clerk project, including technical specifications, best practices, and development workflows.

## Table of Contents

1. [Timer Lifecycle Policy](#timer-lifecycle-policy)
2. [Singleton Pattern Implementation](#singleton-pattern-implementation)
3. [Usage Guidelines and Best Practices](#usage-guidelines-and-best-practices)
4. [Configuration Options and Constraints](#configuration-options-and-constraints)
5. [Troubleshooting Procedures](#troubleshooting-procedures)
6. [Performance Considerations](#performance-considerations)
7. [API Development Guidelines](#api-development-guidelines)
8. [Testing Standards](#testing-standards)
9. [Code Quality Standards](#code-quality-standards)

---

## Timer Lifecycle Policy

### Overview

The MedStint Clerk application implements a sophisticated timer lifecycle management system to handle background tasks, scheduled operations, and resource cleanup. This policy ensures efficient resource utilization and prevents memory leaks.

### Timer Creation

Timers are created using the following patterns:

```typescript
// Singleton timer instance
private static timerInstance: Timer | null = null
private static cleanupInterval: NodeJS.Timeout | null = null

// Timer initialization
public static initializeTimer(): void {
  if (this.timerInstance) {
    return // Prevent multiple instances
  }
  
  this.timerInstance = new Timer(() => {
    // Timer logic here
  }, 30000) // 30-second intervals
  
  // Set up cleanup interval
  this.cleanupInterval = setInterval(() => {
    this.performCleanup()
  }, 300000) // 5-minute cleanup cycles
}
```

### Timer Execution

Timers execute according to their configured intervals and perform the following operations:

1. **Resource Monitoring**: Check system resources and memory usage
2. **Cache Maintenance**: Clean expired cache entries
3. **Background Tasks**: Process queued operations
4. **Health Checks**: Verify system integrity

### Timer Cleanup

Cleanup is performed automatically through the following mechanisms:

```typescript
private static performCleanup(): void {
  // Clear expired timers
  if (this.timerInstance && this.timerInstance.isExpired()) {
    this.timerInstance.stop()
    this.timerInstance = null
  }
  
  // Clear orphaned intervals
  if (this.cleanupInterval && this.shouldCleanup()) {
    clearInterval(this.cleanupInterval)
    this.cleanupInterval = null
  }
}

public static destroy(): void {
  if (this.timerInstance) {
    this.timerInstance.stop()
    this.timerInstance = null
  }
  
  if (this.cleanupInterval) {
    clearInterval(this.cleanupInterval)
    this.cleanupInterval = null
  }
}
```

### Lifecycle States

Timers exist in the following states:

- **INITIALIZED**: Timer created but not started
- **RUNNING**: Timer actively executing
- **PAUSED**: Timer temporarily suspended
- **EXPIRED**: Timer completed its lifecycle
- **CLEANED**: Timer resources released

---

## Singleton Pattern Implementation

### Core Principles

The application uses singleton patterns for managing shared resources and preventing duplicate instances:

```typescript
export class CacheIntegrationService {
  private static instance: CacheIntegrationService | null = null
  private cache: Map<string, CacheEntry> = new Map()
  private cleanupTimer: NodeJS.Timeout | null = null
  
  private constructor() {
    this.initializeCleanupTimer()
  }
  
  public static getInstance(): CacheIntegrationService {
    if (!CacheIntegrationService.instance) {
      CacheIntegrationService.instance = new CacheIntegrationService()
    }
    return CacheIntegrationService.instance
  }
  
  private initializeCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries()
    }, 300000) // 5 minutes
  }
  
  private cleanupExpiredEntries(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key)
      }
    }
  }
  
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.cache.clear()
    CacheIntegrationService.instance = null
  }
}
```

### Thread Safety

Singleton implementations ensure thread safety through:

1. **Lazy Initialization**: Instances created only when needed
2. **Atomic Operations**: State changes performed atomically
3. **Resource Locking**: Critical sections protected with locks
4. **Immutable State**: Configuration objects made immutable

### Memory Management

Singleton patterns include automatic memory management:

```typescript
export class RateLimiter {
  private static instances: Map<string, RateLimiter> = new Map()
  private requestCounts: Map<string, number> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null
  
  private constructor(private key: string) {
    this.startCleanupTimer()
  }
  
  public static getInstance(key: string): RateLimiter {
    if (!RateLimiter.instances.has(key)) {
      RateLimiter.instances.set(key, new RateLimiter(key))
    }
    return RateLimiter.instances.get(key)!
  }
  
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries()
      
      // Remove instance if no longer needed
      if (this.requestCounts.size === 0) {
        this.destroy()
      }
    }, 60000) // 1 minute
  }
  
  private cleanupExpiredEntries(): void {
    const now = Date.now()
    const expirationTime = 15 * 60 * 1000 // 15 minutes
    
    for (const [key, timestamp] of this.requestCounts.entries()) {
      if (now - timestamp > expirationTime) {
        this.requestCounts.delete(key)
      }
    }
  }
  
  private destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    RateLimiter.instances.delete(this.key)
  }
}
```

---

## Usage Guidelines and Best Practices

### Timer Usage

1. **Always Initialize Properly**:
   ```typescript
   // Good
   const timer = TimerManager.getInstance()
   timer.initialize()
   
   // Bad
   const timer = new Timer() // Direct instantiation
   ```

2. **Handle Cleanup Explicitly**:
   ```typescript
   // Good
   class MyService {
     private timer: TimerManager
     
     constructor() {
       this.timer = TimerManager.getInstance()
     }
     
     destroy(): void {
       this.timer.destroy()
     }
   }
   
   // Usage
   const service = new MyService()
   // ... use service
   service.destroy() // Explicit cleanup
   ```

3. **Use Configuration Objects**:
   ```typescript
   // Good
   const config: TimerConfig = {
     interval: 30000,
     maxExecutions: 100,
     cleanupInterval: 300000,
     autoStart: true
   }
   TimerManager.initialize(config)
   
   // Bad
   TimerManager.initialize(30000, 100, 300000, true) // Magic numbers
   ```

### Singleton Usage

1. **Access Through Factory Methods**:
   ```typescript
   // Good
   const cache = CacheIntegrationService.getInstance()
   const rateLimiter = RateLimiter.getInstance('api-key')
   
   // Bad
   const cache = new CacheIntegrationService() // Direct instantiation
   ```

2. **Handle Lifecycle Properly**:
   ```typescript
   // Good
   class Application {
     private cache: CacheIntegrationService
     
     async initialize(): Promise<void> {
       this.cache = CacheIntegrationService.getInstance()
       await this.cache.warmup()
     }
     
     async shutdown(): Promise<void> {
       if (this.cache) {
         await this.cache.flush()
         this.cache.destroy()
       }
     }
   }
   ```

3. **Avoid Circular Dependencies**:
   ```typescript
   // Good - Use dependency injection
   class ServiceA {
     constructor(private serviceB: ServiceB) {}
   }
   
   // Bad - Direct singleton access
   class ServiceA {
     private serviceB = ServiceB.getInstance() // Circular dependency risk
   }
   ```

---

## Configuration Options and Constraints

### Timer Configuration

```typescript
interface TimerConfig {
  // Execution interval in milliseconds
  interval: number
  
  // Maximum number of executions before cleanup
  maxExecutions?: number
  
  // Cleanup interval in milliseconds
  cleanupInterval?: number
  
  // Whether to start automatically
  autoStart?: boolean
  
  // Timeout for individual executions
  executionTimeout?: number
  
  // Error handling strategy
  errorHandling?: 'continue' | 'stop' | 'restart'
  
  // Memory threshold for cleanup (MB)
  memoryThreshold?: number
}
```

### Rate Limiter Configuration

```typescript
interface RateLimitConfig {
  // Maximum requests per window
  maxRequests: number
  
  // Time window in milliseconds
  windowMs: number
  
  // Whether to skip failed requests
  skipFailedRequests?: boolean
  
  // Whether to skip successful requests
  skipSuccessfulRequests?: boolean
  
  // Key generator function
  keyGenerator?: (request: Request) => string
  
  // Custom error message
  message?: string
  
  // Custom status code
  statusCode?: number
  
  // Headers to include in response
  headers?: boolean
}
```

### Cache Configuration

```typescript
interface CacheConfig {
  // Default TTL in milliseconds
  defaultTTL: number
  
  // Maximum number of entries
  maxEntries?: number
  
  // Cleanup interval in milliseconds
  cleanupInterval?: number
  
  // Whether to enable compression
  enableCompression?: boolean
  
  // Compression threshold in bytes
  compressionThreshold?: number
  
  // Memory limit in MB
  memoryLimit?: number
}
```

### Constraints

1. **Memory Limits**:
   - Maximum 100MB for cache storage
   - Maximum 50MB for rate limiter storage
   - Cleanup triggered at 80% capacity

2. **Execution Limits**:
   - Maximum 1000 executions per timer instance
   - Maximum 100 concurrent timers
   - Maximum 5-minute execution timeout

3. **Rate Limits**:
   - Maximum 100 requests per minute per IP
   - Maximum 1000 requests per hour per user
   - Maximum 10MB payload size

---

## Troubleshooting Procedures

### Common Timer Issues

1. **Timer Not Starting**:
   ```typescript
   // Check initialization
   if (!TimerManager.getInstance().isInitialized()) {
     TimerManager.initialize(config)
   }
   
   // Check configuration
   if (config.interval < 1000) {
     throw new Error('Interval must be at least 1000ms')
   }
   ```

2. **Memory Leaks**:
   ```typescript
   // Check for unreferenced timers
   const activeTimers = TimerManager.getActiveTimers()
   if (activeTimers.length > 100) {
     console.warn('Too many active timers, performing cleanup')
     TimerManager.cleanup()
   }
   
   // Monitor memory usage
   const memoryUsage = process.memoryUsage()
   if (memoryUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
     console.warn('High memory usage, triggering garbage collection')
     global.gc?.()
   }
   ```

3. **Timer Execution Failures**:
   ```typescript
   // Implement error handling
   timer.on('error', (error) => {
     console.error('Timer execution failed:', error)
     
     // Implement retry logic
     if (error.retryable) {
       setTimeout(() => timer.retry(), 5000)
     }
   })
   ```

### Rate Limiter Issues

1. **Rate Limit Not Working**:
   ```typescript
   // Check configuration
   const config = rateLimiter.getConfig()
   if (config.maxRequests <= 0) {
     throw new Error('Invalid rate limit configuration')
   }
   
   // Check key generation
   const key = rateLimiter.generateKey(request)
   if (!key) {
     console.warn('Failed to generate rate limit key')
   }
   ```

2. **False Positives**:
   ```typescript
   // Check request counting
   const count = rateLimiter.getRequestCount(key)
   const window = rateLimiter.getWindow(key)
   
   console.log(`Request count: ${count}, Window: ${window}`)
   
   // Implement whitelist
   if (this.isWhitelisted(request.ip)) {
     return { allowed: true }
   }
   ```

### Cache Issues

1. **Cache Misses**:
   ```typescript
   // Check cache keys
   const key = cache.generateKey(request)
   const entry = cache.get(key)
   
   if (!entry) {
     console.log(`Cache miss for key: ${key}`)
     
     // Check TTL
     if (entry && entry.isExpired()) {
       console.log(`Cache entry expired: ${entry.expiresAt}`)
     }
   }
   ```

2. **Cache Corruption**:
   ```typescript
   // Validate cache entries
   if (!cache.isValid(entry)) {
     console.warn('Invalid cache entry detected')
     cache.delete(key)
     
     // Rebuild cache
     await cache.rebuild(key)
   }
   ```

---

## Performance Considerations

### Memory Optimization

1. **Use Object Pools**:
   ```typescript
   class ObjectPool<T> {
     private pool: T[] = []
     private createFn: () => T
     private resetFn: (obj: T) => void
     
     constructor(createFn: () => T, resetFn: (obj: T) => void) {
       this.createFn = createFn
       this.resetFn = resetFn
     }
     
     acquire(): T {
       return this.pool.pop() || this.createFn()
     }
     
     release(obj: T): void {
       this.resetFn(obj)
       this.pool.push(obj)
     }
   }
   ```

2. **Implement Lazy Loading**:
   ```typescript
   class LazyLoader<T> {
     private value: T | null = null
     private loader: () => Promise<T>
     
     constructor(loader: () => Promise<T>) {
       this.loader = loader
     }
     
     async getValue(): Promise<T> {
       if (!this.value) {
         this.value = await this.loader()
       }
       return this.value
     }
     
     clear(): void {
       this.value = null
     }
   }
   ```

### CPU Optimization

1. **Batch Operations**:
   ```typescript
   class BatchProcessor<T> {
     private queue: T[] = []
     private batchSize: number
     private processor: (items: T[]) => Promise<void>
     
     constructor(batchSize: number, processor: (items: T[]) => Promise<void>) {
       this.batchSize = batchSize
       this.processor = processor
     }
     
     add(item: T): void {
       this.queue.push(item)
       
       if (this.queue.length >= this.batchSize) {
         this.processBatch()
       }
     }
     
     private async processBatch(): Promise<void> {
       const batch = this.queue.splice(0, this.batchSize)
       await this.processor(batch)
     }
   }
   ```

2. **Use Worker Threads**:
   ```typescript
   import { Worker } from 'worker_threads'
   
   class WorkerPool {
     private workers: Worker[] = []
     private queue: Array<() => void> = []
     
     constructor(private poolSize: number) {
       this.initializeWorkers()
     }
     
     private initializeWorkers(): void {
       for (let i = 0; i < this.poolSize; i++) {
         const worker = new Worker('./worker.js')
         
         worker.on('message', (result) => {
           // Handle result
           this.processQueue()
         })
         
         this.workers.push(worker)
       }
     }
     
     async execute(task: any): Promise<any> {
       return new Promise((resolve, reject) => {
         this.queue.push(() => {
           const worker = this.getAvailableWorker()
           if (worker) {
             worker.postMessage(task)
             worker.once('message', resolve)
             worker.once('error', reject)
           }
         })
         
         this.processQueue()
       })
     }
   }
   ```

### Network Optimization

1. **Connection Pooling**:
   ```typescript
   class ConnectionPool {
     private connections: Connection[] = []
     private maxConnections: number
     private minConnections: number
     
     constructor(config: PoolConfig) {
       this.maxConnections = config.maxConnections
       this.minConnections = config.minConnections
       this.initializePool()
     }
     
     private async initializePool(): Promise<void> {
       for (let i = 0; i < this.minConnections; i++) {
         const connection = await this.createConnection()
         this.connections.push(connection)
       }
     }
     
     async acquire(): Promise<Connection> {
       if (this.connections.length > 0) {
         return this.connections.pop()!
       }
       
       if (this.connections.length < this.maxConnections) {
         return await this.createConnection()
       }
       
       throw new Error('Connection pool exhausted')
     }
     
     release(connection: Connection): void {
       if (this.connections.length < this.maxConnections) {
         this.connections.push(connection)
       } else {
         connection.close()
       }
     }
   }
   ```

2. **Request Batching**:
   ```typescript
   class RequestBatcher {
     private pending: Map<string, PendingRequest> = new Map()
     private batchTimeout: number
     
     constructor(batchTimeout: number = 50) {
       this.batchTimeout = batchTimeout
     }
     
     async batchRequest(key: string, request: Request): Promise<Response> {
       if (this.pending.has(key)) {
         return this.pending.get(key)!.promise
       }
       
       const promise = this.executeBatch(key, request)
       this.pending.set(key, { promise, request })
       
       setTimeout(() => {
         this.pending.delete(key)
       }, this.batchTimeout)
       
       return promise
     }
     
     private async executeBatch(key: string, request: Request): Promise<Response> {
       // Execute batched request
       const responses = await this.sendBatch([request])
       return responses[0]
     }
   }
   ```

---

## API Development Guidelines

### Route Protection

All API routes must follow these security guidelines:

1. **Authentication Required**:
   ```typescript
   import { auth } from '@clerk/nextjs/server'
   import { apiAuthMiddleware } from '@/middleware/api-auth'
   
   export const GET = apiAuthMiddleware(async (request: NextRequest) => {
     const { userId } = await auth()
     if (!userId) {
       return createErrorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
     }
     // Route logic here
   })
   ```

2. **Role-Based Access Control**:
   ```typescript
   function checkPermissions(userRole: string, requiredRole: string): boolean {
     const roleHierarchy = {
       'STUDENT': 1,
       'CLINICAL_PRECEPTOR': 2,
       'CLINICAL_SUPERVISOR': 3,
       'SCHOOL_ADMIN': 4
     }
     
     return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
   }
   ```

3. **Rate Limiting**:
   ```typescript
   import { generalApiLimiter } from '@/lib/rate-limiter'
   
   export const POST = withErrorHandling(async (request: NextRequest) => {
     // Check rate limiting first
     const rateLimitResult = await generalApiLimiter.checkLimit(request)
     if (!rateLimitResult.allowed) {
       const retryAfter = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
       return createErrorResponse(
         'Too Many Requests',
         HTTP_STATUS.TOO_MANY_REQUESTS,
         { retryAfter }
       )
     }
     // Route logic here
   })
   ```

### Error Handling

All API routes must use consistent error handling:

```typescript
export const GET = withErrorHandling(async (request: NextRequest) => {
  try {
    // Route logic here
    return createSuccessResponse(data)
  } catch (error) {
    console.error('Route error:', error)
    return createErrorResponse(
      'Internal Server Error',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { details: error.message }
    )
  }
})
```

---

## Testing Standards

### Unit Tests

All components must have comprehensive unit tests:

```typescript
describe('RateLimiter', () => {
  it('should allow requests within rate limit', async () => {
    const limiter = RateLimiter.getInstance('test-key')
    const result = await limiter.checkLimit(mockRequest)
    
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBeGreaterThan(0)
  })
  
  it('should block requests exceeding rate limit', async () => {
    const limiter = RateLimiter.getInstance('test-key')
    
    // Exceed rate limit
    for (let i = 0; i < 101; i++) {
      await limiter.checkLimit(mockRequest)
    }
    
    const result = await limiter.checkLimit(mockRequest)
    expect(result.allowed).toBe(false)
  })
  
  it('should handle rate limiter errors gracefully', async () => {
    const limiter = RateLimiter.getInstance('test-key')
    vi.mocked(limiter.checkLimit).mockRejectedValue(new Error('Service unavailable'))
    
    // Should not throw, should allow request
    const response = await GET(mockRequest)
    expect(response.status).toBe(200)
  })
})
```

### Integration Tests

API routes must have comprehensive integration tests:

```typescript
describe('Pending Tasks API', () => {
  describe('Rate Limiting Functionality Tests', () => {
    it('allows requests when rate limit is not exceeded', async () => {
      vi.mocked(generalApiLimiter.checkLimit).mockResolvedValue({
        allowed: true,
        remaining: 95,
        resetTime: Date.now() + 900000
      })
      
      const response = await getPendingTasks(request)
      expect(response.status).toBe(200)
    })
    
    it('blocks requests when rate limit is exceeded', async () => {
      vi.mocked(generalApiLimiter.checkLimit).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 900000
      })
      
      const response = await getPendingTasks(request)
      expect(response.status).toBe(429)
    })
  })
})
```

---

## Code Quality Standards

### TypeScript Guidelines

1. **Use Strict Types**:
   ```typescript
   // Good
   interface UserData {
     id: string
     name: string
     role: UserRole
     createdAt: Date
   }
   
   // Bad
   interface UserData {
     id: any
     name: string
     role: string
     createdAt: any
   }
   ```

2. **Handle Null/Undefined**:
   ```typescript
   // Good
   function getUserName(user?: User): string {
     return user?.name ?? 'Anonymous'
   }
   
   // Bad
   function getUserName(user: User): string {
     return user.name // May throw if user is undefined
   }
   ```

3. **Use Async/Await**:
   ```typescript
   // Good
   async function fetchData(): Promise<Data> {
     const response = await fetch('/api/data')
     return await response.json()
   }
   
   // Bad
   function fetchData(): Promise<Data> {
     return fetch('/api/data')
       .then(response => response.json())
   }
   ```

### React Component Guidelines

1. **Keep Components Small**:
   ```typescript
   // Good - Component under 200 lines
   function UserCard({ user }: { user: User }) {
     return (
       <div className="user-card">
         <UserAvatar user={user} />
         <UserDetails user={user} />
         <UserActions user={user} />
       </div>
     )
   }
   
   // Bad - Component too large
   function UserDashboard({ user }: { user: User }) {
     // 500+ lines of mixed logic and UI
   }
   ```

2. **Use Custom Hooks**:
   ```typescript
   // Good - Extract logic to custom hook
   function useUserData(userId: string) {
     const [user, setUser] = useState<User | null>(null)
     const [loading, setLoading] = useState(true)
     
     useEffect(() => {
       fetchUser(userId).then(setUser).finally(() => setLoading(false))
     }, [userId])
     
     return { user, loading }
   }
   
   function UserProfile({ userId }: { userId: string }) {
     const { user, loading } = useUserData(userId)
     
     if (loading) return <LoadingSpinner />
     return <UserCard user={user} />
   }
   ```

### Security Guidelines

1. **Input Validation**:
   ```typescript
   import { z } from 'zod'
   
   const userSchema = z.object({
     name: z.string().min(1).max(100),
     email: z.string().email(),
     role: z.enum(['STUDENT', 'CLINICAL_PRECEPTOR', 'SCHOOL_ADMIN'])
   })
   
   export const POST = withErrorHandling(async (request: NextRequest) => {
     const body = await request.json()
     
     try {
       const validatedData = userSchema.parse(body)
       // Process validated data
     } catch (error) {
       if (error instanceof z.ZodError) {
         return createValidationErrorResponse(error)
       }
       throw error
     }
   })
   ```

2. **SQL Injection Prevention**:
   ```typescript
   // Good - Use parameterized queries
   const users = await db
     .select()
     .from(users)
     .where(eq(users.id, userId))
   
   // Bad - String concatenation
   const users = await db.execute(`
     SELECT * FROM users WHERE id = '${userId}'
   `)
   ```

3. **Authentication Checks**:
   ```typescript
   export const GET = apiAuthMiddleware(async (request: NextRequest) => {
     const { userId, sessionClaims } = await auth()
     
     if (!userId) {
       return createErrorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
     }
     
     const userRole = (sessionClaims?.metadata as UserMetadata)?.role
     
     if (!checkSchedulePermissions(userRole)) {
       return createErrorResponse('Insufficient permissions', HTTP_STATUS.FORBIDDEN)
     }
     
     // Route logic here
   })
   ```

---

This contributing guide should be updated as the project evolves. For questions or suggestions, please create an issue in the project repository.