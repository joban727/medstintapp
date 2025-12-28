import type { MetadataRoute } from "next"
import { site } from "../config/site"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#fff",
    theme_color: "#fff",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/favicon-v2.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  }
}
