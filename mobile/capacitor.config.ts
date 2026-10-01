import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Provisional identifier. Confirm ownership before creating store records.
  appId: "com.muleaf.app",
  appName: "뮤리프",
  webDir: "dist",
  backgroundColor: "#100f15",
  ios: { contentInset: "automatic" },
  android: { allowMixedContent: false },
};

export default config;
