import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Passport Agent Protocol",
    short_name: "PAP",
    description: "Approve what your AI agent does, from your phone, with a passkey.",
    start_url: "/wallet",
    display: "standalone",
    background_color: "#f6f2ea",
    theme_color: "#f6f2ea",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
