-- Runs once, the first time the Postgres container starts with an empty volume.
-- Every stack owns a database (plus a twin for its automated tests), so their
-- migrations never collide. Recreate them with: docker compose down -v postgres
CREATE DATABASE cero_python;
CREATE DATABASE cero_python_test;
CREATE DATABASE cero_go;
CREATE DATABASE cero_go_test;
CREATE DATABASE cero_rust;
CREATE DATABASE cero_rust_test;
CREATE DATABASE cero_laravel;
CREATE DATABASE cero_laravel_test;
CREATE DATABASE cero_phoenix;
CREATE DATABASE cero_phoenix_test;
