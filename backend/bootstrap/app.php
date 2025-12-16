<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // CORS is handled automatically by Laravel based on config/cors.php
        // No explicit middleware registration needed
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // CORS is handled automatically by Laravel's HandleCors middleware
        // based on config/cors.php configuration
    })->create();
