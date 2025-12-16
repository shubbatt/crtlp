<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Product;
use App\Models\PricingRule;

class ProductsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Inventory Products
        $businessCards = Product::create([
            'sku' => 'BC-001',
            'name' => 'Business Cards',
            'description' => 'Standard business cards, 350gsm',
            'type' => 'inventory',
            'unit_cost' => 0.50,
            'stock_qty' => 10000,
            'min_stock_alert' => 1000,
            'is_active' => true,
        ]);

        // Quantity tier pricing for business cards
        PricingRule::create([
            'product_id' => $businessCards->id,
            'rule_type' => 'quantity_tier',
            'config' => json_encode([
                ['min_qty' => 1, 'max_qty' => 100, 'price' => 1.00],
                ['min_qty' => 101, 'max_qty' => 500, 'price' => 0.75],
                ['min_qty' => 501, 'max_qty' => 1000, 'price' => 0.60],
                ['min_qty' => 1001, 'max_qty' => null, 'price' => 0.50],
            ]),
            'priority' => 10,
        ]);

        $flyers = Product::create([
            'sku' => 'FLY-001',
            'name' => 'Flyers A5',
            'description' => 'A5 Flyers, 150gsm glossy',
            'type' => 'inventory',
            'unit_cost' => 0.30,
            'stock_qty' => 5000,
            'min_stock_alert' => 500,
            'is_active' => true,
        ]);

        PricingRule::create([
            'product_id' => $flyers->id,
            'rule_type' => 'quantity_tier',
            'config' => json_encode([
                ['min_qty' => 1, 'max_qty' => 50, 'price' => 0.80],
                ['min_qty' => 51, 'max_qty' => 200, 'price' => 0.60],
                ['min_qty' => 201, 'max_qty' => 500, 'price' => 0.45],
                ['min_qty' => 501, 'max_qty' => null, 'price' => 0.35],
            ]),
            'priority' => 10,
        ]);

        // Dimension-based Products
        $banner = Product::create([
            'sku' => 'BAN-001',
            'name' => 'Vinyl Banner',
            'description' => 'Custom size vinyl banner printing',
            'type' => 'dimension',
            'unit_cost' => 8.00,
            'stock_qty' => 0,
            'min_stock_alert' => 0,
            'is_active' => true,
        ]);

        // Dimension-based pricing (per square foot)
        PricingRule::create([
            'product_id' => $banner->id,
            'rule_type' => 'dimension',
            'config' => json_encode([
                'unit' => 'sqft',
                'base_price' => 12.00,
                'min_size' => 1,
                'max_size' => null,
            ]),
            'priority' => 10,
        ]);

        $poster = Product::create([
            'sku' => 'POST-001',
            'name' => 'Large Format Poster',
            'description' => 'Custom poster printing',
            'type' => 'dimension',
            'unit_cost' => 5.00,
            'stock_qty' => 0,
            'min_stock_alert' => 0,
            'is_active' => true,
        ]);

        PricingRule::create([
            'product_id' => $poster->id,
            'rule_type' => 'dimension',
            'config' => json_encode([
                'unit' => 'sqft',
                'base_price' => 8.00,
                'min_size' => 1,
                'max_size' => null,
            ]),
            'priority' => 10,
        ]);

        // Service Products
        $designService = Product::create([
            'sku' => 'SRV-DESIGN',
            'name' => 'Graphic Design Service',
            'description' => 'Professional graphic design service',
            'type' => 'service',
            'unit_cost' => 30.00,
            'stock_qty' => 0,
            'min_stock_alert' => 0,
            'is_active' => true,
        ]);

        PricingRule::create([
            'product_id' => $designService->id,
            'rule_type' => 'fixed',
            'config' => json_encode([
                'price' => 50.00,
            ]),
            'priority' => 10,
        ]);

        $lamination = Product::create([
            'sku' => 'SRV-LAM',
            'name' => 'Lamination Service',
            'description' => 'Professional lamination',
            'type' => 'service',
            'unit_cost' => 2.00,
            'stock_qty' => 0,
            'min_stock_alert' => 0,
            'is_active' => true,
        ]);

        PricingRule::create([
            'product_id' => $lamination->id,
            'rule_type' => 'dimension',
            'config' => json_encode([
                'unit' => 'sqft',
                'base_price' => 3.00,
                'min_size' => 1,
                'max_size' => null,
            ]),
            'priority' => 10,
        ]);

        $this->command->info('Products and pricing rules created successfully!');
    }
}
