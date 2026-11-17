package dev.sidhulyalkar.iptvnator.preview;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;

/** Owns the packaged origin. Requests for missing assets never hit the network. */
final class LocalAssetClient extends WebViewClient {
    static final String HOST = "appassets.androidplatform.net";
    static final String HOME = "https://" + HOST + "/assets/";
    private final Activity activity;
    private final WebViewAssetLoader loader;

    LocalAssetClient(Activity activity) {
        this.activity = activity;
        loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(activity))
                .build();
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (!HOST.equals(uri.getHost())) return null;

        // A hostile page must never make an appassets request escape to the internet.
        if (!"https".equals(uri.getScheme()) || !uri.getPath().startsWith("/assets/")) {
            return missing();
        }
        WebResourceResponse local = loader.shouldInterceptRequest(uri);
        if (local != null) return local;
        if (request.isForMainFrame() && "GET".equals(request.getMethod())) {
            try {
                return new WebResourceResponse("text/html", "UTF-8",
                        activity.getAssets().open("index.html"));
            } catch (IOException ignored) {
                return missing();
            }
        }
        return missing();
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (!request.isForMainFrame()) return false;
        Uri uri = request.getUrl();
        if ("https".equals(uri.getScheme())
                && HOST.equals(uri.getHost())
                && uri.getPath().startsWith("/assets/")) return false;
        String scheme = uri.getScheme();
        if ("http".equals(scheme) || "https".equals(scheme)) {
            try {
                activity.startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (RuntimeException ignored) {
                // No browser installed. Do not navigate the privileged WebView.
            }
        }
        return true;
    }

    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
}
