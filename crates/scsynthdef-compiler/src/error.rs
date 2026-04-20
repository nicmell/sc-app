use thiserror::Error;

#[derive(Debug, Error)]
pub enum CompileError {
    #[error("SynthDef name must not be empty")]
    EmptyName,

    #[error("Duplicate control name: \"{0}\"")]
    DuplicateParam(String),

    #[error("Forward reference: {from_class}[{from_idx}] references {to_class}[{to_idx}]")]
    ForwardReference {
        from_class: String,
        from_idx: u32,
        to_class: String,
        to_idx: u32,
    },

    #[error("Output {out} out of range for {class} ({num_outputs} outputs)")]
    OutputOutOfRange {
        class: String,
        out: u32,
        num_outputs: u32,
    },

    #[error("UGen index {0} out of range")]
    UGenIndexOutOfRange(u32),

    #[error("pstring too long: {0}")]
    PStringTooLong(usize),

    #[error("Unknown rate: \"{0}\"")]
    UnknownRate(String),

    #[error("Unknown UGen type: \"{0}\"")]
    UnknownUGen(String),

    #[error("Circular dependency involving \"{0}\"")]
    CircularDependency(String),

    #[error("Unknown UGen id: \"{0}\"")]
    UnknownUGenId(String),

    #[error("UGen \"{name}\" ({class}): missing required input \"{param}\"")]
    MissingInput {
        name: String,
        class: String,
        param: String,
    },

    #[error("{class} \"{name}\" requires an \"op\" attribute")]
    MissingOp { class: String, name: String },

    #[error("{class} \"{name}\": unknown operator \"{op}\"")]
    UnknownOperator {
        class: String,
        name: String,
        op: String,
    },

    #[error("Unknown UGen ref: \"{ref_id}\" in \"{value}\"")]
    UnknownUGenRef { ref_id: String, value: String },

    #[error("Cannot resolve input \"{0}\" — not a number, UGen id, or param name")]
    UnresolvedInput(String),

    #[error("SynthDef \"{0}\" has no UGens")]
    EmptyGraph(String),

    #[error("Invalid JSON: {0}")]
    Json(#[from] serde_json::Error),
}
