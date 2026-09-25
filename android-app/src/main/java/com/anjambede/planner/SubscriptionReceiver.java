package com.anjambede.planner;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationCompat;

public class SubscriptionReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String kind = intent.getStringExtra("kind");
        String title = intent.getStringExtra("title");
        String eventId = intent.getStringExtra("eventId");
        if (title != null && eventId != null) {
            Intent open = new Intent(context, MainActivity.class)
                    .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent content = PendingIntent.getActivity(context, 0, open,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            String heading = "due".equals(kind) ? "زمان تمدید اشتراک رسید" : "تمدید اشتراک نزدیک است";
            NotificationCompat.Builder notification = new NotificationCompat.Builder(context, AlarmScheduler.CHANNEL_ID)
                    .setSmallIcon(R.drawable.logo_mark).setContentTitle(heading).setContentText(title)
                    .setContentIntent(content).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH);
            ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE))
                    .notify(eventId.hashCode(), notification.build());
        }
        SubscriptionScheduler.reschedule(context, eventId);
    }
}
