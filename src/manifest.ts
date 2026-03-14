import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
    manifest_version: 3,
    name: "TimeWise",
    version: "1.0.0",
    description: "A Chrome extension to track and manage your time effectively.",
    permissions: ["storage", "tabs", "activeTab", "clipboardWrite", "idle", "alarms"],
    host_permissions: ["http://localhost:3031/*", "http://192.168.50.233:3031/*"],
    background: {
        service_worker: "src/background/background.ts",
        type: "module"
    },
    action: {
        default_popup: "index.html"
    },
});
