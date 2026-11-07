<?php

/*
 * Nur was vom Paket abweicht; alles andere kommt aus
 * vendor/inertiajs/inertia-laravel/config/inertia.php.
 *
 * Das Paket sucht Seiten unter js/pages, hier heisst der Ordner js/Pages.
 * Auf dem Mac faellt das nicht auf, weil das Dateisystem Gross- und
 * Kleinschreibung gleich behandelt - in GitHub Actions (Linux) schlaegt dann
 * jeder Test fehl, der mit ->component() prueft, ob die Seite existiert.
 */
return [

    'pages' => [

        'ensure_pages_exist' => false,

        'paths' => [
            resource_path('js/Pages'),
        ],

        'extensions' => ['tsx', 'ts'],

    ],

];
