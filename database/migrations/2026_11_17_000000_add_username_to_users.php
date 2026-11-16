<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->string('username', 100)->nullable()->unique());
        foreach (DB::table('users')->whereNull('username')->get(['id', 'email']) as $user) {
            $base = preg_replace('/[^a-zA-Z0-9_.-]/', '', explode('@', $user->email)[0]) ?: 'owner';
            $username = $base;
            $suffix = 1;
            while (DB::table('users')->where('username', $username)->exists()) $username = $base . $suffix++;
            DB::table('users')->where('id', $user->id)->update(['username' => $username]);
        }
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropUnique(['username']));
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('username'));
    }
};
