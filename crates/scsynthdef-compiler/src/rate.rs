use serde::{Deserialize, Serialize};

/// Calculation rate of a UGen, matching the SCgf binary encoding.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[repr(i8)]
pub enum Rate {
    Scalar = 0,
    Control = 1,
    Audio = 2,
}

impl Rate {
    pub fn as_i8(self) -> i8 {
        self as i8
    }

    /// Parse from string form. Only the SC short forms `ar` / `kr` / `ir`
    /// are accepted; case-insensitive.
    pub fn parse(s: &str) -> Option<Rate> {
        match s.to_ascii_lowercase().as_str() {
            "ar" => Some(Rate::Audio),
            "kr" => Some(Rate::Control),
            "ir" => Some(Rate::Scalar),
            _ => None,
        }
    }
}
