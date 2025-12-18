<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Setting;

class SettingController extends Controller
{
    /**
     * Get all settings
     */
    public function index()
    {
        return response()->json(Setting::all()->pluck('value', 'key'));
    }

    /**
     * Update or create settings
     */
    public function update(Request $request)
    {
        $settings = $request->all();
        
        foreach ($settings as $key => $value) {
            Setting::updateOrCreate(
                ['key' => $key],
                ['value' => is_array($value) ? json_encode($value) : $value]
            );
        }

        return response()->json(['message' => 'Settings updated successfully']);
    }
}
