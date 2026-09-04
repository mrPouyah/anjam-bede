package com.anjambede.planner;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationCompat;

public class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        boolean due = intent.getBooleanExtra("due", false);
        String title = intent.getStringExtra("title");
        Intent open = new Intent(context, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, AlarmScheduler.CHANNEL_ID)
                .setSmallIcon(com.anjambede.planner.R.drawable.logo_mark)
                .setContentTitle(due ? "وقت انجام کار رسید" : "پنج دقیقه تا کار بعدی")
                .setContentText(title).setContentIntent(content).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH);
        ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).notify((title + due).hashCode(), notification.build());
    }
}
