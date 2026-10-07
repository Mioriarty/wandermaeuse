# wandermäuse

Ein Reiseblog für unsere Reise durch Süd- und Mittelamerika – [wandermaeuse.de](https://wandermaeuse.de).

Jeder Eintrag zeigt zuerst die Karte mit der ganzen Route und der aktuellen
Station, dann die Komposition, die dort entstanden ist, dann den Text mit den
Bildern. Gepflegt wird alles über die Verwaltung unter `/admin`.

**Stack:** Laravel 13 · Inertia 3 · React 19 · TypeScript · Tailwind 4 · MySQL

Ohne SSR, ohne Tracking, ohne Dienste von Dritten: Schriften und Karte liegen
auf dem eigenen Server, die Karte ist reines SVG ohne Kartenkacheln.

---

# Lokal ansehen

## Schritt 1: PHP zurechtrücken (einmalig, aber zwingend)

Auf diesem Rechner liegen zwei PHP-Versionen im PATH, und **XAMPP kommt zuerst**:

```sh
which -a php
# /Applications/XAMPP/xamppfiles/bin/php   ← 8.0, zu alt
# /opt/homebrew/bin/php                    ← 8.3, die richtige
```

Laravel 13 braucht mindestens 8.3. Solange XAMPP vorne steht, bricht sowohl
`composer` als auch `php artisan dev` mit
*„Your Composer dependencies require a PHP version >= 8.3.0“* ab.

Deshalb einmal in `~/.zshrc` ganz unten ergänzen:

```sh
export PATH="/opt/homebrew/opt/php@8.3/bin:$PATH"
```

Danach ein neues Terminal öffnen und prüfen:

```sh
php -v        # muss 8.3.x zeigen
composer -V   # muss ebenfalls 8.3.x zeigen
```

> Es reicht **nicht**, stattdessen `/opt/homebrew/bin/php artisan dev`
> aufzurufen. Der Befehl startet seine Unterprozesse als schlichtes `php`,
> die landen dann wieder bei XAMPP und stürzen ab.

Das ändert nur, welches `php` im Terminal gemeint ist. Der XAMPP-Server selbst
läuft weiter wie bisher. Falls ein anderes Projekt zwingend PHP 8.0 auf der
Kommandozeile braucht, ruf es dort mit dem vollen Pfad
`/Applications/XAMPP/xamppfiles/bin/php` auf.

## Schritt 2: Loslegen

Alles ist bereits installiert, eingerichtet und mit einer Demo-Reise gefüllt.
Ein Befehl genügt:

```sh
cd ~/Desktop/Coding/wandermaeuse
php artisan dev
```

Das startet Webserver, Vite, die Queue und das Log-Tailing zusammen in einem
Fenster. Beenden mit `Ctrl+C`.

| Was | Wo |
|---|---|
| Die Seite | <http://localhost:8000> |
| Ein Eintrag mit allen acht Mustern | <http://localhost:8000/blog/die-ersten-tage-in-lima> |
| Die Route | <http://localhost:8000/reise> |
| Verwaltung | <http://localhost:8000/admin> |

Lokaler Login: **`admin@wandermaeuse.test`** / **`passwort-fuer-lokal`**

Die Demo-Bilder sind farbige Platzhalter, keine echten Fotos – zum Anschauen
der Muster reicht das. Eigene Bilder kannst du unter *Verwaltung → Bilder*
hochladen, dann laufen sie durch die echte Bildverarbeitung.

## Wenn du wieder bei Null anfangen willst

Setzt die Datenbank zurück und legt die Demo-Reise neu an:

```sh
php artisan migrate:fresh --seed
```

## Auf einem anderen Rechner (frisch geklont)

```sh
composer install
npm install

cp .env.example .env
# lokal reicht: DB_CONNECTION=sqlite, APP_ENV=local, APP_URL=http://localhost:8000
php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed
php artisan storage:link

php artisan dev
```

Ein echtes Konto statt des Demo-Logins:

```sh
php artisan wandermaeuse:admin
```

---

# Auf netcup deployen

## Wie das funktioniert

Der Webspace kann **kein** `npm run build` und **kein** `composer install`:
Node gibt es erst ab Webhosting 4000, und Composer scheitert in der Shell am
Speicherlimit. Deshalb baut GitHub Actions einen fertigen Stand und spielt ihn
per SSH ein – auf dem Webspace läuft nur noch `php artisan`.

```
git push auf main
      │
      ▼
GitHub Actions   Tests, composer install --no-dev, npm run build
      │
      ▼
rsync über SSH   fertig, inklusive vendor/ und public/build/,
      │          nach wandermaeuse.de/httpdocs
      ▼
ssh … artisan    Migrationen, Storage-Link, Caches
```

## Einmalige Einrichtung

**1 – PHP auf 8.3+ stellen, an zwei Stellen.** Im WCP unter *PHP-Einstellungen*
für das Web. Die Shell nimmt diese Einstellung **nicht**, sie liest
`/conf/phpversion` auf dem Webspace (Anleitung liegt in
`/conf-options/phpversion.readme`). Prüfen mit `ssh …` und `php -v`.

**2 – Dokumentenstamm auf `httpdocs/public` setzen.** Nicht auf `httpdocs` –
sonst liegen `.env` und `vendor/` offen im Web. Zusätzlich muss `open_basedir`
den Ordner **`httpdocs`** umfassen, also den *über* dem Dokumentenstamm, sonst
kommt Laravel nicht an `vendor/` und die Seite bleibt weiß.

**3 – SSH-Zugang für GitHub.** Die SSH-Zugangsdaten aus dem WCP im
Repository unter *Settings → Secrets and variables → Actions* hinterlegen:
`SSH_HOST`, `SSH_USER`, `SSH_PASSWORD`, optional `SSH_PORT` und
`SSH_KNOWN_HOSTS`. Das Git-Deployment im WCP ausschalten. Danach den
Workflow einmal von Hand starten, damit die Dateien liegen. Die einzelnen
Befehle stehen in [DEPLOYMENT.md](DEPLOYMENT.md#3-ssh-zugang-für-github).

**4 – Datenbank und Postfach anlegen.** Eine MySQL-Datenbank im WCP, dazu ein
Postfach `newsletter@wandermaeuse.de` für die Bestätigungs- und Newsletter-Mails.

**5 – `.env` anlegen.** Die liegt bewusst nicht im Repository:

```sh
ssh dein-user@dein-webspace
cd /wandermaeuse.de/httpdocs
cp .env.example .env
nano .env     # DB_*, MAIL_* und APP_URL eintragen, APP_DEBUG=false

php artisan key:generate
php artisan migrate --force
php artisan storage:link
php artisan wandermaeuse:admin      # dein echtes Login
```

**6 – Cronjob anlegen.** Im WCP unter *Geplante Aufgaben*, **jede Minute**:

```sh
cd ~/httpdocs && php artisan schedule:run >> /dev/null 2>&1
```

Dieser eine Cronjob erledigt alles Wiederkehrende: Newsletter-Versand,
Migrationen nach einem Deploy, geplante Einträge veröffentlichen, alte
IP-Prüfwerte löschen. Shared Hosting kann keine Dauerprozesse, deshalb kein
Queue-Worker, sondern `queue:work --stop-when-empty` im Minutentakt.


## Danach

```sh
git push        # auf main
```

Der Rest läuft von allein. In `httpdocs` **niemals** von Hand Code ändern –
jeder Deploy gleicht den Ordner mit dem gebauten Stand ab. Was dort bleiben
muss (`.env`, `storage/`), schützt `deploy/rsync.filter`.

## Wenn etwas klemmt

| Symptom | Ursache |
|---|---|
| Weiße Seite, 500er | `open_basedir` umfasst `httpdocs` nicht, oder `.env` fehlt |
| `.env` im Browser erreichbar | Dokumentenstamm zeigt auf `httpdocs` statt `httpdocs/public` |
| Bilder fehlen (404) | `php artisan storage:link` erneut ausführen |
| Neue Migration fehlt | `php artisan wandermaeuse:post-deploy` von Hand ausführen |
| Newsletter bleibt bei „wird versendet“ | Cronjob läuft nicht – Schritt 6 prüfen |
| Deploy scheitert an SSH | Secrets aus Schritt 3 prüfen, Details in DEPLOYMENT.md |

Mehr Hintergrund und die Sicherungsstrategie: [DEPLOYMENT.md](DEPLOYMENT.md).

---

# Entwickeln

## Prüfen

```sh
php artisan test     # 43 Tests
npx tsc --noEmit     # Typen
npm run build        # Produktionsbundle
```

Beides läuft auch in GitHub Actions – schlägt es fehl, wird nicht deployt.

## Wo was liegt

| Wo | Was |
|---|---|
| `app/Enums/BlockType.php` | die acht Layout-Muster eines Eintrags |
| `resources/js/Components/Blocks/` | je ein Muster pro Datei |
| `resources/js/Components/Admin/BlockEditor.tsx` | der Editor dazu |
| `resources/js/Components/RouteMap.tsx` | die Karte (SVG, d3-geo, keine Kacheln) |
| `app/Services/MediaService.php` | Bild-Upload, Größen, Platzhalterfarbe |
| `routes/console.php` | alles, was der Cronjob erledigt |
| `resources/views/legal/` | Impressum und Datenschutz – **Platzhalter noch ausfüllen** |

Ein neues Layout-Muster heißt: ein Case im Enum, eine Komponente, ein Eintrag
in `Blocks/index.tsx`, ein Fall in `BlockEditor.tsx`. Sonst nichts.
