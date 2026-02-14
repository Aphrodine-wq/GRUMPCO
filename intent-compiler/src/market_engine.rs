//! Market Engine - Re-export Module
//!
//! This module re-exports all market analysis components from the
//! split modules for backward compatibility.
//!
//! The market engine has been decomposed into:
//! - market_segments: Market segment definitions and detection
//! - market_competitors: Competitive analysis and moats
//! - market_revenue: Revenue models and unit economics
//! - market_risks: Risk factors and go-to-market strategy
//! - market_analysis: Main analysis orchestration

// Re-export everything from the split modules for backward compatibility
pub use crate::market_analysis::*;
pub use crate::market_competitors::*;
pub use crate::market_revenue::*;
pub use crate::market_risks::*;
pub use crate::market_segments::*;
