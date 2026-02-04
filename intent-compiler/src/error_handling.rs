//! Comprehensive Error Handling for Intent Compiler
//! Production-ready error types with detailed context

use std::fmt;

/// Result type for compiler operations
pub type CompilerResult<T> = Result<T, CompilerError>;

/// Comprehensive error types for the intent compiler
#[derive(Debug, Clone)]
pub enum CompilerError {
    /// Parse errors
    ParseError {
        message: String,
        input: String,
        position: Option<usize>,
    },

    /// Cache errors
    CacheError {
        operation: String,
        reason: String,
    },

    /// GPU errors
    GpuError {
        device_id: usize,
        operation: String,
        cuda_error: Option<String>,
    },

    /// JIT compilation errors
    JitError {
        function_id: u64,
        stage: String,
        details: String,
    },

    /// Memory errors
    MemoryError {
        operation: String,
        requested: usize,
        available: usize,
    },

    /// Model compression errors
    CompressionError {
        method: String,
        reason: String,
    },

    /// Parallel processing errors
    ParallelError {
        worker_id: usize,
        task_id: usize,
        error: String,
    },

    /// Configuration errors
    ConfigError {
        parameter: String,
        value: String,
        expected: String,
    },

    /// Timeout errors
    TimeoutError {
        operation: String,
        timeout_ms: u64,
    },

    /// Resource exhaustion
    ResourceExhausted {
        resource: String,
        limit: usize,
    },

    /// Invalid input
    InvalidInput {
        field: String,
        value: String,
        reason: String,
    },

    /// Internal errors (should never happen)
    InternalError {
        message: String,
        backtrace: Option<String>,
    },
}

impl fmt::Display for CompilerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CompilerError::ParseError {
                message,
                input,
                position,
            } => {
                write!(f, "Parse error: {}", message)?;
                if let Some(pos) = position {
                    write!(f, " at position {}", pos)?;
                }
                write!(f, "\nInput: {}", input)
            }

            CompilerError::CacheError { operation, reason } => {
                write!(f, "Cache error during '{}': {}", operation, reason)
            }

            CompilerError::GpuError {
                device_id,
                operation,
                cuda_error,
            } => {
                write!(f, "GPU error on device {}: {}", device_id, operation)?;
                if let Some(err) = cuda_error {
                    write!(f, "\nCUDA error: {}", err)?;
                }
                Ok(())
            }

            CompilerError::JitError {
                function_id,
                stage,
                details,
            } => {
                write!(
                    f,
                    "JIT compilation error for function {} at stage '{}': {}",
                    function_id, stage, details
                )
            }

            CompilerError::MemoryError {
                operation,
                requested,
                available,
            } => {
                write!(
                    f,
                    "Memory error during '{}': requested {} bytes, only {} available",
                    operation, requested, available
                )
            }

            CompilerError::CompressionError { method, reason } => {
                write!(f, "Compression error using '{}': {}", method, reason)
            }

            CompilerError::ParallelError {
                worker_id,
                task_id,
                error,
            } => {
                write!(
                    f,
                    "Parallel processing error: worker {} failed on task {}: {}",
                    worker_id, task_id, error
                )
            }

            CompilerError::ConfigError {
                parameter,
                value,
                expected,
            } => {
                write!(
                    f,
                    "Configuration error: parameter '{}' has invalid value '{}', expected {}",
                    parameter, value, expected
                )
            }

            CompilerError::TimeoutError {
                operation,
                timeout_ms,
            } => {
                write!(
                    f,
                    "Operation '{}' timed out after {}ms",
                    operation, timeout_ms
                )
            }

            CompilerError::ResourceExhausted { resource, limit } => {
                write!(f, "Resource '{}' exhausted (limit: {})", resource, limit)
            }

            CompilerError::InvalidInput {
                field,
                value,
                reason,
            } => {
                write!(
                    f,
                    "Invalid input for field '{}': value '{}' is invalid because {}",
                    field, value, reason
                )
            }

            CompilerError::InternalError {message, backtrace } => {
                write!(f, "Internal compiler error: {}", message)?;
                if let Some(bt) = backtrace {
                    write!(f, "\nBacktrace:\n{}", bt)?;
                }
                Ok(())
            }
        }
    }
}

impl std::error::Error for CompilerError {}

/// Error recovery strategies
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum RecoveryStrategy {
    /// Retry the operation
    Retry { max_attempts: usize, delay_ms: u64 },
    /// Fall back to a simpler method
    Fallback,
    /// Return a default value
    UseDefault,
    /// Propagate the error
    Propagate,
}

/// Error context for better debugging
#[derive(Debug, Clone)]
pub struct ErrorContext {
    pub operation: String,
    pub input_size: usize,
    pub timestamp: std::time::SystemTime,
    pub thread_id: String,
}

impl ErrorContext {
    pub fn new(operation: &str, input_size: usize) -> Self {
        Self {
            operation: operation.to_string(),
            input_size,
            timestamp: std::time::SystemTime::now(),
            thread_id: format!("{:?}", std::thread::current().id()),
        }
    }
}

/// Validation helpers
pub mod validation {
    use super::*;

    pub fn validate_text_input(text: &str) -> CompilerResult<()> {
        if text.is_empty() {
            return Err(CompilerError::InvalidInput {
                field: "text".to_string(),
                value: text.to_string(),
                reason: "input text cannot be empty".to_string(),
            });
        }

        if text.len() > 1_000_000 {
            return Err(CompilerError::InvalidInput {
                field: "text".to_string(),
                value: format!("{} bytes", text.len()),
                reason: "input text exceeds maximum length of 1MB".to_string(),
            });
        }

        Ok(())
    }

    pub fn validate_batch_size(size: usize) -> CompilerResult<()> {
        if size == 0 {
            return Err(CompilerError::InvalidInput {
                field: "batch_size".to_string(),
                value: size.to_string(),
                reason: "batch size cannot be zero".to_string(),
            });
        }

        if size > 100_000 {
            return Err(CompilerError::InvalidInput {
                field: "batch_size".to_string(),
                value: size.to_string(),
                reason: "batch size exceeds maximum of 100,000".to_string(),
            });
        }

        Ok(())
    }

    pub fn validate_cache_size(size: usize) -> CompilerResult<()> {
        if size < 10 {
            return Err(CompilerError::ConfigError {
                parameter: "cache_size".to_string(),
                value: size.to_string(),
                expected: "at least 10".to_string(),
            });
        }

        Ok(())
    }

    pub fn validate_confidence(confidence: f32) -> CompilerResult<()> {
        if !(0.0..=1.0).contains(&confidence) {
            return Err(CompilerError::InvalidInput {
                field: "confidence".to_string(),
                value: confidence.to_string(),
                reason: "confidence must be between 0.0 and 1.0".to_string(),
            });
        }

        Ok(())
    }
}

/// Retry logic with exponential backoff
pub fn retry_with_backoff<F, T>(
    mut f: F,
    max_attempts: usize,
    initial_delay_ms: u64,
) -> CompilerResult<T>
where
    F: FnMut() -> CompilerResult<T>,
{
    let mut delay = initial_delay_ms;

    for attempt in 0..max_attempts {
        match f() {
            Ok(result) => return Ok(result),
            Err(e) => {
                if attempt == max_attempts - 1 {
                    return Err(e);
                }

                std::thread::sleep(std::time::Duration::from_millis(delay));
                delay *= 2; // Exponential backoff
            }
        }
    }

    unreachable!()
}

/// Safe wrapper for fallible operations
pub fn safe_execute<F, T>(
    operation: &str,
    f: F,
    fallback: T,
) -> T
where
    F: FnOnce() -> CompilerResult<T>,
{
    match f() {
        Ok(result) => result,
        Err(e) => {
            eprintln!("Error in {}: {}", operation, e);
            fallback
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validation() {
        assert!(validation::validate_text_input("hello").is_ok());
        assert!(validation::validate_text_input("").is_err());

        assert!(validation::validate_batch_size(100).is_ok());
        assert!(validation::validate_batch_size(0).is_err());

        assert!(validation::validate_confidence(0.5).is_ok());
        assert!(validation::validate_confidence(1.5).is_err());
    }

    #[test]
    fn test_retry() {
        let mut attempts = 0;

        let result = retry_with_backoff(
            || {
                attempts += 1;
                if attempts < 3 {
                    Err(CompilerError::InternalError {
                        message: "temporary error".to_string(),
                        backtrace: None,
                    })
                } else {
                    Ok(42)
                }
            },
            5,
            10,
        );

        assert_eq!(result.unwrap(), 42);
        assert_eq!(attempts, 3);
    }

    #[test]
    fn test_safe_execute() {
        let result = safe_execute(
            "test_op",
            || Err(CompilerError::InternalError {
                message: "error".to_string(),
                backtrace: None,
            }),
            42,
        );

        assert_eq!(result, 42);
    }
}
