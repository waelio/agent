import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    plugins: [
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.svg", "pwa-icon.svg", "pwa-maskable.svg"],
            manifest: {
                id: "/",
                name: "gemma.4",
                short_name: "gemma.4",
                description: "Installable PWA frontend for the waelio local AI research agent.",
                theme_color: "#2563eb",
                background_color: "#0f172a",
                display: "standalone",
                scope: "/",
                start_url: "/",
                icons: [
                    {
                        src: "/pwa-icon.svg",
                        sizes: "any",
                        type: "image/svg+xml",
                        purpose: "any",
                    },
                    {
                        src: "/pwa-maskable.svg",
                        sizes: "any",
                        type: "image/svg+xml",
                        purpose: "maskable",
                    },
                ],
            },
            workbox: {
                clientsClaim: true,
                cleanupOutdatedCaches: true,
                navigateFallback: "index.html",
                globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
                skipWaiting: true,
            },
        }),
    ],
    server: {
        port: 3000,
        strictPort: true,
    },
});
