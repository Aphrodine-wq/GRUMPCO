//! Prelude module - re-exports commonly used types and functions

// Core types
pub use crate::types::*;

// Main intent output type
pub use crate::types::FullAnalysis;

// G-Agent types
pub use crate::planner::{Plan, PlanRiskAssessment, PlanStatus, PlanSummary};
pub use crate::tasks::{RiskLevel, Task};

// Semantic analysis
pub use crate::semantics::{
    compose_intents, detect_contradictions, extract_implicit_requirements, suggest_code_style,
    verify_intent, Contradiction, ImplicitRequirement, StyleSuggestion, TypedIntent,
};

// Market intelligence
pub use crate::market_engine::{
    analyze_market, CompetitionLevel, CompetitiveMoat, Competitor, CustomerPsychographic,
    GoToMarketStrategy, MarketAnalysis, MarketSegment, RevenueModel, RiskFactor, UnitEconomics,
    Verdict,
};

// Unified context engine
pub use crate::context_engine::{
    analyze_context, ContextAnalysis, ExecutionInsights, FinalVerdict, MarketInsights,
    ProductInsights, TechnicalInsights, VerdictType,
};

// Moat & defensibility
pub use crate::moat_engine::{
    calculate_moat_strength, competitive_advantage_analysis, moat_revenue_model, AccuracyMoat,
    CompetitorUpdate, FounderComparison, FounderDNAMoat, FounderProfile, MarketIntelMoat,
    MoatRevenue, MoatSystem, NetworkIntelligence, NetworkMoat, PersonalityArchetype,
    ProprietaryMoat, VerdictAccuracy,
};

// Advanced NLP
pub use crate::nlp_engine::{
    interpret_contextually, parse_linguistically, ContextualInterpretation, Entity, EntityType,
    IntentTree, LinguisticAnalysis, Relationship, Sentence,
};

// Founder data & feedback
pub use crate::founder_data_engine::{
    aggregate_learning_signals as aggregate_founder_learning_signals, analyze_verdict_cohort,
    calculate_flywheel_metrics, process_feedback_loop, AggregateLearningSignals,
    BusinessOutcomeEvent, CohortOutcomes, FlywheelMetrics, FounderCohort, FounderDecision,
    FounderDecisionEvent, OutcomeDetails, OutcomeEventType, ParsedIntent, VerdictAccuracyFeedback,
    VerdictCapture,
};

// Market data feeds
pub use crate::market_data_feeds::{
    CompetitiveLandscape, CompetitorData, CrunchbaseConnector, DetectedTrend, DeveloperMetrics,
    FounderIntelligence, FounderProfile as MarketFounderProfile, FounderSentiment, FundingEvent,
    GitHubConnector, MarketDataAggregator, MarketOpportunity, MarketTrendData,
    ProductHuntConnector, RepoMetrics, TwitterConnector, TwitterConversation,
};

// Psychological profiling
pub use crate::psych_profiling_engine::{
    assess_psychological_risks, build_psychological_profile, determine_founder_archetype,
    ArchetypeScore, CommitData, FounderArchetype, FounderPsychologicalProfile,
    GitHubBehavioralAnalyzer, PsychologicalRiskProfile, PsychologicalSignal,
    PsychologicalSignalType, TweetData, TwitterBehavioralAnalyzer,
};

// Accuracy learning
pub use crate::accuracy_learning_engine::{
    aggregate_learning_signals, calculate_accuracy_metrics, calibrate_confidence,
    measure_verdict_accuracy, AccuracyClassification, AccuracyMetrics, AggregatedLearning,
    ConfidenceCalibration, DiscoveredPattern, FeatureAdjustment, LearningSignal,
    OutcomeTrackingEvent, OutcomeType, VerdictAccuracyMeasurement, VerdictMetrics,
};

// ML training
pub use crate::ml_training_engine::{
    DatasetQuality, EnsemblePrediction, FeatureDefinition, FeatureEngineer, FeatureVector,
    ModelMetrics, ModelRegistry, ModelVersion, PredictionEnsemble, SuccessProbabilityModel,
    TrainingDataPipeline, TrainingExample, TrainingLabel, VerdictClassifierModel,
};

// Network intelligence
pub use crate::network_intelligence_engine::{
    adjust_verdict_with_network_intelligence, assess_collective_intelligence,
    model_network_effects, CollectiveIntelligence, FounderNetwork, NetworkAdjustedVerdict,
    NetworkEdge, NetworkEffectsModel, NetworkIntelligenceAnalyzer, NetworkIntelligenceSignals,
    NetworkNode, NodeType, RelationshipType,
};

// ML training pipeline
pub use crate::ml_training_pipeline::{
    generate_model_report, generate_synthetic_training_data, prepare_training_dataset,
    run_improvement_cycle, AutomatedImprovementLoop, DatasetStatistics, ModelMonitoringMetrics,
    ModelTrainingReport, PipelineStatus, ProductionModelManager, TrainedModelCheckpoint,
    TrainingDataExample, TrainingDataset, TrainingPipeline,
};

// Keywords
pub use crate::keywords::{
    AUTH_KEYWORDS, DATA_FLOW_KEYWORDS, PROJECT_MANAGEMENT_KEYWORDS, TECH_STACK_KEYWORDS,
    UI_UX_KEYWORDS,
};
