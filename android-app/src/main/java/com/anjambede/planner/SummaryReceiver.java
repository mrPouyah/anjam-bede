package com.anjambede.planner;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class SummaryReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String period = intent.getStringExtra("period");
        boolean midday = "midday".equals(period);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        int total = 0, done = 0;
        try {
            String json = context.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE).getString("tasks", "[]");
            JSONArray tasks = new JSONArray(json);
            for (int i = 0; i < tasks.length(); i++) {
                JSONObject task = tasks.getJSONObject(i);
                if (!today.equals(task.optString("date"))) continue;
                if (midday && task.optString("time", "99:99").compareTo("12:00") >= 0) continue;
                total++;
                if (task.optBoolean("done", false)) done++;
            }
        } catch (Exception ignored) { }

        int pending = total - done;
        String title = midday ? "خلاصهٔ نیمهٔ اول روز" : "خلاصهٔ امروز";
        String body = total == 0 ? "برای این بازه کاری ثبت نشده بود." : done + " کار انجام شد و " + pending + " کار باقی ماند.";
        Intent open = new Intent(context, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, AlarmScheduler.CHANNEL_ID)
                .setSmallIcon(R.drawable.logo_mark).setContentTitle(title).setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body)).setContentIntent(content)
                .setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH);
        ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).notify(midday ? 60001 : 60002, notification.build());
        AlarmScheduler.scheduleSummary(context, period, midday ? 11 : 23, 55);
    }
}
