<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>POS Pintar UMKM</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body>
    <div id="app" class="app-root">
        <div class="boot-screen"><span class="spinner"></span><p>Menyiapkan POS Pintar...</p></div>
    </div>
    <dialog id="dialog" class="dialog"></dialog>
    <div id="toast" class="toast" role="status" aria-live="polite"></div>
</body>
</html>