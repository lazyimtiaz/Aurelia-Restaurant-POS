<?php

declare(strict_types=1);

return [
    'idle_lock_minutes' => (int) env('POS_IDLE_LOCK_MINUTES', 10),
];
