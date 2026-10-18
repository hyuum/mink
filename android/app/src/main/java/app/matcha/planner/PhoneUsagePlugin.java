package app.matcha.planner;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Reads which app was on screen and when, from Android's usage stats. Needs "Usage access",
 * which the person turns on in system settings. Only app names and times leave this class.
 */
@CapacitorPlugin(name = "PhoneUsage")
public class PhoneUsagePlugin extends Plugin {
    // UsageEvents.Event types, as numbers so older Android versions still compile the same.
    private static final int ACTIVITY_RESUMED = 1;
    private static final int ACTIVITY_PAUSED = 2;
    private static final int SCREEN_NON_INTERACTIVE = 16;
    private static final int KEYGUARD_SHOWN = 17;
    private static final int ACTIVITY_STOPPED = 23;

    private final Map<String, String> labels = new HashMap<>();

    @PluginMethod
    public void hasAccess(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", granted());
        call.resolve(result);
    }

    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    /** Foreground sessions between `from` and `to` (epoch ms): { sessions: [{ pkg, label, start, end }] }. */
    @PluginMethod
    public void sessions(PluginCall call) {
        if (!granted()) {
            call.reject("Usage access is off", "NO_ACCESS");
            return;
        }
        long now = System.currentTimeMillis();
        long from = call.getLong("from", now - 24L * 3600_000L);
        long to = Math.min(call.getLong("to", now), now);
        Context ctx = getContext();
        UsageStatsManager usm = (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
        Set<String> skip = homeApps(ctx);
        skip.add(ctx.getPackageName());
        skip.add("com.android.systemui");

        JSArray out = new JSArray();
        UsageEvents events = usm.queryEvents(from, to);
        UsageEvents.Event e = new UsageEvents.Event();
        String current = null;
        long start = 0;
        while (events.hasNextEvent()) {
            events.getNextEvent(e);
            int type = e.getEventType();
            String pkg = e.getPackageName();
            long ts = e.getTimeStamp();
            if (type == ACTIVITY_RESUMED) {
                if (pkg.equals(current)) continue;
                if (current != null) add(out, current, start, ts, skip);
                current = pkg;
                start = ts;
            } else if ((type == ACTIVITY_PAUSED || type == ACTIVITY_STOPPED) && pkg.equals(current)) {
                add(out, current, start, ts, skip);
                current = null;
            } else if ((type == SCREEN_NON_INTERACTIVE || type == KEYGUARD_SHOWN) && current != null) {
                add(out, current, start, ts, skip);
                current = null;
            }
        }
        if (current != null) add(out, current, start, to, skip);
        JSObject result = new JSObject();
        result.put("sessions", out);
        call.resolve(result);
    }

    private void add(JSArray out, String pkg, long start, long end, Set<String> skip) {
        if (skip.contains(pkg) || end - start < 1000) return;
        JSObject s = new JSObject();
        s.put("pkg", pkg);
        s.put("label", label(pkg));
        s.put("start", start);
        s.put("end", end);
        out.put(s);
    }

    private String label(String pkg) {
        String cached = labels.get(pkg);
        if (cached != null) return cached;
        String name = pkg;
        try {
            PackageManager pm = getContext().getPackageManager();
            name = pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString();
        } catch (PackageManager.NameNotFoundException ignored) {
            // Uninstalled since: keep the package name.
        }
        labels.put(pkg, name);
        return name;
    }

    /** Launchers count as "on the home screen", not as using an app. */
    private static Set<String> homeApps(Context ctx) {
        Set<String> out = new HashSet<>();
        Intent home = new Intent(Intent.ACTION_MAIN);
        home.addCategory(Intent.CATEGORY_HOME);
        List<ResolveInfo> found = ctx.getPackageManager().queryIntentActivities(home, 0);
        for (ResolveInfo r : found) out.add(r.activityInfo.packageName);
        return out;
    }

    private boolean granted() {
        Context ctx = getContext();
        AppOpsManager ops = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
        int mode;
        if (Build.VERSION.SDK_INT >= 29) {
            mode = ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName());
        } else {
            mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName());
        }
        return mode == AppOpsManager.MODE_ALLOWED;
    }
}
