use std::time::{SystemTime, UNIX_EPOCH};

/// Tells the current time in epoch milliseconds. Injected so tests can control time.
pub trait Clock: Send + Sync {
    fn now(&self) -> i64;
}

/// The real time, from the operating system.
#[derive(Debug, Clone, Copy, Default)]
pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> i64 {
        let since_epoch = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("the system clock is set after 1970");
        i64::try_from(since_epoch.as_millis()).expect("epoch milliseconds fit in an i64")
    }
}
