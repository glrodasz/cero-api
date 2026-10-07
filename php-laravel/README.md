# php-laravel

The Cero API on **Laravel 13** (PHP 8.3), storing data in Postgres through Eloquent.

Laravel is the only PHP framework in this repository, so there is no shared PHP
core. The design is the same as everywhere else (a thin HTTP layer, use cases
that hold the business rules, storage behind the models), built from Laravel's
own pieces. It behaves exactly like [`shared/typescript-core`](../shared/typescript-core)
and the [API contract](../shared/api-contract.md).

## What this stack shows

- **Routes at the root.** [`routes/api.php`](routes/api.php) is mounted without
  the `/api` prefix (`apiPrefix: ''` in [`bootstrap/app.php`](bootstrap/app.php)).
  Routes match in the order they are declared, so `complete` and `reset` come
  before `{task}/{status}`.
- **Route model binding.** `{task}` and `{focusSession}` reach the controllers
  as models. `HasUuids` turns a malformed id into a plain "not found", and
  `->missing()` gives pause and resume their own 404 message. Enum parameters
  are bound before models, so `PATCH /tasks/{id}/done` is a 400 even for an
  unknown task.
- **Eloquent models** ([`app/Models`](app/Models)) configured with PHP
  attributes (`#[Fillable]`, `#[Scope]`, `#[WithoutTimestamps]`), with backed
  enums ([`app/Enums`](app/Enums)) as casts. Pauses live in a `jsonb` column and
  come back as a collection of [`Pause`](app/ValueObjects/Pause.php) value
  objects (`AsCollection::of`). The focus session rules are model methods.
- **Actions** ([`app/Actions`](app/Actions)) are the use cases: small classes
  with a `handle` method, injected into controller methods, that wrap
  multi-row changes in `DB::transaction`. Plain reads and single-row changes
  stay in the [controllers](app/Http/Controllers).
- **FormRequests** ([`app/Http/Requests`](app/Http/Requests)) validate the
  bodies. Only validated fields reach the models, so unknown fields are ignored.
  Strings are kept as sent (the `TrimStrings` and `ConvertEmptyStringsToNull`
  middleware are removed), which is why optional fields are `sometimes` +
  `required`: Laravel skips every other rule for a blank string.
- **API Resources** ([`app/Http/Resources`](app/Http/Resources)) shape the
  JSON: camelCase fields, epoch milliseconds, no `data` wrapper. A model created
  during the request answers 201 on its own.
- **One place for errors.** `withExceptions` in `bootstrap/app.php` turns
  Laravel's 422 into a 400, gives each missing model its canonical message
  (`Task not found`, ...), answers `{"message":"Not found"}` for unknown
  routes, and a bare 500 even with `APP_DEBUG` on.
- **The clock is `now()`.** Times are `now()->getTimestampMs()`; tests freeze
  and move it with `travelTo()` and `travel(300)->milliseconds()`.
- **Migrations** ([`database/migrations`](database/migrations)) reproduce
  [`database/postgres/schema.sql`](../database/postgres/schema.sql):
  `foreignUuid()->constrained()->nullOnDelete()`, `enum()` (a CHECK constraint
  on Postgres), the indexes, and a partial index in plain SQL.
- **Only the config that changes.** Each file in [`config`](config) holds just
  the keys that differ from Laravel's defaults.

## Where things live

```
app/
├── Actions/
│   ├── Tasks/                    ListTasks, CreateTask, MoveTaskToTopOfGroup (complete, reset)
│   └── FocusSessions/            Start, GetCurrent, Finish, Pause(Current), Resume(Current)
├── Enums/                        TaskStatus, FocusSessionStatus
├── Exceptions/NotFoundException.php   the canonical 404 messages
├── Http/
│   ├── Controllers/              TaskController, FocusSessionController
│   ├── Middleware/EnsureJsonBodyIsValid.php   malformed JSON → 400
│   ├── Requests/                 one FormRequest per body
│   └── Resources/                TaskResource, FocusSessionResource
├── Models/                       Task, FocusSession (scopes and session rules)
├── Providers/AppServiceProvider.php
└── ValueObjects/Pause.php
bootstrap/app.php                 routing, middleware, error → status code
config/                           database (DATABASE_URL), cors, cache, filesystems
database/migrations/              the Postgres schema
routes/api.php                    /tasks, /focus-sessions
tests/
├── Unit/                         pure rules: TaskStatus, Pause, FocusSession
└── Feature/                      through HTTP and Postgres
    ├── TasksTest.php             the core test plan, TasksService cases
    ├── FocusSessionsTest.php     the core test plan, FocusSessionsService cases
    ├── StorageTest.php           the repository contract, as Eloquent delivers it
    └── HttpTest.php              routing, validation, status codes, error bodies
```

## Run it

```bash
docker compose up -d postgres     # from the repository root
cd php-laravel
composer install
cp .env.example .env
php artisan key:generate
composer start
```

`composer start` runs the migrations, then `php artisan serve --no-reload` on
http://127.0.0.1:8100 (`PORT` overrides it). `--no-reload` lets environment
variables such as `DATABASE_URL` reach the server.

## Test it

```bash
composer test                     # PHPUnit, against the cero_laravel_test database
composer lint                     # Laravel Pint
yarn contract php-laravel         # from the root: the shared API contract, end to end
```
