# Backend classifica — Aruba (PHP + MySQL)

Alternativa al Cloudflare Worker, pensata per chi ha già un hosting
Aruba con PHP e MySQL a disposizione.

## Passaggi

1. **Crea il database**: dal pannello di gestione hosting Aruba, sezione
   "Database MySQL" — crea un nuovo database (o usane uno esistente) e un
   utente con permessi di lettura/scrittura su quel database. Annota
   host, nome database, utente e password: ti servono al passo 3.

2. **Crea la tabella**: apri phpMyAdmin dal pannello Aruba, seleziona il
   database appena creato, vai su "SQL" e incolla il contenuto di
   `schema.sql`. Esegui.

3. **Configura le credenziali**: rinomina `config.example.php` in
   `config.php` e inserisci i dati del database annotati al passo 1.

4. **Carica i file**: via FTP (o File Manager del pannello Aruba), carica
   `api.php` e `config.php` in una cartella pubblica del tuo spazio web,
   ad esempio `public_html/numeroids-api/`.

   **Importante**: `config.php` contiene la password del database. Essendo
   un file `.php`, il server lo esegue invece di mostrarlo come testo, quindi
   è al sicuro — ma assicurati comunque di caricarlo così com'è, senza
   rinominarlo con estensione diversa da `.php`.

5. **Verifica**: apri nel browser
   `https://tuodominio.it/numeroids-api/api.php`
   Dovresti vedere `[]` (classifica vuota) oppure un elenco di punteggi
   se hai già fatto delle prove.

6. **Collega il gioco**: mandami l'URL completo di `api.php`, oppure
   incollalo tu stesso in `game.js`, sostituendo la riga:

   ```js
   const HIGHSCORE_API = '';
   ```

   con:

   ```js
   const HIGHSCORE_API = 'https://tuodominio.it/numeroids-api/api.php';
   ```

## Nota sulla sicurezza

Come per qualsiasi classifica su un sito statico senza login, un utente
smaliziato potrebbe in teoria inviare un punteggio falso chiamando
direttamente l'API. Lo script valida che il punteggio sia un numero
intero in un range plausibile, ma non può impedire del tutto la
manomissione. Per un gioco amatoriale sul sito, è un rischio accettabile.
