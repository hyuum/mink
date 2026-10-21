package app.matcha.planner;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Keeps the notifications that look like spending ("$12.50 at Mugi Café") so the app can suggest
 * them as spends. Runs on the phone only and keeps nothing else: a notification without a dollar
 * amount is ignored, and from apps the person hasn't picked only the app's name is kept, so it can
 * be offered in the list of apps to read. Everything is kept for 30 days at most.
 */
public class BankListener extends NotificationListenerService {
    static final String PREFS = "matcha_bank";
    static final String WATCHED = "watched";
    static final String SEEN = "seen";
    static final String ITEMS = "items";
    static final long KEEP_MS = 30L * 24 * 60 * 60 * 1000;
    static final int MAX_ITEMS = 400;
    private static final Pattern AMOUNT = Pattern.compile("(A?\\$|AUD)\\s?\\d");

    /**
     * Android keeps no history apps can read, but notifications still in the shade can be: read them
     * when access is turned on, and again whenever the app asks (after you tick a new app).
     */
    @Override
    public void onListenerConnected() {
        running = this;
        scanActive();
    }

    @Override
    public void onListenerDisconnected() {
        if (running == this) running = null;
    }

    /** The connected listener, so the app can ask for a fresh read of the shade. */
    static volatile BankListener running;

    void scanActive() {
        try {
            StatusBarNotification[] active = getActiveNotifications();
            if (active != null) for (StatusBarNotification sbn : active) onNotificationPosted(sbn);
        } catch (Exception ignored) {
            // Nothing to pick up.
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            Notification n = sbn.getNotification();
            if (n == null || sbn.isOngoing() || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
            String pkg = sbn.getPackageName();
            if (pkg == null || pkg.equals(getPackageName())) return;
            Bundle extras = n.extras;
            if (extras == null) return;
            String title = str(extras.getCharSequence(Notification.EXTRA_TITLE));
            CharSequence big = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            String text = str(big != null ? big : extras.getCharSequence(Notification.EXTRA_TEXT));
            if (!AMOUNT.matcher(title + " " + text).find()) return;
            record(this, pkg, title, text, sbn.getPostTime());
        } catch (Exception ignored) {
            // A notification we can't read is simply skipped.
        }
    }

    private static String str(CharSequence s) { return s == null ? "" : s.toString(); }

    static synchronized void record(Context ctx, String pkg, String title, String text, long postedAt) throws JSONException {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        SharedPreferences.Editor edit = prefs.edit();

        JSONObject seen = new JSONObject(prefs.getString(SEEN, "{}"));
        JSONObject app = seen.optJSONObject(pkg);
        if (app == null) { app = new JSONObject(); app.put("label", label(ctx, pkg)); app.put("count", 0); }
        // Reading the shade again sees the same notifications: only newer ones add to the count.
        if (postedAt > app.optLong("last")) {
            app.put("count", app.optInt("count") + 1);
            app.put("last", postedAt);
        }
        seen.put(pkg, app);
        edit.putString(SEEN, seen.toString());

        Set<String> watched = prefs.getStringSet(WATCHED, new HashSet<>());
        if (watched.contains(pkg)) {
            JSONArray old = new JSONArray(prefs.getString(ITEMS, "[]"));
            JSONArray items = new JSONArray();
            long cutoff = System.currentTimeMillis() - KEEP_MS;
            String key = pkg + ":" + postedAt + ":" + Integer.toHexString((title + "|" + text).hashCode());
            int start = Math.max(0, old.length() - (MAX_ITEMS - 1));
            for (int i = start; i < old.length(); i++) {
                JSONObject o = old.getJSONObject(i);
                if (o.optLong("postedAt") < cutoff) continue;
                // The same notification posted again (an update) replaces the earlier copy.
                if (o.optString("key").equals(key)) continue;
                items.put(o);
            }
            JSONObject item = new JSONObject();
            item.put("key", key);
            item.put("pkg", pkg);
            item.put("label", app.optString("label", pkg));
            item.put("title", title);
            item.put("text", text);
            item.put("postedAt", postedAt);
            items.put(item);
            edit.putString(ITEMS, items.toString());
        }
        edit.apply();
    }

    static String label(Context ctx, String pkg) {
        try {
            PackageManager pm = ctx.getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(info).toString();
        } catch (Exception e) {
            return pkg;
        }
    }
}
