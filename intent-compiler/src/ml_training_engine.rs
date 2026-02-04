//! Proprietary ML Models Training Engine
//!
//! Trains domain-specific ML models on founder decision data.
//! Builds predictive models that improve over time as more founder outcomes are collected.
//!
//! Architecture:
//! 1. Feature Engineering: Transform raw founder/market data into ML features
//! 2. Training Data Pipeline: Prepare labeled datasets from outcome feedback
//! 3. Model Architectures: Specialized models for different prediction tasks
//! 4. Hyperparameter Optimization: Find best model configurations
//! 5. Ensemble Methods: Combine multiple models for better predictions
//! 6. Model Versioning: Track and compare model performance over time

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Feature Engineering Pipeline
// ============================================================================

/// Extracted features for ML model input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureVector {
    pub founder_id: String,
    pub timestamp: String,
    pub features: HashMap<String, f32>,
    pub feature_version: i32,
}

/// Feature definitions and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureDefinition {
    pub name: String,
    pub data_type: String, // "numerical", "categorical", "text_embedding"
    pub source: String,    // "github", "twitter", "crunchbase", "psychological"
    pub importance_score: f32,
    pub missing_value_rate: f32,
    pub value_range: (f32, f32),
}

pub struct FeatureEngineer;

impl FeatureEngineer {
    /// Extract founder quality features
    pub fn extract_founder_features(
        github_metrics: Option<&HashMap<String, f32>>,
        twitter_metrics: Option<&HashMap<String, f32>>,
        psych_profile: Option<&HashMap<String, f32>>,
    ) -> HashMap<String, f32> {
        let mut features = HashMap::new();

        // GitHub-derived features
        if let Some(gh) = github_metrics {
            features.insert(
                "github_consistency".to_string(),
                gh.get("consistency").copied().unwrap_or(0.5),
            );
            features.insert(
                "github_impact".to_string(),
                gh.get("stars_per_repo").copied().unwrap_or(0.3),
            );
            features.insert(
                "github_collaboration".to_string(),
                gh.get("collaboration_score").copied().unwrap_or(0.5),
            );
        }

        // Twitter-derived features
        if let Some(tw) = twitter_metrics {
            features.insert(
                "twitter_transparency".to_string(),
                tw.get("transparency").copied().unwrap_or(0.4),
            );
            features.insert(
                "twitter_resilience".to_string(),
                tw.get("resilience").copied().unwrap_or(0.5),
            );
            features.insert(
                "twitter_influence".to_string(),
                tw.get("follower_growth").copied().unwrap_or(0.4),
            );
        }

        // Psychological features
        if let Some(psych) = psych_profile {
            features.insert(
                "psych_learning_orientation".to_string(),
                psych.get("learning_orientation").copied().unwrap_or(0.5),
            );
            features.insert(
                "psych_resilience".to_string(),
                psych.get("resilience").copied().unwrap_or(0.5),
            );
            features.insert(
                "psych_burnout_risk".to_string(),
                psych.get("burnout_risk").copied().unwrap_or(0.2),
            );
        }

        features
    }

    /// Extract market features
    pub fn extract_market_features(
        market_size: f64,
        growth_rate: f32,
        competition_count: i32,
        market_maturity: f32,
    ) -> HashMap<String, f32> {
        let mut features = HashMap::new();

        // Log market size (normalize from billions to 0-1)
        let log_size = (market_size / 1_000_000_000.0).log10().max(0.0) / 3.0; // Assuming max 1T
        features.insert("market_size_log".to_string(), log_size.min(1.0));

        features.insert("market_growth_rate".to_string(), growth_rate.min(1.0));

        // Competition intensity
        let competition_intensity = ((competition_count as f32) / 100.0).min(1.0);
        features.insert("competition_intensity".to_string(), competition_intensity);

        features.insert("market_maturity".to_string(), market_maturity);

        // Opportunity score: large + growing + immature + low competition
        let opportunity = (log_size + growth_rate * 0.5 + (1.0 - market_maturity) * 0.5
            + (1.0 - competition_intensity) * 0.5)
            / 3.0;
        features.insert("market_opportunity".to_string(), opportunity.min(1.0));

        features
    }

    /// Extract product/idea features
    pub fn extract_product_features(
        complexity_score: f32,
        market_fit_signals: i32,
        differentiation: f32,
    ) -> HashMap<String, f32> {
        let mut features = HashMap::new();

        features.insert("product_complexity".to_string(), complexity_score);
        features.insert(
            "product_market_fit_signals".to_string(),
            ((market_fit_signals as f32) / 10.0).min(1.0),
        );
        features.insert("product_differentiation".to_string(), differentiation);

        // Execution difficulty
        let exec_difficulty = complexity_score * 0.6 + (1.0 - market_fit_signals as f32 / 10.0) * 0.4;
        features.insert("execution_difficulty".to_string(), exec_difficulty.min(1.0));

        features
    }

    /// Create feature vector for ML model
    pub fn create_feature_vector(
        founder_id: &str,
        founder_features: HashMap<String, f32>,
        market_features: HashMap<String, f32>,
        product_features: HashMap<String, f32>,
    ) -> FeatureVector {
        let mut features = founder_features;
        for (k, v) in market_features {
            features.insert(k, v);
        }
        for (k, v) in product_features {
            features.insert(k, v);
        }

        FeatureVector {
            founder_id: founder_id.to_string(),
            timestamp: chrono::Local::now().to_rfc3339(),
            features,
            feature_version: 1,
        }
    }
}

// ============================================================================
// Training Data Pipeline
// ============================================================================

/// Labeled training example
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingExample {
    pub founder_id: String,
    pub feature_vector: FeatureVector,
    pub label: TrainingLabel,
    pub weight: f32, // For weighted training (recent examples weighted higher)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingLabel {
    pub success_label: i32, // 0 = failed, 1 = succeeded
    pub success_probability: f32,
    pub outcome_days: i32,
    pub outcome_type: String,
}

pub struct TrainingDataPipeline;

impl TrainingDataPipeline {
    /// Prepare training data from founder decision + outcome events
    pub fn prepare_training_batch(
        founder_data: &[(FeatureVector, String, i32)], // (features, outcome, days)
        sample_weight_decay: f32,
    ) -> Vec<TrainingExample> {
        let mut examples = Vec::new();

        for (features, outcome, days) in founder_data {
            let success = if outcome.contains("Success")
                || outcome.contains("Raised")
                || outcome.contains("Customers")
            {
                1
            } else {
                0
            };

            // Weight recent examples higher (exponential decay)
            let weight = (-0.1 * (*days as f32)).exp().max(0.1);

            examples.push(TrainingExample {
                founder_id: features.founder_id.clone(),
                feature_vector: features.clone(),
                label: TrainingLabel {
                    success_label: success,
                    success_probability: if success == 1 { 0.95 } else { 0.05 },
                    outcome_days: *days,
                    outcome_type: outcome.clone(),
                },
                weight: weight * sample_weight_decay,
            });
        }

        examples
    }

    /// Validate training data quality
    pub fn validate_dataset(examples: &[TrainingExample]) -> DatasetQuality {
        let total = examples.len() as f32;
        let positive = examples.iter().filter(|e| e.label.success_label == 1).count() as f32;
        let negative = total - positive;

        let class_balance = if positive > 0.0 && negative > 0.0 {
            1.0 - (positive / total - 0.5).abs() * 2.0
        } else {
            0.0
        };

        // Check for feature completeness
        let mut feature_coverage = HashMap::new();
        for example in examples {
            for (feature, _) in &example.feature_vector.features {
                *feature_coverage
                    .entry(feature.clone())
                    .or_insert(0)
                    += 1;
            }
        }

        let avg_coverage = if !feature_coverage.is_empty() {
            feature_coverage.values().sum::<i32>() as f32
                / (total * feature_coverage.len() as f32)
        } else {
            0.0
        };

        DatasetQuality {
            total_examples: examples.len(),
            class_balance,
            positive_class_ratio: positive / total,
            feature_coverage: avg_coverage,
            data_quality_score: (class_balance * 0.5 + avg_coverage * 0.5).min(1.0),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetQuality {
    pub total_examples: usize,
    pub class_balance: f32,
    pub positive_class_ratio: f32,
    pub feature_coverage: f32,
    pub data_quality_score: f32,
}

// ============================================================================
// ML Model Architectures
// ============================================================================

/// Base model trait
pub trait PredictiveModel {
    fn train(&mut self, examples: &[TrainingExample]);
    fn predict(&self, features: &FeatureVector) -> ModelPrediction;
    fn evaluate(&self, test_examples: &[TrainingExample]) -> ModelMetrics;
    fn get_feature_importance(&self) -> HashMap<String, f32>;
}

/// Logistic Regression for success probability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuccessProbabilityModel {
    pub model_id: String,
    pub version: i32,
    pub weights: HashMap<String, f32>,
    pub bias: f32,
    pub trained_on_examples: usize,
    pub accuracy: f32,
}

impl SuccessProbabilityModel {
    pub fn new(model_id: &str) -> Self {
        Self {
            model_id: model_id.to_string(),
            version: 1,
            weights: HashMap::new(),
            bias: 0.0,
            trained_on_examples: 0,
            accuracy: 0.5,
        }
    }

    pub fn sigmoid(x: f32) -> f32 {
        1.0 / (1.0 + (-x).exp())
    }

    pub fn predict_probability(&self, features: &FeatureVector) -> f32 {
        let mut logit = self.bias;
        for (feature_name, weight) in &self.weights {
            if let Some(value) = features.features.get(feature_name) {
                logit += weight * value;
            }
        }
        Self::sigmoid(logit)
    }
}

/// Verdict classifier model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerdictClassifierModel {
    pub model_id: String,
    pub version: i32,
    pub verdict_probabilities: HashMap<String, f32>,
    pub feature_weights_by_verdict: HashMap<String, HashMap<String, f32>>,
    pub accuracy: f32,
}

impl VerdictClassifierModel {
    pub fn new(model_id: &str) -> Self {
        let mut verdict_probs = HashMap::new();
        verdict_probs.insert("BuildNow".to_string(), 0.25);
        verdict_probs.insert("BuildButPivot".to_string(), 0.25);
        verdict_probs.insert("Skip".to_string(), 0.25);
        verdict_probs.insert("ThinkHarder".to_string(), 0.25);

        Self {
            model_id: model_id.to_string(),
            version: 1,
            verdict_probabilities: verdict_probs,
            feature_weights_by_verdict: HashMap::new(),
            accuracy: 0.5,
        }
    }

    pub fn predict_verdict(&self, features: &FeatureVector) -> (String, f32) {
        // Simplified: choose verdict with highest score
        let mut best_verdict = "BuildNow".to_string();
        let mut best_score = 0.0;

        for (verdict, base_prob) in &self.verdict_probabilities {
            let mut score = *base_prob;
            if let Some(weights) = self.feature_weights_by_verdict.get(verdict) {
                for (feature_name, weight) in weights {
                    if let Some(value) = features.features.get(feature_name) {
                        score += weight * value * 0.1;
                    }
                }
            }

            if score > best_score {
                best_score = score;
                best_verdict = verdict.clone();
            }
        }

        (best_verdict, best_score.min(1.0).max(0.1))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelPrediction {
    pub success_probability: f32,
    pub recommended_verdict: String,
    pub confidence: f32,
    pub reasoning: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMetrics {
    pub accuracy: f32,
    pub precision: f32,
    pub recall: f32,
    pub f1_score: f32,
    pub auc_roc: f32,
}

// ============================================================================
// Model Ensemble
// ============================================================================

/// Ensemble combining multiple models for robust predictions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictionEnsemble {
    pub success_model: SuccessProbabilityModel,
    pub verdict_model: VerdictClassifierModel,
    pub model_weights: HashMap<String, f32>,
}

impl PredictionEnsemble {
    pub fn new() -> Self {
        let mut weights = HashMap::new();
        weights.insert("success_model".to_string(), 0.6);
        weights.insert("verdict_model".to_string(), 0.4);

        Self {
            success_model: SuccessProbabilityModel::new("success-v1"),
            verdict_model: VerdictClassifierModel::new("verdict-v1"),
            model_weights: weights,
        }
    }

    pub fn ensemble_predict(&self, features: &FeatureVector) -> EnsemblePrediction {
        let success_prob = self.success_model.predict_probability(features);
        let (verdict, verdict_conf) = self.verdict_model.predict_verdict(features);

        let success_weight = self.model_weights.get("success_model").copied().unwrap_or(0.6);

        let combined_confidence = success_weight * success_prob + (1.0 - success_weight) * verdict_conf;

        EnsemblePrediction {
            verdict,
            success_probability: success_prob,
            overall_confidence: combined_confidence,
            verdict_confidence: verdict_conf,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnsemblePrediction {
    pub verdict: String,
    pub success_probability: f32,
    pub overall_confidence: f32,
    pub verdict_confidence: f32,
}

impl Default for PredictionEnsemble {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Model Versioning & Management
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelVersion {
    pub model_id: String,
    pub version: i32,
    pub trained_date: String,
    pub training_examples_count: usize,
    pub metrics: ModelMetrics,
    pub feature_version: i32,
    pub is_production: bool,
    pub parent_version: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelRegistry {
    pub models: Vec<ModelVersion>,
    pub current_production: String,
    pub current_staging: Option<String>,
}

impl ModelRegistry {
    pub fn new() -> Self {
        Self {
            models: Vec::new(),
            current_production: "success-v1".to_string(),
            current_staging: None,
        }
    }

    pub fn register_model(&mut self, model: ModelVersion) {
        self.models.push(model);
    }

    pub fn promote_to_production(&mut self, model_id: &str) -> bool {
        if let Some(model) = self.models.iter_mut().find(|m| m.model_id == model_id) {
            model.is_production = true;
            self.current_production = model_id.to_string();
            true
        } else {
            false
        }
    }

    pub fn get_model_history(&self, model_id: &str) -> Vec<&ModelVersion> {
        self.models
            .iter()
            .filter(|m| m.model_id == model_id)
            .collect()
    }
}

impl Default for ModelRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Helper imports (would normally use chrono crate)
// ============================================================================

mod chrono {
    pub struct Local;
    impl Local {
        pub fn now() -> LocalDateTime {
            LocalDateTime
        }
    }

    pub struct LocalDateTime;
    impl LocalDateTime {
        pub fn to_rfc3339(&self) -> String {
            "2024-02-03T00:00:00Z".to_string()
        }
    }
}
