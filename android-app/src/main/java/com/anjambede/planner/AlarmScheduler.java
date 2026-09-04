package com.anjambede.planner;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

final class AlarmScheduler {
    static final String CHANNEL_ID = "task_reminders";
    static final String PREFS = "anjam_bede_native";
    private static final long FIVE_MINUTES = 5 * 60 * 1000L;

    static void syncTasks(Context context, String json) {
        cancelPreviouslyScheduled(context);
        Set<String> ids = new HashSet<>();
        try {
            JSONArray tasks = new JSONArray(json);
            SimpleDateFormat parser = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US);
            parser.setLenient(false);
            for (int i = 0; i < tasks.length(); i++) {
                JSONObject task = tasks.getJSONObject(i);
                if (task.optBoolean("done", false)) continue;
                String id = task.getString("id");
                Date date = parser.parse(task.getString("date") + " " + task.getString("time"));
                if (date == null || date.getTime() <= System.currentTimeMillis()) continue;
                ids.add(id);
                scheduleTaskAlarm(context, id, task.optString("title", "کار امروز"), date.getTime() - FIVE_MINUTES, false);
                scheduleTaskAlarm(context, id, task.optString("title", "کار امروز"), date.getTime(), true);
            }
        } catch (Exception ignored) { }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putStringSet("scheduled_ids", ids).apply();
        scheduleSummaries(context);
    }

    private static void cancelPreviouslyScheduled(Context context) {
        Set<String> ids = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getStringSet("scheduled_ids", new HashSet<>());
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        for (String id : ids) {
            PendingIntent early = taskPendingIntent(context, id, false, PendingIntent.FLAG_NO_CREATE | immutableFlag());
            PendingIntent due = taskPendingIntent(context, id, true, PendingIntent.FLAG_NO_CREATE | immutableFlag());
            if (early != null) manager.cancel(early);
            if (due != null) manager.cancel(due);
        }
    }

    private static void scheduleTaskAlarm(Context context, String id, String title, long at, boolean due) {
        Intent intent = new Intent(context, ReminderReceiver.class)
                .putExtra("id", id).putExtra("title", title).putExtra("due", due);
        PendingIntent pending = PendingIntent.getBroadcast(context, requestCode(id, due), intent, PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag());
        setAlarm(context, at, pending);
    }

    private static PendingIntent taskPendingIntent(Context context, String id, boolean due, int flags) {
        return PendingIntent.getBroadcast(context, requestCode(id, due), new Intent(context, ReminderReceiver.class), flags);
    }

    static void scheduleSummaries(Context context) {
        scheduleSummary(context, "midday", 11, 55);
        scheduleSummary(context, "day", 23, 55);
    }

    static void scheduleSummary(Context context, String period, int hour, int minute) {
        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, hour); next.set(Calendar.MINUTE, minute); next.set(Calendar.SECOND, 0); next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis()) next.add(Calendar.DAY_OF_YEAR, 1);
        Intent intent = new Intent(context, SummaryReceiver.class).putExtra("period", period);
        PendingIntent pending = PendingIntent.getBroadcast(context, period.equals("midday") ? 60001 : 60002, intent, PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag());
        setAlarm(context, next.getTimeInMillis(), pending);
    }

    private static void setAlarm(Context context, long at, PendingIntent pending) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        try {
            if (Build.VERSION.SDK_INT >= 23) manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
            else manager.setExact(AlarmManager.RTC_WAKEUP, at, pending);
        } catch (SecurityException error) {
            if (Build.VERSION.SDK_INT >= 23) manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
            else manager.set(AlarmManager.RTC_WAKEUP, at, pending);
        }
    }

    private static int requestCode(String id, boolean due) { return (id + (due ? ":due" : ":five")).hashCode(); }
    private static int immutableFlag() { return Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0; }
}
