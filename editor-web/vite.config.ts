import react from "@vitejs/plugin-react";
import { defineConfig, Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Vite 8 uses Rolldown which cannot parse Flow types in react-native / expo packages.
// TenTap lib-web calls require("expo-constants") inside a try/catch to detect Expo env.
// We strip those require calls at transform time so Rolldown never tries to parse
// expo-constants → react-native (which has Flow types → PARSE_ERROR).
const nativeStubPlugin: Plugin = {
  name: "native-stubs",
  enforce: "pre",
  transform(code, id) {
    // Only touch @10play/tentap-editor lib-web bundle
    if (!id.includes("tentap-editor") && !id.includes("lib-web")) return;
    if (!code.includes("expo-constants") && !code.includes("react-native")) return;
    return code
      .replace(/require\(["']expo-constants["']\)/g, "null")
      .replace(/require\(["']expo-modules-core["']\)/g, "null")
      .replace(/require\(["']react-native["']\)/g, "null");
  },
};

export default defineConfig({
  root: "editor-web", // This should be the directory of your index.html
  build: {
    outDir: "build",
    emptyOutDir: false,
  },
  resolve: {
    alias: [
      {
        find: "@10play/tentap-editor", // On our web bundle we only want to include web related code
        replacement: "@10play/tentap-editor/web",
      },
      {
        find: "@tiptap/pm/view",
        replacement: "@10play/tentap-editor/web",
      },
      {
        find: "@tiptap/pm/state",
        replacement: "@10play/tentap-editor/web",
      },
    ],
  },
  plugins: [
    nativeStubPlugin,
    react(),
    viteSingleFile(),
  ],
  server: {
    port: 3000,
  },
});
