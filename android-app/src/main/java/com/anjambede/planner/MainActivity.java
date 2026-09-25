package com.anjambede.planner;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.content.Intent;
import android.provider.Settings;
import android.content.pm.PackageManager;
import androidx.core.app.NotificationManagerCompat;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView webView;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        createNotificationChannel();
        requestNotificationPermission();
        webView = new WebView(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidNotifications");
        webView.loadUrl("file:///android_asset/index.html");
        AlarmScheduler.scheduleSummaries(this);
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(AlarmScheduler.CHANNEL_ID, "یادآوری‌ها", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("یادآوری کارها و موعد تمدید اشتراک‌ها");
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    public class AndroidBridge {
        @JavascriptInterface public void syncTasks(String json) {
            getSharedPreferences(AlarmScheduler.PREFS, MODE_PRIVATE).edit().putString("tasks", json).apply();
            AlarmScheduler.syncTasks(MainActivity.this, json);
        }
        @JavascriptInterface public void syncSubscriptions(String json) {
            SubscriptionScheduler.sync(MainActivity.this, json);
        }
        @JavascriptInterface public boolean notificationsAllowed() {
            return NotificationManagerCompat.from(MainActivity.this).areNotificationsEnabled();
        }
        @JavascriptInterface public void openNotificationSettings() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                startActivity(intent);
            });
        }
    }
}
