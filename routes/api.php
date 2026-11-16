<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PosController;

Route::post('/login', [PosController::class, 'login']);
Route::post('/payments/midtrans/notification', [PosController::class, 'notification']);
Route::middleware('pos.auth')->group(function () {
    Route::post('/logout', [PosController::class, 'logout']);
    Route::patch('/password', [PosController::class, 'changePassword']);
    Route::get('/me', [PosController::class, 'me']);
    Route::get('/dashboard', [PosController::class, 'dashboard']);
    Route::get('/products', [PosController::class, 'products']);
    Route::get('/cashiers', [PosController::class, 'cashiers']);
    Route::post('/cashiers', [PosController::class, 'createCashier']);
    Route::post('/products', [PosController::class, 'createProduct']);
    Route::put('/products/{product}', [PosController::class, 'updateProduct']);
    Route::delete('/products/{product}', [PosController::class, 'deleteProduct']);
    Route::post('/transactions', [PosController::class, 'checkout']);
    Route::get('/transactions', [PosController::class, 'transactions']);
});
