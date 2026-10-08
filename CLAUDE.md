# wandermäuse

Reiseblog auf Laravel 13 + Inertia 3 + React 19 + TypeScript + Tailwind 4.
Öffentliche Seite auf Deutsch, Verwaltung unter `/admin`.

## Umgebung

- Lokales PHP ist **`/opt/homebrew/bin/php`** (8.3). Das `php` im PATH ist
  XAMPP 8.0 und zu alt für Laravel 13.
- Composer entsprechend als `/opt/homebrew/bin/php /usr/local/bin/composer`.
- Lokal SQLite, in Produktion MySQL.

## Wo was liegt

- Die acht Layout-Muster eines Eintrags: `app/Enums/BlockType.php` plus je eine
  Komponente in `resources/js/Components/Blocks/`. Ein neues Muster heißt: ein
  Case im Enum, eine Komponente, ein Eintrag in `Blocks/index.tsx` und ein Fall
  in `BlockEditor.tsx` – sonst nichts.
- Einzelne Stellschrauben der Seite liegen als Schluessel und Wert in der
  Tabelle `settings` (`App\Models\Setting`). Bisher steht dort nur das
  Titelbild der Startseite, waehlbar unter `/admin/startseite`. Welches Bild
  die Startseite zeigt, entscheidet `App\Support\HomeHero` – eine Stelle fuer
  beide Seiten, damit Verwaltung und Startseite nicht auseinanderlaufen.
- Die Karte ist selbst gerendertes SVG (`RouteMap.tsx`, d3-geo, GeoJSON in
  `resources/js/lib/americas.geo.json` – Mexiko, Mittelamerika, die Karibik
  und Suedamerika; die USA und Kanada bewusst nicht, die Reise beginnt in
  Mexiko). Das 4:5 des viewBox ist genau das Seitenverhaeltnis dieser
  Landmasse in Mercator: wer Laender hinzunimmt oder entfernt, muss es
  nachrechnen, sonst steht die Karte mit Rand im Kasten. Die Karte ist eine
  reine Umrisszeichnung: graue Grenzen, keine Fuellung, kein Hintergrund, kein
  Rahmen, kein Zoom und keine Ortsnamen im Bild. Die Namen stehen in der Liste
  darunter und als `<title>` an jedem Punkt. **Keine Kartenkacheln von Dritten einbauen** – die
  Datenschutzerklärung sagt ausdrücklich zu, dass die Seite keine fremden
  Server kontaktiert. Das Gleiche gilt für Schriften und eingebettete Videos.

## Randbedingungen des Hostings

netcup Shared Hosting, kein Root, keine Dauerprozesse:

- Kein Queue-Worker. Alles Wiederkehrende hängt am Scheduler in
  `routes/console.php`, den ein Cronjob jede Minute anstößt.
- Node und Composer laufen dort nicht. Gebaut wird in GitHub Actions, der
  fertige Stand geht als tar über SSH nach `/wandermaeuse.de/httpdocs`
  (Zugangsdaten in den GitHub-Secrets). Auf dem Webspace gibt es **kein
  rsync**, nur PHP: `deploy/package.sh` packt, `deploy/install.php` spielt ein
  und löscht nur, was der vorige Deploy laut `.deploy-manifest` selbst
  mitgebracht hat. Details in `DEPLOYMENT.md`.
- Bildvarianten werden beim Upload **synchron** erzeugt, nicht per Queue – die
  Queue läuft nur einmal pro Minute.

## Sonstiges

- Öffentliche Seiten müssen auf dem Handy funktionieren (390px, keine
  Querscrollbalken, Tap-Ziele ≥ 44px). Die Verwaltung ist bewusst
  Desktop-first.
- Kein `border-radius`, Hairlines statt Schatten, Farbe nur sparsam über
  `--color-accent`. Die Fotos tragen die Farbe, der Hintergrund ist fast weiß.
- Überschriften laufen in `font-display` (Bodoni Moda, eine Didone mit starkem
  Strichkontrast). Geladen werden nur 400 und 500 – **kein `font-bold`
  darauf**, das wäre ein vom Browser gefälschtes Fett. Alles Funktionale
  (Navigation, Meta-Zeilen, `label-xs`) bleibt in `font-sans` (Inter).
  Die Verwaltung benutzt `font-ui` und behält damit echte fette Schnitte.
- Schriften werden beim Bauen heruntergeladen (`bunny(...)` in
  `vite.config.ts`) und von der eigenen Domain ausgeliefert.
- `php artisan migrate:fresh --seed` legt echte Landschaftsfotos an: der
  Seeder holt sie einmal von Wikimedia Commons (`DemoPhotoLibrary`) und legt
  sie unter `storage/app/private/demo-photos` ab, danach geht es offline. Ohne
  Netz treten farbige Platzhalter an ihre Stelle, Seeden scheitert nie daran.
- Kommentare sind eine Ebene tief verschachtelt (`parent_id` = erster Kommentar
  des Threads, `reply_to_id` = der beantwortete). Bilder von Lesern liegen in
  `comment_images`, bewusst getrennt von `media`, und werden in
  `CommentImageService` immer neu als WebP kodiert – nie die Originaldatei
  ablegen, sonst bleiben GPS-Daten und angehängter Code erhalten. Kommentare
  einzeln über Eloquent löschen, nicht per Query, sonst bleiben die Dateien
  liegen.
- Newsletter: Double Opt-in ist in Deutschland Pflicht. Unbestätigte Adressen
  dürfen nie eine Kampagne bekommen (`Subscriber::scopeMailable`).
- Vor dem Commit: `php artisan test` und `npx tsc --noEmit`.
