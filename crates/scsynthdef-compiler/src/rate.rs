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

    /// Parse from string form (`ar` / `kr` / `ir`, plus long names `audio` /
    /// `control` / `scalar`). Case-insensitive.
    pub fn parse(s: &str) -> Option<Rate> {
        match s.to_ascii_lowercase().as_str() {
            "ar" | "audio" => Some(Rate::Audio),
            "kr" | "control" => Some(Rate::Control),
            "ir" | "scalar" => Some(Rate::Scalar),
            _ => None,
        }
    }
}
