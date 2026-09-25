package com.anjambede.planner;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.Set;

final class SubscriptionScheduler {
    private static final String DATA_KEY = "subscription_alarms";
    private static final String IDS_KEY = "subscription_ids";

    static void sync(Context context, String json) {
        context.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE).edit().putString(DATA_KEY, json).apply();
        reschedule(context);
    }

    static void reschedule(Context context) {
        reschedule(context, null);
    }

    static void reschedule(Context context, String firedEventId) {
        Set<String> previous = context.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE)
                .getStringSet(IDS_KEY, new HashSet<>());
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        for (String id : previous) {
            PendingIntent pending = pending(context, id, PendingIntent.FLAG_NO_CREATE | immutableFlag());
            if (pending != null) manager.cancel(pending);
        }
        Set<String> next = new HashSet<>();
        try {
            String raw = context.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE).getString(DATA_KEY, "[]");
            JSONArray subscriptions = new JSONArray(raw);
            long now = System.currentTimeMillis();
            for (int i = 0; i < subscriptions.length(); i++) {
                JSONObject subscription = subscriptions.getJSONObject(i);
                JSONArray events = subscription.getJSONArray("events");
                JSONObject soonest = null;
                long soonestAt = Long.MAX_VALUE;
                for (int j = 0; j < events.length(); j++) {
                    JSONObject event = events.getJSONObject(j);
                    long at = event.getLong("at");
                    String candidateId = subscription.getString("id") + ":" + event.getInt("cycle") + ":" + event.getString("kind");
                    if (candidateId.equals(firedEventId)) continue;
                    if (at > now && at < soonestAt) { soonest = event; soonestAt = at; }
                }
                if (soonest == null) continue;
                String eventId = subscription.getString("id") + ":" + soonest.getInt("cycle") + ":" + soonest.getString("kind");
                Intent intent = new Intent(context, SubscriptionReceiver.class)
                        .putExtra("eventId", eventId)
                        .putExtra("title", subscription.getString("title"))
                        .putExtra("kind", soonest.getString("kind"));
                PendingIntent pending = PendingIntent.getBroadcast(context, eventId.hashCode(), intent,
                        PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag());
                AlarmScheduler.setAlarm(context, soonestAt, pending);
                next.add(eventId);
            }
        } catch (Exception ignored) { }
        context.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE).edit().putStringSet(IDS_KEY, next).apply();
    }

    private static PendingIntent pending(Context context, String id, int flags) {
        return PendingIntent.getBroadcast(context, id.hashCode(), new Intent(context, SubscriptionReceiver.class), flags);
    }

    private static int immutableFlag() { return Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0; }
}
