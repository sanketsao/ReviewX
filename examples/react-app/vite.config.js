import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// HMR client must connect back through the ProtoFeedback proxy (port 4323),
// not directly to Vite (5173), so the websocket survives the reverse proxy.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    hmr: { clientPort: 4323 },
  },
});
