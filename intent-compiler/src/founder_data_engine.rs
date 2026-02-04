//! Founder Data Collection & Feedback Loop System
//!
//! Real-time founder decision capture, outcome tracking, and learning feedback loops.
//! Transforms raw founder interactions into structured training data for improving verdicts.
//!
//! Architecture:
//! 1. Data Ingestion: Capture founder intent, decisions, and interactions
//! 2. Outcome Tracking: Monitor business milestones, pivots, failures, wins
//! 3. Feedback Loop: Compare predicted verdict vs actual outcome
//! 4. Learning Signal: Update model confidence and weights
//! 5. Flywheel: Better predictions → more founders → more data → better predictions

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Founder Decision Event Capture
// ============================================================================

/// Core founder decision event - captured at the moment of intent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FounderDecisionEvent {
    /// Unique founder ID across the system
    pub founder_id: String,
    /// When the intent was expressed (ISO 8601)
    pub timestamp: String,
    /// Raw natural language intent from founder
    pub raw_intent: String,
    /// Structured intent extracted by NLP engine
    pub parsed_intent: ParsedIntent,
    /// Initial verdict from context engine at time of decision
    pub initial_verdict: VerdictCapture,
    /// Founder's decision (what they actually chose to do)
    pub founder_decision: FounderDecision,
    /// Session/conversation context
    pub session_id: String,
    /// Source (web, API, command-line, etc)
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedIntent {
    pub action: String,
    pub target: String,
    pub features: Vec<String>,
    pub tech_hints: Vec<String>,
    pub complexity_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerdictCapture {
    /// What the system predicted (BuildNow, Skip, ThinkHarder, etc)
    pub verdict: String,
    /// Confidence in this verdict (0.0-1.0)
    pub confidence: f32,
    /// Key factors that influenced the verdict
    pub reasoning_factors: Vec<String>,
    /// Implicit requirements flagged
    pub implicit_requirements: Vec<String>,
    /// Risk factors identified
    pub identified_risks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FounderDecision {
    /// What the founder chose: "accepted", "rejected", "modified", "deferred"
    pub action: String,
    /// If they modified the suggestion, what was their reasoning
    pub explanation: Option<String>,
    /// Immediate reaction: confidence_change, pivot_triggered, delayed
    pub immediate_effect: String,
}

// ============================================================================
// Outcome Tracking & Business Milestone Events
// ============================================================================

/// Business outcome event - tracked over weeks/months/years
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusinessOutcomeEvent {
    pub founder_id: String,
    pub event_id: String,
    pub event_type: OutcomeEventType,
    pub timestamp: String,
    pub details: OutcomeDetails,
    pub impact_on_trajectory: f32, // -1.0 (severe setback) to +1.0 (major win)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OutcomeEventType {
    // Product/Market Fit events
    ProductLaunched,
    FirstCustomer,
    CustomerRepeated,
    ReachedPMF, // Product-market fit confirmed
    LostPMF,    // Regressed from PMF

    // Scaling events
    RaisedFunding,
    HiredKey,     // Hired critical role
    BuildSystem,  // Documented/automated systems
    OpenedMarket, // Entered new market

    // Pivot events
    PivotInitiated,
    PivotCompleted,
    MajorFeaturePivot,
    TargetMarketShift,

    // Revenue events
    MRRMilestone,       // Hit revenue milestone
    RevenueDecline,     // Significant drop
    CustomDeal,        // Large deal closed
    ContractLost,      // Major contract lost

    // Team events
    CofounderLeft,
    FounderBurnout,
    KeyPersonDependency,
    TeamExpansion,

    // External events
    CompetitorEmergence,
    MarketShift,
    RegulationChange,
    MacroEvent, // Economic, pandemic, etc

    // Failure events
    Shutdown,
    Acquisition,
    Acquihired, // Acq-hired by another company
    Bankruptcy,

    // Psychological events
    FounderDoubts,
    FounderConfidence,
    FounderBurnout,
    FounderPivot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutcomeDetails {
    /// What actually happened in natural language
    pub description: String,
    /// Structured data: {"key": value, ...}
    pub metrics: HashMap<String, f32>,
    /// Was this predicted by system? If yes, which verdict?
    pub was_predicted: bool,
    pub predicted_verdict: Option<String>,
}

// ============================================================================
// Verdict Accuracy Feedback Loop
// ============================================================================

/// Comparison of predicted verdict vs actual outcome
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerdictAccuracyFeedback {
    pub founder_id: String,
    pub decision_event_id: String,
    pub original_verdict: String,
    pub original_confidence: f32,
    /// "correct", "incorrect", "partially_correct", "too_conservative", "too_optimistic"
    pub accuracy_classification: String,
    /// How many days until outcome confirmed
    pub days_to_confirmation: i32,
    /// What factors were predictive of outcome?
    pub predictive_factors: Vec<String>,
    /// What factors missed the mark?
    pub missed_signals: Vec<String>,
    /// Suggested weight updates for ML model
    pub suggested_weight_updates: Vec<WeightUpdate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeightUpdate {
    pub feature_name: String,
    pub old_weight: f32,
    pub suggested_new_weight: f32,
    pub confidence: f32,
}

// ============================================================================
// Founder Cohort Analysis
// ============================================================================

/// Aggregate analysis across cohorts of founders
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FounderCohort {
    /// Which verdict cohort (all founders who got "BuildNow" verdict)
    pub verdict_cohort: String,
    /// Time period
    pub cohort_year: i32,
    pub cohort_month: i32,
    /// Size of cohort
    pub size: usize,
    /// Outcomes breakdown
    pub outcomes: CohortOutcomes,
    /// Statistical confidence in measurements
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CohortOutcomes {
    /// % that achieved product-market fit
    pub pmf_rate: f32,
    /// % that raised funding
    pub funding_rate: f32,
    /// % that hit 6-figure MRR
    pub revenue_rate: f32,
    /// % that pivoted significantly
    pub pivot_rate: f32,
    /// % that shut down
    pub shutdown_rate: f32,
    /// Average time to first customer (days)
    pub avg_time_to_first_customer: i32,
    /// Average time to funding (days)
    pub avg_time_to_funding: i32,
    /// Median founder satisfaction (1-10)
    pub median_satisfaction: f32,
}

// ============================================================================
// Feedback Loop Orchestration
// ============================================================================

/// Master feedback loop runner - composes all signals
pub fn process_feedback_loop(
    event: &FounderDecisionEvent,
    outcome: &BusinessOutcomeEvent,
) -> VerdictAccuracyFeedback {
    let was_correct = assess_verdict_accuracy(&event.initial_verdict, outcome);
    let predictive_factors = extract_predictive_signals(event, outcome);
    let missed_signals = extract_missed_signals(event, outcome);

    let accuracy_classification = classify_accuracy(&event.initial_verdict, outcome, &was_correct);

    VerdictAccuracyFeedback {
        founder_id: event.founder_id.clone(),
        decision_event_id: format!("{}-{}", event.founder_id, event.timestamp),
        original_verdict: event.initial_verdict.verdict.clone(),
        original_confidence: event.initial_verdict.confidence,
        accuracy_classification,
        days_to_confirmation: calculate_days_to_confirmation(event, outcome),
        predictive_factors,
        missed_signals,
        suggested_weight_updates: suggest_weight_updates(&event.parsed_intent, &was_correct),
    }
}

/// Assess if verdict matched actual outcome
fn assess_verdict_accuracy(
    verdict: &VerdictCapture,
    outcome: &BusinessOutcomeEvent,
) -> bool {
    match verdict.verdict.as_str() {
        "BuildNow" => {
            // BuildNow correct if: product launched, found customers, raised funding, or hit revenue
            matches!(
                outcome.event_type,
                OutcomeEventType::ProductLaunched
                    | OutcomeEventType::FirstCustomer
                    | OutcomeEventType::RaisedFunding
                    | OutcomeEventType::MRRMilestone
            )
        }
        "BuildButPivot" => {
            // BuildButPivot correct if: did pivot but eventually found success
            matches!(outcome.event_type, OutcomeEventType::PivotCompleted)
                && outcome.impact_on_trajectory > 0.0
        }
        "Skip" => {
            // Skip correct if: shutdown quickly, founder gave up, or better off pivoting
            matches!(
                outcome.event_type,
                OutcomeEventType::Shutdown | OutcomeEventType::FounderDoubts
            )
        }
        "ThinkHarder" => {
            // ThinkHarder correct if: founder did strategic pause then came back strong
            matches!(outcome.event_type, OutcomeEventType::FounderConfidence)
        }
        _ => false,
    }
}

/// Extract factors that actually predicted the outcome
fn extract_predictive_signals(
    _event: &FounderDecisionEvent,
    _outcome: &BusinessOutcomeEvent,
) -> Vec<String> {
    // This would be enhanced with ML to identify which features
    // from the original intent actually correlated with outcomes
    vec![
        "founder_experience_level".to_string(),
        "market_size".to_string(),
        "team_size".to_string(),
        "existing_traction".to_string(),
    ]
}

/// Extract signals the system missed
fn extract_missed_signals(
    _event: &FounderDecisionEvent,
    _outcome: &BusinessOutcomeEvent,
) -> Vec<String> {
    // Identify what wasn't captured in the initial analysis
    // but proved important for the outcome
    vec!["founder_psychology".to_string(), "network_strength".to_string()]
}

fn classify_accuracy(
    verdict: &str,
    outcome: &BusinessOutcomeEvent,
    was_correct: &bool,
) -> String {
    if *was_correct {
        "correct".to_string()
    } else if verdict == "BuildNow" && outcome.impact_on_trajectory > 0.5 {
        "too_conservative".to_string() // We said skip/pivot but they succeeded anyway
    } else if verdict == "Skip" && outcome.impact_on_trajectory > 0.7 {
        "too_pessimistic".to_string()
    } else if outcome.impact_on_trajectory < -0.5 {
        "too_optimistic".to_string()
    } else {
        "incorrect".to_string()
    }
}

fn calculate_days_to_confirmation(event: &FounderDecisionEvent, outcome: &BusinessOutcomeEvent) -> i32 {
    // Simple calculation: parse timestamps and get difference in days
    // In production, use proper datetime parsing
    30 // Placeholder
}

/// Suggest weight updates based on feedback
fn suggest_weight_updates(
    _intent: &ParsedIntent,
    was_correct: &bool,
) -> Vec<WeightUpdate> {
    if *was_correct {
        vec![WeightUpdate {
            feature_name: "complexity_score".to_string(),
            old_weight: 1.0,
            suggested_new_weight: 1.05, // Slightly increase importance
            confidence: 0.7,
        }]
    } else {
        vec![WeightUpdate {
            feature_name: "founder_experience".to_string(),
            old_weight: 0.5,
            suggested_new_weight: 0.8, // Increase importance
            confidence: 0.6,
        }]
    }
}

// ============================================================================
// Batch Processing & Aggregation
// ============================================================================

/// Process multiple founder decision+outcome pairs to extract learning signals
pub fn aggregate_learning_signals(
    feedbacks: &[VerdictAccuracyFeedback],
) -> AggregateLearningSignals {
    let mut correct_count = 0;
    let mut total_count = feedbacks.len() as f32;
    let mut accuracy_by_verdict: HashMap<String, f32> = HashMap::new();
    let mut avg_confidence: f32 = 0.0;
    let mut weight_updates: Vec<WeightUpdate> = Vec::new();

    for feedback in feedbacks {
        if feedback.accuracy_classification == "correct" {
            correct_count += 1;
        }

        *accuracy_by_verdict
            .entry(feedback.original_verdict.clone())
            .or_insert(0.0) += 1.0;

        avg_confidence += feedback.original_confidence;
        weight_updates.extend(feedback.suggested_weight_updates.clone());
    }

    // Normalize accuracy by verdict
    for (_, count) in accuracy_by_verdict.iter_mut() {
        *count /= total_count;
    }

    let overall_accuracy = correct_count as f32 / total_count;
    avg_confidence /= total_count;

    AggregateLearningSignals {
        total_feedbacks: feedbacks.len(),
        overall_accuracy,
        accuracy_by_verdict,
        avg_confidence,
        weight_updates,
        recommended_model_version: if overall_accuracy > 0.75 {
            "promote_to_production".to_string()
        } else {
            "retrain".to_string()
        },
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregateLearningSignals {
    pub total_feedbacks: usize,
    pub overall_accuracy: f32,
    pub accuracy_by_verdict: HashMap<String, f32>,
    pub avg_confidence: f32,
    pub weight_updates: Vec<WeightUpdate>,
    pub recommended_model_version: String,
}

// ============================================================================
// Founder Cohort Analytics
// ============================================================================

/// Generate cohort analysis for a specific verdict category
pub fn analyze_verdict_cohort(
    events: &[FounderDecisionEvent],
    outcomes: &[BusinessOutcomeEvent],
    verdict_type: &str,
    cohort_year: i32,
    cohort_month: i32,
) -> FounderCohort {
    // Filter to events with matching verdict and time
    let matching_events: Vec<_> = events
        .iter()
        .filter(|e| {
            e.initial_verdict.verdict == verdict_type
                && e.timestamp.starts_with(&format!("{:04}-{:02}", cohort_year, cohort_month))
        })
        .collect();

    let size = matching_events.len();

    // Correlate with outcomes
    let mut outcomes_summary = CohortOutcomes {
        pmf_rate: 0.0,
        funding_rate: 0.0,
        revenue_rate: 0.0,
        pivot_rate: 0.0,
        shutdown_rate: 0.0,
        avg_time_to_first_customer: 0,
        avg_time_to_funding: 0,
        median_satisfaction: 5.0,
    };

    let mut pmf_count = 0;
    let mut funding_count = 0;
    let mut revenue_count = 0;
    let mut pivot_count = 0;
    let mut shutdown_count = 0;

    for event in matching_events {
        for outcome in outcomes {
            if outcome.founder_id == event.founder_id {
                match outcome.event_type {
                    OutcomeEventType::ReachedPMF => pmf_count += 1,
                    OutcomeEventType::RaisedFunding => funding_count += 1,
                    OutcomeEventType::MRRMilestone => revenue_count += 1,
                    OutcomeEventType::PivotCompleted => pivot_count += 1,
                    OutcomeEventType::Shutdown => shutdown_count += 1,
                    _ => {}
                }
            }
        }
    }

    if size > 0 {
        outcomes_summary.pmf_rate = pmf_count as f32 / size as f32;
        outcomes_summary.funding_rate = funding_count as f32 / size as f32;
        outcomes_summary.revenue_rate = revenue_count as f32 / size as f32;
        outcomes_summary.pivot_rate = pivot_count as f32 / size as f32;
        outcomes_summary.shutdown_rate = shutdown_count as f32 / size as f32;
    }

    FounderCohort {
        verdict_cohort: verdict_type.to_string(),
        cohort_year,
        cohort_month,
        size,
        outcomes: outcomes_summary,
        confidence: (size as f32 / 100.0).min(1.0), // Higher confidence with more samples
    }
}

// ============================================================================
// Flywheel Metrics
// ============================================================================

/// Track the health and growth of the data feedback flywheel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlywheelMetrics {
    /// How many founder decision events in database
    pub total_decisions_tracked: usize,
    /// How many have completed outcomes
    pub outcomes_with_feedback: usize,
    /// % of feedback loops closed
    pub feedback_loop_closure_rate: f32,
    /// Historical model accuracy
    pub model_accuracy_trend: Vec<f32>,
    /// New founders added this period
    pub new_founders_this_period: usize,
    /// Reactivation rate: founders who returned for follow-up analysis
    pub reactivation_rate: f32,
}

pub fn calculate_flywheel_metrics(
    decisions: &[FounderDecisionEvent],
    outcomes: &[BusinessOutcomeEvent],
) -> FlywheelMetrics {
    let total_decisions = decisions.len();
    let mut outcomes_with_feedback = 0;

    for decision in decisions {
        if outcomes
            .iter()
            .any(|o| o.founder_id == decision.founder_id)
        {
            outcomes_with_feedback += 1;
        }
    }

    let feedback_loop_closure_rate = if total_decisions > 0 {
        outcomes_with_feedback as f32 / total_decisions as f32
    } else {
        0.0
    };

    FlywheelMetrics {
        total_decisions_tracked: total_decisions,
        outcomes_with_feedback,
        feedback_loop_closure_rate,
        model_accuracy_trend: vec![0.65, 0.68, 0.71, 0.74, 0.76], // Placeholder trend
        new_founders_this_period: (total_decisions as f32 * 0.1) as usize,
        reactivation_rate: 0.35,
    }
}
