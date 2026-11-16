<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class CreateInitialPosAccounts extends Command
{
    protected $signature = 'pos:create-initial-accounts';
    protected $description = 'Buat akun owner dan kasir pertama dengan password acak';

    public function handle(): int
    {
        if (DB::table('users')->exists()) {
            $this->error('Database sudah memiliki akun. Gunakan halaman Akun Kasir dari akun owner untuk menambah kasir.');
            return self::FAILURE;
        }

        $ownerPassword = Str::random(16) . '!';
        $cashierPassword = Str::random(16) . '!';
        DB::transaction(function () use ($ownerPassword, $cashierPassword) {
            $ownerId = DB::table('users')->insertGetId([
                'name' => 'Owner', 'store_name' => 'Toko UMKM', 'username' => 'owner',
                'email' => 'owner@pos.local', 'password' => Hash::make($ownerPassword),
                'role' => 'owner', 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('users')->insert([
                'name' => 'Kasir 1', 'store_name' => 'Toko UMKM', 'username' => 'kasir',
                'email' => 'kasir@pos.local', 'password' => Hash::make($cashierPassword),
                'role' => 'cashier', 'owner_id' => $ownerId, 'created_at' => now(), 'updated_at' => now(),
            ]);
        });

        $this->newLine();
        $this->info('Akun awal POS Pintar berhasil dibuat. Simpan kredensial berikut sekarang:');
        $this->table(['Role', 'Username', 'Password'], [
            ['Owner', 'owner', $ownerPassword],
            ['Kasir', 'kasir', $cashierPassword],
        ]);
        return self::SUCCESS;
    }
}
