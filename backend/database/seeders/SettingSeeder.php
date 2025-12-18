<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $settings = [
            'tax_rate' => '10',
            'receipt_header' => 'Thank you for your order!',
            'receipt_footer' => 'Visit us again soon!',
            'email_orders' => 'true',
            'email_ready' => 'true',
            'low_stock' => 'false',
        ];

        foreach ($settings as $key => $value) {
            \App\Models\Setting::updateOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
