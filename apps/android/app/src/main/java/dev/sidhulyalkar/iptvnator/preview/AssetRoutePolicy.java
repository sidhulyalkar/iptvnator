package dev.sidhulyalkar.iptvnator.preview;

/** Routes documents to Angular, while leaving real assets to the APK loader. */
final class AssetRoutePolicy {
    private static final String ROOT = "/assets/";

    private AssetRoutePolicy() {}

    static boolean shouldServeIndex(String path, String method, boolean mainFrame) {
        if (!mainFrame || !"GET".equals(method) || path == null || !path.startsWith(ROOT)) {
            return false;
        }
        String relative = path.substring(ROOT.length());
        if (relative.isEmpty() || "index.html".equals(relative)) return true;
        // Angular routes have no file extension. Never return HTML for a missing
        // JS/CSS/font/manifest, which would mask an incomplete APK bundle.
        for (String part : relative.split("/", -1)) {
            if (".".equals(part) || "..".equals(part) || part.contains("\\") || part.contains(".")) {
                return false;
            }
        }
        return true;
    }
}
