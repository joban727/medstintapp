import { createRouteHandler } from "uploadthing/next"
import { ourFileRouter } from "./core"
import { cacheIntegrationService } from '@/lib/cache-integration'


export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
})
