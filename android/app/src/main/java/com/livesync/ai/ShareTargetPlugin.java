package com.livesync.ai;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lets the user share text (for example a bank alert) from any app into LiveSync.
 *
 * Only plain text the user chose to share is received — LiveSync never reads the SMS inbox. The text is held in
 * memory until the web layer collects it, shown on the review screen, and nothing is saved without the user's say-so.
 */
@CapacitorPlugin(name = "ShareTarget")
public class ShareTargetPlugin extends Plugin {
    /** Shared text is untrusted input: cap its size. */
    private static final int MAX_CHARS = 20000;

    private static String pending = null;
    private static ShareTargetPlugin instance = null;

    @Override
    public void load() {
        instance = this;
    }

    /** Called from MainActivity for the launch intent and for every later share into the running app. */
    static void capture(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String type = intent.getType();
        if (type == null || !type.startsWith("text/")) return;
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (text == null || text.toString().trim().isEmpty()) return;
        String value = text.toString();
        pending = value.length() > MAX_CHARS ? value.substring(0, MAX_CHARS) : value;
        // Handle each share once, even if the activity is re-delivered the same intent.
        intent.setAction(Intent.ACTION_MAIN);
        if (instance != null) {
            instance.notifyListeners("shareReceived", new JSObject(), true);
        }
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        JSObject result = new JSObject();
        result.put("text", pending);
        pending = null;
        call.resolve(result);
    }
}
