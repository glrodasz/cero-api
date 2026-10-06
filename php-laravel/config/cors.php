<?php

// Only what differs from Laravel's defaults (vendor/laravel/framework/config/cors.php),
// which already allow any origin, method and header. The routes have no /api
// prefix, so CORS has to cover every path.

return [

    'paths' => ['*'],

];
