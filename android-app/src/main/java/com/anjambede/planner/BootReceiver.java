package com.anjambede.planner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        String tasks = context.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE).getString("tasks", "[]");
        AlarmScheduler.syncTasks(context, tasks);
        AlarmScheduler.scheduleSummaries(context);
    }
}
