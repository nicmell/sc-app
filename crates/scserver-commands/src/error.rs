use thiserror::Error;

#[derive(Debug, Error)]
pub enum CommandError {
    #[error("Unknown OSC address: {0}")]
    UnknownAddress(String),

    #[error("Argument count mismatch for {address}: expected {expected}, got {got}")]
    ArgCount {
        address: String,
        expected: usize,
        got: usize,
    },

    #[error("Argument type mismatch at position {pos} of {address}: expected {expected}, got {got}")]
    ArgType {
        address: String,
        pos: usize,
        expected: &'static str,
        got: String,
    },

    #[error("OSC decode error: {0}")]
    OscDecode(String),

    #[error("OSC encode error: {0}")]
    OscEncode(String),

    #[error("NRT score error: {0}")]
    Nrt(String),

    #[error("{0}")]
    Custom(String),
}

impl From<rosc::OscError> for CommandError {
    fn from(e: rosc::OscError) -> Self {
        CommandError::OscDecode(format!("{e:?}"))
    }
}
