package dev.sidhulyalkar.iptvnator.preview;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.webkit.ValueCallback;
import java.util.ArrayList;

/**
 * Minimal Fire OS shell. No Google Play Services, remote-code URL or Electron
 * bridge. Authentication and streaming remain subject to WebView capabilities.
 */
public final class MainActivity extends Activity {
    private static final int FILE_PICKER_REQUEST = 1001;
    private FrameLayout root;
    private WebView webView;
    private ValueCallback<Uri[]> filesCallback;
    private View fullScreenView;
    private WebChromeClient.CustomViewCallback fullScreenCallback;
    private boolean loadErrorShown;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(16, 26, 37));
        getWindow().setNavigationBarColor(Color.rgb(16, 26, 37));
        root = new FrameLayout(this);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(16, 26, 37));
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        // Compatibility mode keeps secure remote providers available and does
        // not automatically permit all mixed HTTP active content.
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        webView.setWebViewClient(new LocalAssetClient(this) {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                    WebResourceError error) {
                if (request.isForMainFrame()
                        && LocalAssetClient.HOST.equals(request.getUrl().getHost())) {
                    showLoadError();
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view,
                    ValueCallback<Uri[]> callback, FileChooserParams params) {
                cancelFileChooser();
                filesCallback = callback;
                Intent choose = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                choose.addCategory(Intent.CATEGORY_OPENABLE);
                choose.setType("*/*"); // .m3u often has no registered MIME type.
                choose.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                choose.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,
                        params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try {
                    startActivityForResult(choose, FILE_PICKER_REQUEST);
                    return true;
                } catch (RuntimeException noPicker) {
                    cancelFileChooser();
                    Toast.makeText(MainActivity.this,
                            R.string.open_playlist, Toast.LENGTH_LONG).show();
                    return false;
                }
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullScreenView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                fullScreenView = view;
                fullScreenCallback = callback;
                webView.setVisibility(View.GONE);
                root.addView(view, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT));
                getWindow().getDecorView().setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
                getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }

            @Override
            public void onHideCustomView() {
                exitVideoFullscreen();
            }
        });

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(LocalAssetClient.HOME);
        }
    }

    private void showLoadError() {
        if (loadErrorShown || isFinishing()) return;
        loadErrorShown = true;
        runOnUiThread(() -> new AlertDialog.Builder(this)
                .setMessage(R.string.load_error)
                .setPositiveButton(R.string.retry, (dialog, which) -> {
                    loadErrorShown = false;
                    webView.loadUrl(LocalAssetClient.HOME);
                })
                .setNegativeButton(android.R.string.cancel, null)
                .show());
    }

    private void cancelFileChooser() {
        if (filesCallback != null) {
            filesCallback.onReceiveValue(null);
            filesCallback = null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_PICKER_REQUEST || filesCallback == null) return;
        Uri[] selection = null;
        if (resultCode == RESULT_OK && data != null) {
            ClipData clips = data.getClipData();
            if (clips != null) {
                ArrayList<Uri> uris = new ArrayList<>();
                for (int i = 0; i < clips.getItemCount(); i++) {
                    uris.add(clips.getItemAt(i).getUri());
                }
                selection = uris.toArray(new Uri[0]);
            } else if (data.getData() != null) {
                selection = new Uri[] { data.getData() };
            }
        }
        filesCallback.onReceiveValue(selection);
        filesCallback = null;
    }

    private void exitVideoFullscreen() {
        if (fullScreenView == null) return;
        root.removeView(fullScreenView);
        fullScreenView = null;
        webView.setVisibility(View.VISIBLE);
        getWindow().getDecorView().setSystemUiVisibility(0);
        getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WebChromeClient.CustomViewCallback callback = fullScreenCallback;
        fullScreenCallback = null;
        if (callback != null) callback.onCustomViewHidden();
    }

    @Override
    public void onBackPressed() {
        if (fullScreenView != null) exitVideoFullscreen();
        else if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        webView.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        cancelFileChooser();
        exitVideoFullscreen();
        root.removeView(webView);
        webView.destroy();
        super.onDestroy();
    }
}
