use std::env;
use std::fmt;
use std::str::FromStr;

const DEFAULT_PORT: u16 = 8091;
const DEFAULT_DATABASE_URL: &str = "postgres://root:root@127.0.0.1:5432/cero_rust";

/// The environment variables, read once at startup.
#[derive(Debug)]
pub struct Config {
    pub port: u16,
    pub storage: Storage,
    pub database_url: String,
}

/// Where the data lives (`STORAGE`).
#[derive(Debug, Clone, Copy)]
pub enum Storage {
    Postgres,
    /// No database needed; the data is lost on restart.
    Memory,
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("PORT must be a port number (got {0:?})")]
    InvalidPort(String),
    #[error("STORAGE must be one of: postgres, memory (got {0:?})")]
    UnknownStorage(String),
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let port = match env::var("PORT") {
            Ok(port) => port.parse().map_err(|_| ConfigError::InvalidPort(port))?,
            Err(_) => DEFAULT_PORT,
        };
        let storage = match env::var("STORAGE") {
            Ok(storage) => storage.parse()?,
            Err(_) => Storage::Postgres,
        };
        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| DEFAULT_DATABASE_URL.into());

        Ok(Self {
            port,
            storage,
            database_url,
        })
    }
}

impl FromStr for Storage {
    type Err = ConfigError;

    fn from_str(name: &str) -> Result<Self, Self::Err> {
        match name {
            "postgres" => Ok(Self::Postgres),
            "memory" => Ok(Self::Memory),
            _ => Err(ConfigError::UnknownStorage(name.to_owned())),
        }
    }
}

impl fmt::Display for Storage {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::Postgres => "postgres",
            Self::Memory => "memory",
        })
    }
}
