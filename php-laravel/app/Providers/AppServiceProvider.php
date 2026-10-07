<?php

namespace App\Providers;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // The contract answers the resource itself, not { "data": ... }.
        JsonResource::withoutWrapping();
    }
}
