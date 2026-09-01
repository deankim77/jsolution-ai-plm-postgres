import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local", "aipms.jjjsolution.com", "ai-pms.jjjsolution.com", "localhost"],
  },
  ssr: {
    external: ["pg", "pg-native"],
  },
  plugins: [vinext()],
});
