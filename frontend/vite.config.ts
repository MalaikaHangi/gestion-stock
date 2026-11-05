import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (command === "build") {
    const api = process.env.VITE_API_URL || env.VITE_API_URL;
    if (
      !api ||
      !api.startsWith("https://") ||
      /localhost|127\.0\.0\.1/.test(api)
    )
      throw Error(
        "Définissez VITE_API_URL avec l’URL HTTPS du backend hébergé avant de compiler.",
      );
  }
  return { plugins: [react()] };
});
