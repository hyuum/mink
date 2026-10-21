package app.matcha.planner;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;

/**
 * The app's side of BankListener: whether notification access is on, which apps to read, the apps
 * that have shown amounts, and the kept notifications.
 */
@CapacitorPlugin(name = "BankNotes")
public class BankNotesPlugin extends Plugin {
    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(BankListener.PREFS, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void hasAccess(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", NotificationManagerCompat.getEnabledListenerPackages(getContext()).contains(getContext().getPackageName()));
        call.resolve(result);
    }

    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        Intent intent = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    /** App info, where Android 13+ keeps "Allow restricted settings" for apps installed outside Play. */
    @PluginMethod
    public void openAppInfo(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    /** Which apps to read: { packages: [...] }. Apps no longer picked lose what was kept from them. */
    @PluginMethod
    public void setWatched(PluginCall call) {
        JSArray list = call.getArray("packages", new JSArray());
        Set<String> set = new HashSet<>();
        try { for (int i = 0; i < list.length(); i++) set.add(list.getString(i)); } catch (Exception ignored) { }
        SharedPreferences.Editor edit = prefs().edit().putStringSet(BankListener.WATCHED, set);
        try {
            JSONArray items = new JSONArray(prefs().getString(BankListener.ITEMS, "[]"));
            JSONArray kept = new JSONArray();
            for (int i = 0; i < items.length(); i++) if (set.contains(items.getJSONObject(i).optString("pkg"))) kept.put(items.getJSONObject(i));
            edit.putString(BankListener.ITEMS, kept.toString());
        } catch (Exception ignored) { }
        edit.apply();
        call.resolve();
    }

    /** Apps that have shown a dollar amount: { apps: [{ pkg, label, count, last }] }. */
    @PluginMethod
    public void seenApps(PluginCall call) {
        JSArray apps = new JSArray();
        try {
            JSONObject seen = new JSONObject(prefs().getString(BankListener.SEEN, "{}"));
            for (Iterator<String> it = seen.keys(); it.hasNext(); ) {
                String pkg = it.next();
                JSONObject a = seen.getJSONObject(pkg);
                JSObject o = new JSObject();
                o.put("pkg", pkg);
                o.put("label", a.optString("label", pkg));
                o.put("count", a.optInt("count"));
                o.put("last", a.optLong("last"));
                apps.put(o);
            }
        } catch (Exception ignored) { }
        JSObject result = new JSObject();
        result.put("apps", apps);
        call.resolve(result);
    }

    /** Kept notifications posted after `since` (epoch ms): { items: [{ key, pkg, label, title, text, postedAt }] }. */
    @PluginMethod
    public void items(PluginCall call) {
        long since = call.getLong("since", 0L);
        JSArray out = new JSArray();
        try {
            JSONArray items = new JSONArray(prefs().getString(BankListener.ITEMS, "[]"));
            for (int i = 0; i < items.length(); i++) {
                JSONObject o = items.getJSONObject(i);
                if (o.optLong("postedAt") >= since) out.put(o);
            }
        } catch (Exception ignored) { }
        JSObject result = new JSObject();
        result.put("items", out);
        call.resolve(result);
    }

    /** Asks Android to reconnect the listener, which it sometimes drops after an update. */
    @PluginMethod
    public void rebind(PluginCall call) {
        try {
            NotificationListenerService.requestRebind(new ComponentName(getContext(), BankListener.class));
        } catch (Exception ignored) { }
        call.resolve();
    }
}
