<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class PosAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        $user = $token ? DB::table('users')->where('api_token', hash('sha256', $token))->first() : null;
        if (!$user) return response()->json(['message' => 'Sesi tidak valid. Silakan login kembali.'], 401);
        $request->attributes->set('pos_user', $user);
        return $next($request);
    }
}
