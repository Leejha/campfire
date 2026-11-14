import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { seedDesignPlugin } from "@seed-design/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    seedDesignPlugin({ colorMode: "light-only" }),
    tailwindcss(),
    reactRouter(),
  ],
  resolve: {
    conditions: ["seed-layered"],
    tsconfigPaths: true,
  },
});
