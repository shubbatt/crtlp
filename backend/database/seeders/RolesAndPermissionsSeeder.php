<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create Roles with Permissions
        $roles = [
            [
                'name' => 'admin',
                'permissions' => json_encode([
                    'users' => ['create', 'read', 'update', 'delete'],
                    'roles' => ['create', 'read', 'update', 'delete'],
                    'products' => ['create', 'read', 'update', 'delete'],
                    'pricing' => ['create', 'read', 'update', 'delete', 'override'],
                    'orders' => ['create', 'read', 'update', 'delete', 'cancel', 'approve'],
                    'service_jobs' => ['create', 'read', 'update', 'assign'],
                    'customers' => ['create', 'read', 'update', 'delete', 'set_credit'],
                    'quotations' => ['create', 'read', 'update', 'delete', 'approve', 'convert'],
                    'invoices' => ['create', 'read', 'update', 'void'],
                    'payments' => ['create', 'read', 'refund'],
                    'reports' => ['view_all', 'export'],
                    'audit_logs' => ['read'],
                ])
            ],
            [
                'name' => 'manager',
                'permissions' => json_encode([
                    'users' => ['read'],
                    'products' => ['create', 'read', 'update'],
                    'pricing' => ['create', 'read', 'update', 'override'],
                    'orders' => ['create', 'read', 'update', 'cancel', 'approve'],
                    'service_jobs' => ['read', 'update', 'assign'],
                    'customers' => ['create', 'read', 'update'],
                    'quotations' => ['create', 'read', 'update', 'approve', 'convert'],
                    'invoices' => ['create', 'read', 'update'],
                    'payments' => ['create', 'read'  ],
                    'reports' => ['view_all', 'export'],
                    'audit_logs' => ['read'],
                ])
            ],
            [
                'name' => 'counter_staff',
                'permissions' => json_encode([
                    'products' => ['read'],
                    'orders' => ['create', 'read', 'update'],
                    'service_jobs' => ['read'],
                    'customers' => ['create', 'read', 'update'],
                    'quotations' => ['create', 'read', 'convert'],
                    'invoices' => ['create', 'read'],
                    'payments' => ['create', 'read'],
                ])
            ],
            [
                'name' => 'back_office',
                'permissions' => json_encode([
                    'products' => ['read'],
                    'service_jobs' => ['read', 'update', 'assign'],
                ])
            ],
            [
                'name' => 'accounts',
                'permissions' => json_encode([
                    'customers' => ['read', 'set_credit'],
                    'orders' => ['read'],
                    'invoices' => ['create', 'read', 'update', 'void'],
                    'payments' => ['create', 'read', 'refund'],
                    'reports' => ['view_finance', 'export'],
                    'audit_logs' => ['read'],
                ])
            ],
        ];

        foreach ($roles as $roleData) {
            Role::create($roleData);
        }

        // Create default admin user
        $adminRole = Role::where('name', 'admin')->first();
        User::create([
            'name' => 'Admin User',
            'email' => 'admin@printshop.com',
            'password' => Hash::make('password'),
            'role_id' => $adminRole->id,
            'email_verified_at' => now(),
        ]);

        // Create default manager
        $managerRole = Role::where('name', 'manager')->first();
        User::create([
            'name' => 'Manager User',
            'email' => 'manager@printshop.com',
            'password' => Hash::make('password'),
            'role_id' => $managerRole->id,
            'email_verified_at' => now(),
        ]);

        // Create counter staff
        $counterRole = Role::where('name', 'counter_staff')->first();
        User::create([
            'name' => 'Counter Staff',
            'email' => 'counter@printshop.com',
            'password' => Hash::make('password'),
            'role_id' => $counterRole->id,
            'email_verified_at' => now(),
        ]);

        // Create back office user
        $backOfficeRole = Role::where('name', 'back_office')->first();
        User::create([
            'name' => 'Production Staff',
            'email' => 'production@printshop.com',
            'password' => Hash::make('password'),
            'role_id' => $backOfficeRole->id,
            'email_verified_at' => now(),
        ]);

        // Create accounts user
        $accountsRole = Role::where('name', 'accounts')->first();
        User::create([
            'name' => 'Accounts Staff',
            'email' => 'accounts@printshop.com',
            'password' => Hash::make('password'),
            'role_id' => $accountsRole->id,
            'email_verified_at' => now(),
        ]);

        $this->command->info('Roles and users created successfully!');
    }
}
