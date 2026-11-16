<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('store_name')->nullable();
            $table->string('api_token', 64)->nullable()->unique();
        });
        Schema::create('products', function (Blueprint $table) {
            $table->id(); $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name'); $table->string('category')->default('Umum');
            $table->unsignedInteger('stock')->default(0); $table->unsignedInteger('low_stock_at')->default(10);
            $table->json('variants'); $table->timestamps();
        });
        Schema::create('transactions', function (Blueprint $table) {
            $table->id(); $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('code')->unique(); $table->unsignedBigInteger('total');
            $table->string('payment_method'); $table->string('status')->default('pending');
            $table->string('provider_reference')->nullable()->index(); $table->text('qr_code_url')->nullable();
            $table->timestamp('paid_at')->nullable(); $table->timestamps();
        });
        Schema::create('transaction_items', function (Blueprint $table) {
            $table->id(); $table->foreignId('transaction_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->string('product_name'); $table->string('variant_name');
            $table->unsignedInteger('quantity'); $table->unsignedBigInteger('unit_price');
            $table->unsignedBigInteger('subtotal'); $table->timestamps();
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('transaction_items'); Schema::dropIfExists('transactions'); Schema::dropIfExists('products');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['store_name', 'api_token']));
    }
};
