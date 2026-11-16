<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class CreatePosOwner extends Command
{
    protected $signature = 'pos:create-owner';
    protected $description = 'Buat akun owner POS dari terminal';

    public function handle(): int
    {
        $name = $this->ask('Nama pemilik');
        $store = $this->ask('Nama usaha');
        $username = $this->ask('Username login');
        $password = $this->secret('Password (minimal 8 karakter)');

        if (!$name || !$store || !$username || strlen((string) $password) < 8) {
            $this->error('Semua data wajib diisi dan password minimal 8 karakter.');
            return self::FAILURE;
        }
        if (DB::table('users')->where('username', $username)->exists()) {
            $this->error('Username sudah digunakan.');
            return self::FAILURE;
        }

        DB::table('users')->insert([
            'name' => $name, 'store_name' => $store, 'username' => $username,
            'email' => $username . '@pos.local', 'password' => Hash::make($password), 'role' => 'owner',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->info("Akun owner {$username} berhasil dibuat.");
        return self::SUCCESS;
    }
}
