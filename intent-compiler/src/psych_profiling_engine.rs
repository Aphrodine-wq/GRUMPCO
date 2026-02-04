//! Psychological Profiling Engine for Founder Analysis
//!
//! Deep psychological insight extraction from founder behavior signals.
//! Uses GitHub commits, Twitter posts, communication patterns, and decision history
//! to build a psychological profile that predicts founder success.
//!
//! Architecture:
//! 1. Signal Extraction: Parse behavioral data from GitHub, Twitter, email patterns
//! 2. Pattern Recognition: Identify psychological markers (resilience, bias, learning)
//! 3. Archetype Mapping: Match to founder archetypes (Visionary, Builder, Operator, etc)
//! 4. Risk Profiling: Identify psychological vulnerabilities (burnout, bias blindness, etc)
//! 5. Prediction: Correlate psychological profile with startup success rates

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Psychological Signals from Behavior
// ============================================================================

/// Extracted psychological signal from behavioral data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PsychologicalSignal {
    pub signal_type: PsychologicalSignalType,
    pub value: f32,           // -1.0 to 1.0
    pub confidence: f32,      // 0.0 to 1.0
    pub evidence_count: i32,  // How many data points support this
    pub source: String,       // "github", "twitter", "communication_pattern"
    pub recent_trend: String, // "improving", "stable", "declining"
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PsychologicalSignalType {
    // Resilience signals
    Resilience,             // Ability to bounce back from setbacks
    OwnershipMindset,       // Takes responsibility vs blames external
    LearningOrientation,    // Seeks feedback and learns from mistakes
    AdaptabilityScore,      // Ability to pivot and adjust course

    // Discipline signals
    FollowThrough,          // Completes what they start
    ConsistencyScore,       // Regular, predictable action
    ProcessOrientation,     // Values systems over individual brilliance
    AtomicHabits,           // Makes small progress consistently

    // Intelligence signals
    SystemThinking,         // Can see patterns and complex systems
    ProblemSolving,         // Approaches problems methodically
    LearningVelocity,       // Speed at which they master new domains
    ConceptualAbstraction,  // Can generalize from specific to broader patterns

    // Communication signals
    Transparency,           // Open about failures and challenges
    AskingForHelp,         // Willing to seek input from others
    CommunicationClarity,   // Articulate in explaining ideas
    DebateCreativity,       // Engages in intellectual debate constructively

    // Risk signals (negative indicators)
    Overconfidence,         // Overestimates abilities/market size
    BiasBlindness,          // Unaware of own cognitive biases
    BurnoutRisk,            // Signs of exhaustion or stress
    SinglePointFailure,     // Too dependent on one person

    // Social signals
    NetworkQuality,         // Strength of founder network
    InfluenceRadius,        // How many people pay attention to them
    CollaborationStyle,     // Works well with others vs solo operator
    MentorRelationships,    // Seeks guidance from experienced founders
}

// ============================================================================
// GitHub Behavioral Analysis
// ============================================================================

pub struct GitHubBehavioralAnalyzer;

impl GitHubBehavioralAnalyzer {
    /// Analyze commit history for psychological markers
    pub fn analyze_commit_patterns(
        commits: &[CommitData],
    ) -> Vec<PsychologicalSignal> {
        let mut signals = Vec::new();

        // 1. Consistency: do they commit regularly?
        let consistency = Self::calculate_consistency(commits);
        signals.push(PsychologicalSignal {
            signal_type: PsychologicalSignalType::ConsistencyScore,
            value: consistency,
            confidence: 0.78,
            evidence_count: commits.len() as i32,
            source: "github_commits".to_string(),
            recent_trend: Self::trend_direction(commits, 30),
        });

        // 2. Follow-through: do they complete what they start?
        let follow_through = Self::analyze_branch_completion(commits);
        signals.push(PsychologicalSignal {
            signal_type: PsychologicalSignalType::FollowThrough,
            value: follow_through,
            confidence: 0.72,
            evidence_count: (commits.len() / 10) as i32,
            source: "github_commits".to_string(),
            recent_trend: "stable".to_string(),
        });

        // 3. Learning: do they commit messages show reflection?
        let learning_orientation = Self::analyze_commit_messages(commits);
        signals.push(PsychologicalSignal {
            signal_type: PsychologicalSignalType::LearningOrientation,
            value: learning_orientation,
            confidence: 0.65,
            evidence_count: (commits.len() / 5) as i32,
            source: "github_commits".to_string(),
            recent_trend: "improving".to_string(),
        });

        // 4. Adaptability: do they refactor and improve code?
        let adaptability = Self::analyze_refactoring_patterns(commits);
        signals.push(PsychologicalSignal {
            signal_type: PsychologicalSignalType::AdaptabilityScore,
            value: adaptability,
            confidence: 0.75,
            evidence_count: (commits.len() / 8) as i32,
            source: "github_commits".to_string(),
            recent_trend: "stable".to_string(),
        });

        signals
    }

    fn calculate_consistency(commits: &[CommitData]) -> f32 {
        if commits.is_empty() {
            return 0.0;
        }

        // Analyze distribution of commits over time
        let mut days_with_commits = std::collections::HashSet::new();
        for commit in commits {
            let date_key = commit.date.split('T').next().unwrap_or("");
            days_with_commits.insert(date_key);
        }

        // Perfect consistency would be every day; we'll score based on frequency
        let span_days = 365; // Assuming yearly data
        (days_with_commits.len() as f32 / span_days as f32).min(1.0)
    }

    fn analyze_branch_completion(commits: &[CommitData]) -> f32 {
        // Count branches that were merged vs abandoned
        let mut branch_statuses: HashMap<String, (bool, i32)> = HashMap::new();

        for commit in commits {
            branch_statuses
                .entry(commit.branch.clone())
                .and_modify(|(_, count)| *count += 1)
                .or_insert((false, 1));
        }

        let total_branches = branch_statuses.len() as f32;
        let completed_branches = branch_statuses
            .values()
            .filter(|(merged, count)| *merged || *count > 3) // Either merged or has many commits
            .count() as f32;

        if total_branches == 0.0 {
            0.5
        } else {
            completed_branches / total_branches
        }
    }

    fn analyze_commit_messages(commits: &[CommitData]) -> f32 {
        let learning_keywords = [
            "refactor", "improve", "optimize", "learn", "discovered", "mistake", "bug", "fix",
        ];

        let total = commits.len() as f32;
        let learning_commits = commits
            .iter()
            .filter(|c| {
                learning_keywords
                    .iter()
                    .any(|kw| c.message.to_lowercase().contains(kw))
            })
            .count() as f32;

        if total == 0.0 {
            0.5
        } else {
            (learning_commits / total).min(1.0)
        }
    }

    fn analyze_refactoring_patterns(commits: &[CommitData]) -> f32 {
        let refactor_keywords = ["refactor", "cleanup", "restructure", "improve", "rewrite"];

        let total = commits.len() as f32;
        let refactor_commits = commits
            .iter()
            .filter(|c| {
                refactor_keywords
                    .iter()
                    .any(|kw| c.message.to_lowercase().contains(kw))
            })
            .count() as f32;

        if total == 0.0 {
            0.5
        } else {
            (refactor_commits / (total / 10.0)).min(1.0) // Should be ~10% of commits
        }
    }

    fn trend_direction(commits: &[CommitData], days: i32) -> String {
        // Simplified: compare recent vs older commits
        let recent_threshold = 1; // Last X days
        let recent_count = commits
            .iter()
            .filter(|c| c.date.contains("recent"))
            .count();

        if recent_count > (commits.len() / 10) {
            "improving".to_string()
        } else if recent_count < (commits.len() / 20) {
            "declining".to_string()
        } else {
            "stable".to_string()
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitData {
    pub hash: String,
    pub date: String,
    pub message: String,
    pub branch: String,
    pub files_changed: i32,
    pub insertions: i32,
    pub deletions: i32,
}

// ============================================================================
// Twitter Behavioral Analysis
// ============================================================================

pub struct TwitterBehavioralAnalyzer;

impl TwitterBehavioralAnalyzer {
    /// Analyze tweet history for psychological markers
    pub fn analyze_tweet_patterns(
        tweets: &[TweetData],
    ) -> Vec<PsychologicalSignal> {
        let mut signals = Vec::new();

        // 1. Transparency: do they share failures?
        let transparency = Self::calculate_transparency(tweets);
        signals.push(PsychologicalSignal {
            signal_type: PsychologicalSignalType::Transparency,
            value: transparency,
            confidence: 0.72,
            evidence_count: tweets.len() as i32,
            source: "twitter".to_string(),
            recent_trend: Self::sentiment_trend(tweets),
        });

        // 2. Resilience: how do they respond to criticism?
        let resilience = Self::analyze_response_to_criticism(tweets);
        signals.push(PsychologicalSignal {
            signal_type: PsychologicalSignalType::Resilience,
            value: resilience,
            confidence: 0.68,
            evidence_count: (tweets.len() / 5) as i32,
            source: "twitter".to_string(),
            recent_trend: "stable".to_string(),
        });

        // 3. Learning: do they ask questions and seek input?
        let learning = Self::calculate_learning_signals(tweets);
        signals.push(PsychologicalSignal {
            signal_type: PsychologicalSignalType::LearningOrientation,
            value: learning,
            confidence: 0.65,
            evidence_count: (tweets.len() / 8) as i32,
            source: "twitter".to_string(),
            recent_trend: "improving".to_string(),
        });

        // 4. Burnout risk: signs of exhaustion or stress
        let burnout_risk = Self::detect_burnout_signals(tweets);
        signals.push(PsychologicalSignal {
            signal_type: PsychologicalSignalType::BurnoutRisk,
            value: burnout_risk,
            confidence: 0.70,
            evidence_count: (tweets.len() / 4) as i32,
            source: "twitter".to_string(),
            recent_trend: Self::sentiment_trend(tweets),
        });

        signals
    }

    fn calculate_transparency(tweets: &[TweetData]) -> f32 {
        let failure_keywords = ["failed", "mistake", "learned", "wrong", "struggle", "challenge"];

        let total = tweets.len() as f32;
        let transparent_tweets = tweets
            .iter()
            .filter(|t| failure_keywords.iter().any(|kw| t.text.to_lowercase().contains(kw)))
            .count() as f32;

        if total == 0.0 {
            0.4
        } else {
            (transparent_tweets / total).min(1.0)
        }
    }

    fn analyze_response_to_criticism(tweets: &[TweetData]) -> f32 {
        // Check replies to critical tweets - are they defensive or learning-oriented?
        let defensive_keywords = ["actually", "wrong", "disagree", "nonsense"];
        let learning_keywords = ["thanks", "good point", "hadn't considered", "great feedback"];

        let responses = tweets
            .iter()
            .filter(|t| t.is_reply)
            .collect::<Vec<_>>();

        if responses.is_empty() {
            return 0.5;
        }

        let defensive_responses = responses
            .iter()
            .filter(|t| defensive_keywords.iter().any(|kw| t.text.to_lowercase().contains(kw)))
            .count();

        let learning_responses = responses
            .iter()
            .filter(|t| learning_keywords.iter().any(|kw| t.text.to_lowercase().contains(kw)))
            .count();

        let total = responses.len() as f32;
        ((learning_responses as f32 - defensive_responses as f32) / total).max(-1.0).min(1.0)
    }

    fn calculate_learning_signals(tweets: &[TweetData]) -> f32 {
        let learning_keywords = ["learning", "discovered", "realized", "how do", "anyone know"];

        let total = tweets.len() as f32;
        let learning_tweets = tweets
            .iter()
            .filter(|t| learning_keywords.iter().any(|kw| t.text.to_lowercase().contains(kw)))
            .count() as f32;

        if total == 0.0 {
            0.3
        } else {
            (learning_tweets / total).min(1.0)
        }
    }

    fn detect_burnout_signals(tweets: &[TweetData]) -> f32 {
        let burnout_keywords = [
            "exhausted", "tired", "burned out", "struggling", "overwhelmed", "help", "stuck",
        ];

        let total = tweets.len() as f32;
        let burnout_tweets = tweets
            .iter()
            .filter(|t| burnout_keywords.iter().any(|kw| t.text.to_lowercase().contains(kw)))
            .count() as f32;

        if total == 0.0 {
            0.1
        } else {
            (burnout_tweets / total).min(1.0)
        }
    }

    fn sentiment_trend(tweets: &[TweetData]) -> String {
        let recent = tweets.iter().take(10).collect::<Vec<_>>();
        let avg_sentiment: f32 = recent.iter().map(|t| t.sentiment).sum::<f32>() / recent.len() as f32;

        if avg_sentiment > 0.6 {
            "improving".to_string()
        } else if avg_sentiment < 0.3 {
            "declining".to_string()
        } else {
            "stable".to_string()
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TweetData {
    pub id: String,
    pub text: String,
    pub date: String,
    pub sentiment: f32,     // -1.0 to 1.0
    pub engagement: i32,
    pub is_reply: bool,
    pub is_quote: bool,
}

// ============================================================================
// Founder Archetype Mapping
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FounderArchetype {
    Visionary,      // Big picture thinker, sees opportunities others miss
    Builder,        // Loves shipping, execution-oriented, bias toward action
    Operator,       // Systems thinker, process-oriented, scales organizations
    Evangelist,     // Network builder, charismatic, social connector
    Scientist,      // Data-driven, hypothesis testing, methodical
    Connector,      // Relationship builder, mediates between groups
    Disruptor,      // Challenges status quo, risk-taking, radical vision
    Pragmatist,     // Grounded, practical, risk-aware
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchetypeScore {
    pub archetype: FounderArchetype,
    pub score: f32,           // 0.0 to 1.0
    pub primary_indicators: Vec<String>,
    pub secondary_traits: Vec<String>,
    pub risk_profile: String, // "high_risk", "measured", "conservative"
}

/// Map psychological signals to founder archetype
pub fn determine_founder_archetype(
    signals: &[PsychologicalSignal],
) -> Vec<ArchetypeScore> {
    let mut scores: HashMap<FounderArchetype, f32> = HashMap::new();

    for signal in signals {
        match signal.signal_type {
            PsychologicalSignalType::SystemThinking => {
                *scores.entry(FounderArchetype::Operator).or_insert(0.0) += signal.value * 0.8;
            }
            PsychologicalSignalType::LearningOrientation => {
                *scores.entry(FounderArchetype::Scientist).or_insert(0.0) += signal.value * 0.8;
            }
            PsychologicalSignalType::FollowThrough => {
                *scores.entry(FounderArchetype::Builder).or_insert(0.0) += signal.value * 0.8;
            }
            PsychologicalSignalType::NetworkQuality => {
                *scores.entry(FounderArchetype::Evangelist).or_insert(0.0) += signal.value * 0.8;
            }
            PsychologicalSignalType::Transparency => {
                *scores.entry(FounderArchetype::Pragmatist).or_insert(0.0) += signal.value * 0.7;
            }
            _ => {}
        }
    }

    // Normalize scores
    let total: f32 = scores.values().sum();
    let mut results = scores
        .into_iter()
        .map(|(archetype, score)| ArchetypeScore {
            archetype: archetype.clone(),
            score: if total > 0.0 { score / total } else { 0.0 },
            primary_indicators: vec![],
            secondary_traits: vec![],
            risk_profile: "measured".to_string(),
        })
        .collect::<Vec<_>>();

    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
    results
}

// ============================================================================
// Risk Profiling
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PsychologicalRiskProfile {
    pub founder_id: String,
    pub burnout_risk: f32,          // 0.0 = safe, 1.0 = imminent
    pub overconfidence_risk: f32,   // Tendency to overestimate
    pub bias_blindness_risk: f32,   // Unaware of own biases
    pub single_point_failure: f32,  // Over-dependent on one person
    pub founder_exit_probability: f32, // Likelihood to quit in next year
    pub overall_risk_score: f32,
}

pub fn assess_psychological_risks(
    signals: &[PsychologicalSignal],
) -> PsychologicalRiskProfile {
    let mut risk_profile = PsychologicalRiskProfile {
        founder_id: String::new(),
        burnout_risk: 0.0,
        overconfidence_risk: 0.0,
        bias_blindness_risk: 0.0,
        single_point_failure: 0.0,
        founder_exit_probability: 0.0,
        overall_risk_score: 0.0,
    };

    for signal in signals {
        match signal.signal_type {
            PsychologicalSignalType::BurnoutRisk => {
                risk_profile.burnout_risk = signal.value.max(0.0);
            }
            PsychologicalSignalType::Overconfidence => {
                risk_profile.overconfidence_risk = signal.value.max(0.0);
            }
            PsychologicalSignalType::BiasBlindness => {
                risk_profile.bias_blindness_risk = signal.value.max(0.0);
            }
            PsychologicalSignalType::SinglePointFailure => {
                risk_profile.single_point_failure = signal.value.max(0.0);
            }
            _ => {}
        }
    }

    // Calculate exit probability from burnout and risk factors
    risk_profile.founder_exit_probability = (risk_profile.burnout_risk * 0.4
        + risk_profile.overconfidence_risk * 0.3
        + risk_profile.single_point_failure * 0.3)
        .min(1.0);

    risk_profile.overall_risk_score = (risk_profile.burnout_risk
        + risk_profile.overconfidence_risk
        + risk_profile.bias_blindness_risk
        + risk_profile.single_point_failure)
        / 4.0;

    risk_profile
}

// ============================================================================
// Psychological Profile Summary
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FounderPsychologicalProfile {
    pub founder_id: String,
    pub signals: Vec<PsychologicalSignal>,
    pub primary_archetype: FounderArchetype,
    pub archetype_scores: Vec<ArchetypeScore>,
    pub risk_profile: PsychologicalRiskProfile,
    pub success_probability: f32,
    pub confidence: f32,
}

pub fn build_psychological_profile(
    founder_id: &str,
    commits: &[CommitData],
    tweets: &[TweetData],
) -> FounderPsychologicalProfile {
    let mut signals = Vec::new();

    // Analyze GitHub behavior
    signals.extend(GitHubBehavioralAnalyzer::analyze_commit_patterns(commits));

    // Analyze Twitter behavior
    signals.extend(TwitterBehavioralAnalyzer::analyze_tweet_patterns(tweets));

    // Determine archetype
    let archetype_scores = determine_founder_archetype(&signals);
    let primary_archetype = archetype_scores
        .first()
        .map(|a| a.archetype.clone())
        .unwrap_or(FounderArchetype::Builder);

    // Assess risks
    let risk_profile = assess_psychological_risks(&signals);

    // Calculate success probability (inverse of risk + archetype fit for success)
    let success_probability = 0.7 * (1.0 - risk_profile.overall_risk_score)
        + 0.3
            * archetype_scores
                .first()
                .map(|a| a.score)
                .unwrap_or(0.5);

    FounderPsychologicalProfile {
        founder_id: founder_id.to_string(),
        signals,
        primary_archetype,
        archetype_scores,
        risk_profile,
        success_probability: success_probability.min(1.0).max(0.0),
        confidence: 0.72,
    }
}
