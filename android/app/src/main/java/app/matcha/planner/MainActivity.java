package app.matcha.planner;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PhoneUsagePlugin.class);
        registerPlugin(BankNotesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
