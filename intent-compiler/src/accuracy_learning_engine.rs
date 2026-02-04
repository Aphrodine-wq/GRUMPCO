//! Outcome Tracking & Accuracy Learning System
//!
//! Closes the feedback loop: tracks how founders actually perform after verdicts,
//! measures prediction accuracy, and uses that signal to continuously improve the system.
//!
//! Architecture:
//! 1. Outcome Event Tracking: Monitor key business metrics and milestones
//! 2. Verdict Accuracy Measurement: Compare predictions to actual outcomes
//! 3. Learning Signal Generation: Extract insights from accuracy misses
//! 4. Model Calibration: Update prediction weights based on feedback
//! 5. Confidence Estimation: Better quantify uncertainty in predictions

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Outcome Tracking Events
// ============================================================================

/// Major business outcome tracked after verdict
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutcomeTrackingEvent {
    pub founder_id: String,
    pub decision_id: String,
    pub outcome_type: OutcomeType,
    pub timestamp: String,
    pub days_since_verdict: i32,
    pub magnitude: f32, // 0.0 to 1.0, importance of outcome
    pub details: OutcomeEventDetails,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OutcomeType {
    // Success outcomes
    ProductLaunched,
    FirstSaleAchieved,
    AcquiredInitialCustomers,
    DollarsMRR(f32), // MRR achieved
    RaisedFunding,
    AcquiredByLargeCompany,

    // Pivot outcomes
    PivotedSuccessfully,
    PivotFailed,

    // Failure outcomes
    CompanyShutdown,
    FounderBurnout,
    CofounderConflict,
    FundingDenied,

    // Growth outcomes
    MilestoneReached(String), // e.g., "100k ARR", "1000 users"
    MarketExpansion,
    TeamExpansion,

    // Risk realized
    CompetitorEmergence,
    MarketShift,
    TechnicalDebt,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutcomeEventDetails {
    pub description: String,
    pub metrics: HashMap<String, f32>,
    pub qualitative_feedback: Option<String>,
    pub data_source: String, // "user_survey", "public_data", "api_data", "manual_entry"
}

// ============================================================================
// Verdict Accuracy Measurement
// ============================================================================

/// Comparison of prediction vs reality
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerdictAccuracyMeasurement {
    pub founder_id: String,
    pub decision_id: String,
    pub original_verdict: String,
    pub original_confidence: f32,
    pub outcome_realized: OutcomeType,
    pub days_to_outcome: i32,
    pub accuracy_classification: AccuracyClassification,
    pub confidence_calibration: f32, // How well did our confidence match accuracy?
    pub learning_signal: LearningSignal,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AccuracyClassification {
    CorrectPositive,    // Predicted success → succeeded
    CorrectNegative,    // Predicted failure → failed
    FalsePositive,      // Predicted success → failed
    FalseNegative,      // Predicted failure → succeeded
    PartiallyCorrect,   // Right direction, wrong magnitude
    TooOptimistic,      // Overestimated success likelihood
    TooConservative,    // Underestimated success likelihood
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearningSignal {
    pub signal_strength: f32,      // How clear is the signal?
    pub affected_features: Vec<String>,
    pub suggested_adjustments: Vec<FeatureAdjustment>,
    pub new_mental_models: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureAdjustment {
    pub feature_name: String,
    pub old_weight: f32,
    pub suggested_weight: f32,
    pub reasoning: String,
    pub confidence: f32,
}

// ============================================================================
// Accuracy Measurement Functions
// ============================================================================

/// Measure if a verdict was accurate given realized outcome
pub fn measure_verdict_accuracy(
    original_verdict: &str,
    original_confidence: f32,
    outcome: &OutcomeType,
    days_to_outcome: i32,
) -> VerdictAccuracyMeasurement {
    let accuracy_classification =
        classify_accuracy_result(original_verdict, original_confidence, outcome);

    let learning_signal = generate_learning_signal(
        original_verdict,
        outcome,
        &accuracy_classification,
    );

    VerdictAccuracyMeasurement {
        founder_id: String::new(),
        decision_id: String::new(),
        original_verdict: original_verdict.to_string(),
        original_confidence,
        outcome_realized: outcome.clone(),
        days_to_outcome,
        accuracy_classification,
        confidence_calibration: calculate_calibration(original_confidence, outcome),
        learning_signal,
    }
}

fn classify_accuracy_result(
    verdict: &str,
    _confidence: f32,
    outcome: &OutcomeType,
) -> AccuracyClassification {
    use AccuracyClassification::*;
    use OutcomeType::*;

    match verdict {
        "BuildNow" => match outcome {
            ProductLaunched | FirstSaleAchieved | AcquiredInitialCustomers | RaisedFunding => {
                CorrectPositive
            }
            CompanyShutdown | FounderBurnout | FundingDenied => FalsePositive,
            PivotedSuccessfully => PartiallyCorrect,
            _ => PartiallyCorrect,
        },

        "BuildButPivot" => match outcome {
            PivotedSuccessfully => CorrectPositive,
            PivotFailed => FalsePositive,
            CompanyShutdown => CorrectNegative,
            ProductLaunched => TooConservative,
            _ => PartiallyCorrect,
        },

        "Skip" => match outcome {
            CompanyShutdown | FounderBurnout => CorrectPositive,
            ProductLaunched | FirstSaleAchieved | RaisedFunding => FalsePositive,
            _ => PartiallyCorrect,
        },

        "ThinkHarder" => match outcome {
            ProductLaunched => PartiallyCorrect, // They thought and built successfully
            CompanyShutdown => CorrectPositive,
            PivotedSuccessfully => PartiallyCorrect,
            _ => PartiallyCorrect,
        },

        _ => PartiallyCorrect,
    }
}

fn calculate_calibration(original_confidence: f32, outcome: &OutcomeType) -> f32 {
    use OutcomeType::*;
    let outcome_success = matches!(
        outcome,
        ProductLaunched
            | FirstSaleAchieved
            | AcquiredInitialCustomers
            | RaisedFunding
            | PivotedSuccessfully
    );

    // If outcome was success and we were confident, that's good calibration
    // If outcome was success but we were uncertain, bad calibration
    let base = if outcome_success {
        original_confidence
    } else {
        1.0 - original_confidence
    };

    base.max(0.1).min(1.0) // Avoid extremes
}

fn generate_learning_signal(
    verdict: &str,
    outcome: &OutcomeType,
    classification: &AccuracyClassification,
) -> LearningSignal {
    let signal_strength = match classification {
        AccuracyClassification::CorrectPositive | AccuracyClassification::CorrectNegative => {
            0.9 // Clear signal, our model is right
        }
        AccuracyClassification::FalsePositive | AccuracyClassification::FalseNegative => {
            0.85 // Clear signal, but we were wrong
        }
        AccuracyClassification::PartiallyCorrect => 0.6,
        AccuracyClassification::TooOptimistic => 0.8,
        AccuracyClassification::TooConservative => 0.8,
    };

    let mut affected_features = Vec::new();
    let mut suggested_adjustments = Vec::new();

    // Extract learning based on what went wrong/right
    match classification {
        AccuracyClassification::FalsePositive => {
            // We said Build but they failed
            affected_features.push("market_validation_signal".to_string());
            affected_features.push("founder_execution_track_record".to_string());

            suggested_adjustments.push(FeatureAdjustment {
                feature_name: "market_validation_signal".to_string(),
                old_weight: 0.6,
                suggested_weight: 0.8,
                reasoning: "We underweighted market validation signals".to_string(),
                confidence: 0.75,
            });
        }
        AccuracyClassification::FalseNegative => {
            // We said Skip but they succeeded
            affected_features.push("founder_determination".to_string());
            affected_features.push("market_timing".to_string());

            suggested_adjustments.push(FeatureAdjustment {
                feature_name: "founder_resilience_score".to_string(),
                old_weight: 0.5,
                suggested_weight: 0.75,
                reasoning: "Founder exceeded expectations despite challenges".to_string(),
                confidence: 0.7,
            });
        }
        AccuracyClassification::TooOptimistic => {
            affected_features.push("execution_risk".to_string());
            affected_features.push("market_timing".to_string());
        }
        AccuracyClassification::TooConservative => {
            affected_features.push("founder_quality".to_string());
            affected_features.push("market_size".to_string());
        }
        _ => {}
    }

    let new_mental_models = extract_mental_models(verdict, outcome);

    LearningSignal {
        signal_strength,
        affected_features,
        suggested_adjustments,
        new_mental_models,
    }
}

fn extract_mental_models(verdict: &str, outcome: &OutcomeType) -> Vec<String> {
    use OutcomeType::*;

    let mut models = Vec::new();

    // If we said Build and they pivoted successfully, that's a new pattern
    if verdict == "BuildNow" && matches!(outcome, PivotedSuccessfully) {
        models.push("Successful pivots often start with building and learning".to_string());
    }

    // If we said Skip but they got customers anyway
    if verdict == "Skip" && matches!(outcome, FirstSaleAchieved | AcquiredInitialCustomers) {
        models.push("Some founders with weak initial signals still find markets".to_string());
    }

    models
}

// ============================================================================
// Aggregate Accuracy Analytics
// ============================================================================

/// Overall accuracy statistics across many predictions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccuracyMetrics {
    pub total_predictions: usize,
    pub accuracy_by_verdict: HashMap<String, VerdictMetrics>,
    pub overall_accuracy: f32,
    pub precision_by_verdict: HashMap<String, f32>,
    pub recall_by_verdict: HashMap<String, f32>,
    pub calibration_score: f32,
    pub time_to_outcome_distribution: TimeToOutcomeDistribution,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerdictMetrics {
    pub verdict_type: String,
    pub total_issued: usize,
    pub correct_predictions: usize,
    pub accuracy: f32,
    pub avg_confidence: f32,
    pub avg_days_to_outcome: i32,
    pub most_common_outcome: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeToOutcomeDistribution {
    pub days_0_30: usize,
    pub days_30_90: usize,
    pub days_90_180: usize,
    pub days_180_365: usize,
    pub days_365_plus: usize,
}

/// Calculate aggregate accuracy metrics
pub fn calculate_accuracy_metrics(
    measurements: &[VerdictAccuracyMeasurement],
) -> AccuracyMetrics {
    let total = measurements.len() as f32;
    let mut correct = 0;
    let mut verdict_groups: HashMap<String, Vec<&VerdictAccuracyMeasurement>> = HashMap::new();
    let mut calibration_sum = 0.0;
    let mut time_distribution = TimeToOutcomeDistribution {
        days_0_30: 0,
        days_30_90: 0,
        days_90_180: 0,
        days_180_365: 0,
        days_365_plus: 0,
    };

    for measurement in measurements {
        // Count correct predictions
        if matches!(
            measurement.accuracy_classification,
            AccuracyClassification::CorrectPositive | AccuracyClassification::CorrectNegative
        ) {
            correct += 1;
        }

        // Group by verdict
        verdict_groups
            .entry(measurement.original_verdict.clone())
            .or_insert_with(Vec::new)
            .push(measurement);

        // Calibration
        calibration_sum += measurement.confidence_calibration;

        // Time distribution
        match measurement.days_to_outcome {
            0..=30 => time_distribution.days_0_30 += 1,
            31..=90 => time_distribution.days_30_90 += 1,
            91..=180 => time_distribution.days_90_180 += 1,
            181..=365 => time_distribution.days_180_365 += 1,
            _ => time_distribution.days_365_plus += 1,
        }
    }

    let overall_accuracy = if total > 0.0 {
        correct as f32 / total
    } else {
        0.5
    };

    let calibration_score = if total > 0.0 {
        calibration_sum / total
    } else {
        0.5
    };

    // Build per-verdict metrics
    let mut accuracy_by_verdict = HashMap::new();
    for (verdict_type, group) in verdict_groups {
        let group_correct = group
            .iter()
            .filter(|m| {
                matches!(
                    m.accuracy_classification,
                    AccuracyClassification::CorrectPositive | AccuracyClassification::CorrectNegative
                )
            })
            .count();

        let group_accuracy =
            group_correct as f32 / group.len() as f32;

        let avg_confidence = group.iter().map(|m| m.original_confidence).sum::<f32>()
            / group.len() as f32;

        let avg_days = group.iter().map(|m| m.days_to_outcome).sum::<i32>() / group.len() as i32;

        accuracy_by_verdict.insert(
            verdict_type.clone(),
            VerdictMetrics {
                verdict_type,
                total_issued: group.len(),
                correct_predictions: group_correct,
                accuracy: group_accuracy,
                avg_confidence,
                avg_days_to_outcome: avg_days,
                most_common_outcome: "ProductLaunched".to_string(), // Simplified
            },
        );
    }

    // Placeholder precision/recall (would need negative outcome data)
    let precision_by_verdict = HashMap::new();
    let recall_by_verdict = HashMap::new();

    AccuracyMetrics {
        total_predictions: measurements.len(),
        accuracy_by_verdict,
        overall_accuracy,
        precision_by_verdict,
        recall_by_verdict,
        calibration_score,
        time_to_outcome_distribution: time_distribution,
    }
}

// ============================================================================
// Model Calibration & Confidence Estimation
// ============================================================================

/// Calibrate prediction confidence based on historical accuracy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfidenceCalibration {
    pub original_confidence: f32,
    pub calibrated_confidence: f32,
    pub calibration_factor: f32,
    pub reliability_score: f32,
}

pub fn calibrate_confidence(
    original_confidence: f32,
    metrics: &AccuracyMetrics,
) -> ConfidenceCalibration {
    // If we said 80% confident and ended up being right 60% of the time,
    // our calibration factor is 0.75 (60/80)
    let calibration_factor = if metrics.overall_accuracy > 0.0 {
        metrics.overall_accuracy / original_confidence.max(0.1)
    } else {
        1.0
    };

    // Clamp to avoid extreme corrections
    let clamped_factor = calibration_factor.max(0.5).min(1.5);

    let calibrated_confidence = (original_confidence * clamped_factor).min(1.0).max(0.0);

    let reliability_score = (1.0 - (original_confidence - metrics.overall_accuracy).abs()).max(0.0);

    ConfidenceCalibration {
        original_confidence,
        calibrated_confidence,
        calibration_factor: clamped_factor,
        reliability_score,
    }
}

// ============================================================================
// Learning Aggregation
// ============================================================================

/// Aggregate learning signals into model updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregatedLearning {
    pub total_measurements: usize,
    pub feature_importance_updates: HashMap<String, f32>,
    pub new_patterns_discovered: Vec<DiscoveredPattern>,
    pub model_improvement_potential: f32,
    pub recommended_next_experiments: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredPattern {
    pub pattern: String,
    pub frequency: usize,
    pub effect_on_accuracy: f32,
    pub confidence: f32,
}

pub fn aggregate_learning_signals(
    measurements: &[VerdictAccuracyMeasurement],
) -> AggregatedLearning {
    let mut feature_updates: HashMap<String, Vec<f32>> = HashMap::new();
    let mut pattern_counts: HashMap<String, (usize, f32, f32)> = HashMap::new();

    for measurement in measurements {
        // Aggregate feature adjustments
        for adjustment in &measurement.learning_signal.suggested_adjustments {
            feature_updates
                .entry(adjustment.feature_name.clone())
                .or_insert_with(Vec::new)
                .push(adjustment.suggested_weight);
        }

        // Count discovered patterns
        for pattern in &measurement.learning_signal.new_mental_models {
            pattern_counts
                .entry(pattern.clone())
                .and_modify(|(count, _, _)| *count += 1)
                .or_insert((1, measurement.learning_signal.signal_strength, 0.7));
        }
    }

    // Average feature updates
    let mut feature_importance_updates = HashMap::new();
    for (feature, weights) in feature_updates {
        let avg_weight = weights.iter().sum::<f32>() / weights.len() as f32;
        feature_importance_updates.insert(feature, avg_weight);
    }

    // Convert patterns
    let mut patterns = Vec::new();
    for (pattern, (freq, strength, conf)) in pattern_counts {
        patterns.push(DiscoveredPattern {
            pattern,
            frequency: freq,
            effect_on_accuracy: strength,
            confidence: conf,
        });
    }

    patterns.sort_by(|a, b| b.frequency.cmp(&a.frequency));

    let model_improvement_potential = if !measurements.is_empty() {
        1.0 - (measurements
            .iter()
            .filter(|m| {
                matches!(
                    m.accuracy_classification,
                    AccuracyClassification::CorrectPositive | AccuracyClassification::CorrectNegative
                )
            })
            .count() as f32
            / measurements.len() as f32)
    } else {
        0.5
    };

    AggregatedLearning {
        total_measurements: measurements.len(),
        feature_importance_updates,
        new_patterns_discovered: patterns,
        model_improvement_potential,
        recommended_next_experiments: vec![
            "A/B test new feature weights in production".to_string(),
            "Collect more data on founder psychology signals".to_string(),
            "Validate market data feed quality".to_string(),
        ],
    }
}
