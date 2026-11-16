<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 20)->default('owner');
            $table->foreignId('owner_id')->nullable()->after('role')->constrained('users')->nullOnDelete();
        });
        Schema::table('transactions', function (Blueprint $table) {
            $table->foreignId('cashier_id')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('transactions', fn (Blueprint $table) => $table->dropConstrainedForeignId('cashier_id'));
        Schema::table('users', fn (Blueprint $table) => $table->dropConstrainedForeignId('owner_id'));
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('role'));
    }
};
