<?php

// Only what differs from Laravel's defaults (vendor/laravel/framework/config/cache.php):
// the API caches nothing, so the cache stays in files instead of needing a table.

return [

    'default' => env('CACHE_STORE', 'file'),

];
