import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../backend/static",
    emptyOutDir: true,
    // 파일명을 고정한다. 해시가 붙으면 수정할 때마다 새 파일이 생겨
    // 저장소에 죽은 파일이 쌓이므로, 항상 같은 이름으로 덮어쓰게 한다.
    // 캐시 무효화는 서비스워커의 network-first 전략이 담당한다.
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/app.[ext]",
      },
    },
  },
  server: { proxy: { "/api": "http://localhost:8100" } },
});
