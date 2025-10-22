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
        src: "/favicon.ico",
        sizes: "32x32",
        type: "image/x-icon",
      },
      {
        src: "/favicon-v2.svg",
        sizes: "32x32",
        type: "image/svg+xml",
      },
    ],
  }
}
