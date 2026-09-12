<?php
// Rinomina questo file in "config.php" (togli ".example") e inserisci
// i dati del tuo database Aruba, che trovi nel pannello di gestione
// hosting, di solito sotto "Database MySQL".

define('DB_HOST', 'localhost');       // di solito "localhost" su Aruba
define('DB_NAME', 'nome_del_database');
define('DB_USER', 'utente_database');
define('DB_PASS', 'password_database');

// Limita le richieste solo al tuo sito (evita che altri siti possano
// chiamare questa API dal browser di un visitatore). Se in futuro cambi
// dominio, aggiorna questo valore.
define('ALLOWED_ORIGIN', 'https://valterzoccarato.github.io');
