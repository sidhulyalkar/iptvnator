package dev.sidhulyalkar.iptvnator.preview;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import org.junit.Test;

public class AssetRoutePolicyTest {
    @Test public void launchAndSpaRoutesReturnAngularIndex() {
        assertTrue(AssetRoutePolicy.shouldServeIndex("/assets/", "GET", true));
        assertTrue(AssetRoutePolicy.shouldServeIndex("/assets/index.html", "GET", true));
        assertTrue(AssetRoutePolicy.shouldServeIndex("/assets/workspace", "GET", true));
        assertTrue(AssetRoutePolicy.shouldServeIndex("/assets/workspace/channels/123", "GET", true));
        assertTrue(AssetRoutePolicy.shouldServeIndex("/assets/workspace/", "GET", true));
    }

    @Test public void staticAssetsAreNeverMisidentifiedAsDocuments() {
        assertFalse(AssetRoutePolicy.shouldServeIndex("/assets/main-DEADBEEF.js", "GET", true));
        assertFalse(AssetRoutePolicy.shouldServeIndex("/assets/styles.css", "GET", true));
        assertFalse(AssetRoutePolicy.shouldServeIndex("/assets/assets/icons/favicon.ico", "GET", true));
        assertFalse(AssetRoutePolicy.shouldServeIndex("/assets/assets/fonts/inter.woff2", "GET", true));
        assertFalse(AssetRoutePolicy.shouldServeIndex("/assets/assets/../escape", "GET", true));
        assertFalse(AssetRoutePolicy.shouldServeIndex("/assets/main.js/route", "GET", true));
    }

    @Test public void wrongMethodHostPathOrFrameCannotServeTheApp() {
        assertFalse(AssetRoutePolicy.shouldServeIndex("/assets/", "POST", true));
        assertFalse(AssetRoutePolicy.shouldServeIndex("/assets/", "GET", false));
        assertFalse(AssetRoutePolicy.shouldServeIndex("/other/", "GET", true));
        assertFalse(AssetRoutePolicy.shouldServeIndex(null, "GET", true));
    }
}
