<?php

namespace Database\Seeders;

use App\Models\Outlet;
use Illuminate\Database\Seeder;

class OutletSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Outlet::create([
            'name' => 'Control P - Hithadhoo',
            'code' => 'CP-HIT',
            'is_active' => true,
        ]);

        Outlet::create([
            'name' => 'The Screen',
            'code' => 'TS',
            'is_active' => true,
        ]);
    }
}
