<?php

// Only what differs from Laravel's defaults (vendor/laravel/framework/config/filesystems.php):
// the local disk is not served over HTTP, so the API has no /storage/{path} routes.

return [

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'throw' => false,
            'report' => false,
        ],

    ],

];
