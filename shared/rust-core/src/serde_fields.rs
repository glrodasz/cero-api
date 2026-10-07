use serde::{Deserialize, Deserializer};

/// Deserializes a field that is present in the JSON into `Some`, so that `None`
/// can only mean "the field was left out". Use it with `#[serde(default)]`.
///
/// - On an `Option<T>` field it refuses `null`: leaving the field out is the
///   only way to say "no value".
/// - On an `Option<Option<T>>` field it tells the three cases apart:
///   left out (`None`), `null` (`Some(None)`) and a value (`Some(Some(value))`).
pub(crate) fn present<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    T::deserialize(deserializer).map(Some)
}
