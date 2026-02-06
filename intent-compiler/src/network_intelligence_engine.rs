//! Network Intelligence Engine
//!
//! Analyzes founder networks and relationships to predict success.
//! Identifies network effects, social proof signals, and collective intelligence.
//!
//! Architecture:
//! 1. Network Discovery: Find connections between founders, investors, mentors
//! 2. Influence Scoring: Measure network reach and credibility
//! 3. Pattern Recognition: Identify winning networks and network topologies
//! 4. Collective Intelligence: Aggregate signals from founder peers
//! 5. Network Effects: Model how network participation improves outcomes
//! 6. Verdict Injection: Use network signals to calibrate verdicts

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

// ============================================================================
// Network Discovery & Relationship Mapping
// ============================================================================

/// A founder's network node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkNode {
    pub node_id: String,
    pub node_type: NodeType,
    pub name: String,
    pub influence_score: f32, // 0-1, how much weight does this node have?
    pub connections: Vec<String>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum NodeType {
    Founder,
    Investor,
    Mentor,
    Expert,
    Peer,
    Supporter,
}

/// Relationship between two nodes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkEdge {
    pub source_id: String,
    pub target_id: String,
    pub relationship_type: RelationshipType,
    pub strength: f32,          // 0-1, how strong is the relationship?
    pub interaction_count: i32, // Times they've interacted
    pub last_interaction: String,
    pub mutual_success: bool, // Did they both succeed?
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RelationshipType {
    Cofounder,
    Mentor,
    Investor,
    Customer,
    Collaborator,
    Peer,
    Supporter,
    Acquirer,
}

/// Complete network graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FounderNetwork {
    pub founder_id: String,
    pub nodes: Vec<NetworkNode>,
    pub edges: Vec<NetworkEdge>,
    pub network_density: f32,
    pub clustering_coefficient: f32,
}

impl FounderNetwork {
    pub fn new(founder_id: &str) -> Self {
        Self {
            founder_id: founder_id.to_string(),
            nodes: Vec::new(),
            edges: Vec::new(),
            network_density: 0.0,
            clustering_coefficient: 0.0,
        }
    }

    pub fn add_node(&mut self, node: NetworkNode) {
        self.nodes.push(node);
    }

    pub fn add_edge(&mut self, edge: NetworkEdge) {
        let edge_clone = edge.clone();
        self.edges.push(edge);
        // Update node connections
        if let Some(node) = self
            .nodes
            .iter_mut()
            .find(|n| n.node_id == edge_clone.source_id)
        {
            if !node.connections.contains(&edge_clone.target_id) {
                node.connections.push(edge_clone.target_id.clone());
            }
        }
    }

    /// Calculate network metrics
    pub fn calculate_metrics(&mut self) {
        let n = self.nodes.len() as f32;
        if n <= 1.0 {
            return;
        }

        // Network density: actual edges / possible edges
        let max_edges = (n * (n - 1.0)) / 2.0;
        self.network_density = self.edges.len() as f32 / max_edges;

        // Clustering coefficient: how likely are neighbors to be connected?
        let mut clustering_sum = 0.0;
        let mut count = 0;

        for node in &self.nodes {
            let neighbors: HashSet<_> = node.connections.iter().cloned().collect();
            if neighbors.len() < 2 {
                continue;
            }

            let mut connected_pairs = 0;
            for (i, neighbor_a) in neighbors.iter().enumerate() {
                for neighbor_b in neighbors.iter().skip(i + 1) {
                    if self.has_edge(neighbor_a, neighbor_b) {
                        connected_pairs += 1;
                    }
                }
            }

            let total_possible = neighbors.len() * (neighbors.len() - 1) / 2;
            if total_possible > 0 {
                clustering_sum += connected_pairs as f32 / total_possible as f32;
                count += 1;
            }
        }

        self.clustering_coefficient = if count > 0 {
            clustering_sum / count as f32
        } else {
            0.0
        };
    }

    fn has_edge(&self, a: &str, b: &str) -> bool {
        self.edges.iter().any(|e| {
            (e.source_id == a && e.target_id == b) || (e.source_id == b && e.target_id == a)
        })
    }
}

// ============================================================================
// Network Intelligence Analysis
// ============================================================================

pub struct NetworkIntelligenceAnalyzer;

impl NetworkIntelligenceAnalyzer {
    /// Analyze network for predictive signals
    pub fn analyze_network(network: &FounderNetwork) -> NetworkIntelligenceSignals {
        let mentor_strength = Self::calculate_mentor_strength(network);
        let investor_credibility = Self::calculate_investor_credibility(network);
        let peer_quality = Self::calculate_peer_quality(network);
        let network_reach = Self::calculate_network_reach(network);
        let winning_pattern = Self::detect_winning_pattern(network);

        NetworkIntelligenceSignals {
            mentor_strength,
            investor_credibility,
            peer_quality,
            network_reach,
            has_winning_pattern: winning_pattern.0,
            winning_pattern_type: winning_pattern.1,
            network_resilience: Self::calculate_resilience(network),
            information_advantage: Self::calculate_information_advantage(network),
        }
    }

    /// Strength of mentorship relationships
    fn calculate_mentor_strength(network: &FounderNetwork) -> f32 {
        let mentor_edges = network
            .edges
            .iter()
            .filter(|e| matches!(e.relationship_type, RelationshipType::Mentor))
            .collect::<Vec<_>>();

        if mentor_edges.is_empty() {
            return 0.2; // No mentors is a risk
        }

        let avg_strength =
            mentor_edges.iter().map(|e| e.strength).sum::<f32>() / mentor_edges.len() as f32;
        let mentor_count_score = (mentor_edges.len() as f32 / 3.0).min(1.0); // 3+ mentors is ideal

        (avg_strength + mentor_count_score) / 2.0
    }

    /// Credibility of investor network
    fn calculate_investor_credibility(network: &FounderNetwork) -> f32 {
        let investor_edges = network
            .edges
            .iter()
            .filter(|e| matches!(e.relationship_type, RelationshipType::Investor))
            .collect::<Vec<_>>();

        if investor_edges.is_empty() {
            return 0.0;
        }

        let investor_nodes: HashSet<_> = investor_edges
            .iter()
            .flat_map(|e| vec![e.source_id.clone(), e.target_id.clone()])
            .collect();

        let avg_investor_influence = investor_nodes
            .iter()
            .filter_map(|id| network.nodes.iter().find(|n| n.node_id == *id))
            .map(|n| n.influence_score)
            .sum::<f32>()
            / investor_nodes.len() as f32;

        // Top-tier investors (influence > 0.8) are more credible
        let top_tier_count = investor_nodes
            .iter()
            .filter_map(|id| network.nodes.iter().find(|n| n.node_id == *id))
            .filter(|n| n.influence_score > 0.8)
            .count();

        let top_tier_bonus = (top_tier_count as f32 / investor_nodes.len() as f32) * 0.3;

        (avg_investor_influence + top_tier_bonus).min(1.0)
    }

    /// Quality of peer network
    fn calculate_peer_quality(network: &FounderNetwork) -> f32 {
        let peer_edges = network
            .edges
            .iter()
            .filter(|e| matches!(e.relationship_type, RelationshipType::Peer))
            .collect::<Vec<_>>();

        if peer_edges.is_empty() {
            return 0.3;
        }

        let peer_nodes: HashSet<_> = peer_edges
            .iter()
            .flat_map(|e| vec![e.source_id.clone(), e.target_id.clone()])
            .collect();

        // Are peer network members successful?
        let successful_peers = peer_nodes
            .iter()
            .filter_map(|id| network.nodes.iter().find(|n| n.node_id == *id))
            .filter(|n| n.influence_score > 0.6)
            .count();

        let success_rate = successful_peers as f32 / peer_nodes.len() as f32;
        (success_rate
            + peer_edges.iter().map(|e| e.strength).sum::<f32>() / peer_edges.len() as f32)
            / 2.0
    }

    /// How many people can this founder reach through network?
    fn calculate_network_reach(network: &FounderNetwork) -> i32 {
        // Simple BFS to count reachable nodes
        let mut visited = HashSet::new();
        let mut queue = vec![network.founder_id.clone()];
        let mut hops = 0;

        while !queue.is_empty() && hops < 3 {
            let mut next_queue = Vec::new();
            for node_id in &queue {
                if !visited.contains(node_id) {
                    visited.insert(node_id.clone());
                    if let Some(node) = network.nodes.iter().find(|n| n.node_id == *node_id) {
                        next_queue.extend(node.connections.clone());
                    }
                }
            }
            queue = next_queue;
            hops += 1;
        }

        visited.len() as i32
    }

    /// Detect successful network patterns
    fn detect_winning_pattern(network: &FounderNetwork) -> (bool, String) {
        let has_mentor = network
            .edges
            .iter()
            .any(|e| matches!(e.relationship_type, RelationshipType::Mentor));

        let has_investor = network
            .edges
            .iter()
            .any(|e| matches!(e.relationship_type, RelationshipType::Investor));

        let has_peer_support = network
            .edges
            .iter()
            .filter(|e| matches!(e.relationship_type, RelationshipType::Peer))
            .count()
            >= 2;

        // Winning pattern: mentor + investor + peer support
        if has_mentor && has_investor && has_peer_support {
            (true, "ideal_support_triangle".to_string())
        } else if has_mentor && has_peer_support {
            (true, "strong_learning_network".to_string())
        } else if has_investor && has_peer_support {
            (true, "funded_peer_network".to_string())
        } else {
            (false, "incomplete_network".to_string())
        }
    }

    /// How resilient is the network to founder departure?
    fn calculate_resilience(network: &FounderNetwork) -> f32 {
        // Does the network have multiple strong nodes, or is it centered on one person?
        let influential_nodes = network
            .nodes
            .iter()
            .filter(|n| n.influence_score > 0.6)
            .count();

        let total_nodes = network.nodes.len() as f32;
        if total_nodes == 0.0 {
            return 0.3;
        }

        let influence_diversity = influential_nodes as f32 / total_nodes;
        influence_diversity.max(network.clustering_coefficient)
    }

    /// How much information advantage from unique network position?
    fn calculate_information_advantage(network: &FounderNetwork) -> f32 {
        // Is this founder at the center of information flows?
        // Betweenness centrality - how often is this person on shortest paths?

        // Simplified: count unique industries/sectors in network
        let mut industries = HashSet::new();
        for node in &network.nodes {
            if let Some(industry) = node.metadata.get("industry") {
                industries.insert(industry.clone());
            }
        }

        (industries.len() as f32 / 5.0).min(1.0) // Ideal is 4-5 different sectors
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkIntelligenceSignals {
    pub mentor_strength: f32,
    pub investor_credibility: f32,
    pub peer_quality: f32,
    pub network_reach: i32,
    pub has_winning_pattern: bool,
    pub winning_pattern_type: String,
    pub network_resilience: f32,
    pub information_advantage: f32,
}

// ============================================================================
// Collective Intelligence & Consensus
// ============================================================================

/// Aggregate intelligence from founder peer group
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectiveIntelligence {
    pub peer_group_id: String,
    pub peer_success_rate: f32, // What % of this peer group succeeded?
    pub peer_funding_rate: f32, // What % raised funding?
    pub avg_time_to_exit: i32,  // Days
    pub consensus_verdict: String,
    pub consensus_confidence: f32,
    pub collective_wisdom: Vec<String>, // Patterns observed by group
}

pub fn assess_collective_intelligence(
    founder: &FounderNetwork,
    peer_outcomes: &[(String, String, i32)], // (founder_id, outcome, days)
) -> CollectiveIntelligence {
    // Extract peer nodes
    let peer_nodes: Vec<_> = founder
        .edges
        .iter()
        .filter(|e| matches!(e.relationship_type, RelationshipType::Peer))
        .filter_map(|e| founder.nodes.iter().find(|n| n.node_id == e.target_id))
        .collect();

    let peer_ids: HashSet<_> = peer_nodes.iter().map(|n| n.node_id.clone()).collect();

    // Analyze peer outcomes
    let peer_group_outcomes: Vec<_> = peer_outcomes
        .iter()
        .filter(|(id, _, _)| peer_ids.contains(id))
        .collect();

    let total_peers = peer_group_outcomes.len() as f32;
    let successful = peer_group_outcomes
        .iter()
        .filter(|(_, outcome, _)| outcome.contains("Success") || outcome.contains("Funded"))
        .count() as f32;

    let funded = peer_group_outcomes
        .iter()
        .filter(|(_, outcome, _)| outcome.contains("Funded"))
        .count() as f32;

    let avg_time = if !peer_group_outcomes.is_empty() {
        peer_group_outcomes
            .iter()
            .map(|(_, _, days)| *days)
            .sum::<i32>()
            / peer_group_outcomes.len() as i32
    } else {
        365
    };

    let success_rate = if total_peers > 0.0 {
        successful / total_peers
    } else {
        0.3
    };

    // Consensus verdict based on collective outcomes
    let consensus_verdict = if success_rate > 0.6 {
        "BuildNow".to_string()
    } else if success_rate > 0.4 {
        "BuildButPivot".to_string()
    } else if success_rate > 0.2 {
        "ThinkHarder".to_string()
    } else {
        "Skip".to_string()
    };

    CollectiveIntelligence {
        peer_group_id: format!("peers_of_{}", founder.founder_id),
        peer_success_rate: success_rate,
        peer_funding_rate: funded / total_peers,
        avg_time_to_exit: avg_time,
        consensus_verdict,
        consensus_confidence: (success_rate - 0.5).abs() + 0.3, // More extreme outcomes = higher confidence
        collective_wisdom: vec![
            format!("{:.0}% of peers succeeded", success_rate * 100.0),
            format!("Average time to exit: {} days", avg_time),
        ],
    }
}

// ============================================================================
// Network-Informed Verdict Adjustment
// ============================================================================

/// Use network intelligence to calibrate original verdict
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkAdjustedVerdict {
    pub original_verdict: String,
    pub original_confidence: f32,
    pub network_adjusted_verdict: String,
    pub adjusted_confidence: f32,
    pub network_boost_factor: f32,
    pub reasoning: Vec<String>,
}

pub fn adjust_verdict_with_network_intelligence(
    original_verdict: &str,
    original_confidence: f32,
    network_signals: &NetworkIntelligenceSignals,
    collective_intelligence: &CollectiveIntelligence,
) -> NetworkAdjustedVerdict {
    let mentor_factor = network_signals.mentor_strength * 0.2;
    let investor_factor = network_signals.investor_credibility * 0.15;
    let peer_factor = collective_intelligence.peer_success_rate * 0.15;
    let pattern_bonus = if network_signals.has_winning_pattern {
        0.1
    } else {
        0.0
    };

    let network_boost = (mentor_factor + investor_factor + peer_factor + pattern_bonus).min(0.5);

    let adjusted_confidence = (original_confidence + network_boost).min(1.0);

    // If network is strong enough, it can override verdict
    let mut adjusted_verdict = original_verdict.to_string();
    let mut reasoning = vec![];

    if network_signals.mentor_strength > 0.7 && original_confidence < 0.6 {
        adjusted_verdict = "BuildNow".to_string();
        reasoning.push(format!(
            "Strong mentor network (strength: {:.2}) increases confidence",
            network_signals.mentor_strength
        ));
    }

    if collective_intelligence.peer_success_rate > 0.6 && original_verdict == "Skip" {
        adjusted_verdict = "ThinkHarder".to_string();
        reasoning.push(format!(
            "Peer group success rate {:.0}% suggests reconsidering",
            collective_intelligence.peer_success_rate * 100.0
        ));
    }

    if network_signals.has_winning_pattern {
        reasoning.push(format!(
            "Detected winning network pattern: {}",
            network_signals.winning_pattern_type
        ));
    }

    if reasoning.is_empty() {
        reasoning.push("Network signals align with original verdict".to_string());
    }

    NetworkAdjustedVerdict {
        original_verdict: original_verdict.to_string(),
        original_confidence,
        network_adjusted_verdict: adjusted_verdict,
        adjusted_confidence,
        network_boost_factor: network_boost,
        reasoning,
    }
}

// ============================================================================
// Network Effects Modeling
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkEffectsModel {
    pub founder_id: String,
    pub network_size: usize,
    pub growth_multiplier: f32, // How much does network amplify growth?
    pub fundraising_multiplier: f32,
    pub market_learning_multiplier: f32,
    pub network_health_score: f32,
}

pub fn model_network_effects(network: &FounderNetwork) -> NetworkEffectsModel {
    let network_size = network.nodes.len();

    // Growth multiplier: larger network = more potential customers/users
    let growth_multiplier = 1.0 + (network_size as f32 / 50.0).min(0.5);

    // Fundraising multiplier: strong investor network helps fundraising
    let investor_count = network
        .edges
        .iter()
        .filter(|e| matches!(e.relationship_type, RelationshipType::Investor))
        .count();
    let fundraising_multiplier = 1.0 + (investor_count as f32 / 5.0).min(0.5);

    // Market learning: peer network helps understand market
    let peer_count = network
        .edges
        .iter()
        .filter(|e| matches!(e.relationship_type, RelationshipType::Peer))
        .count();
    let market_learning_multiplier = 1.0 + (peer_count as f32 / 3.0).min(0.3);

    let network_health_score =
        (growth_multiplier + fundraising_multiplier + market_learning_multiplier) / 3.0;

    NetworkEffectsModel {
        founder_id: network.founder_id.clone(),
        network_size,
        growth_multiplier,
        fundraising_multiplier,
        market_learning_multiplier,
        network_health_score,
    }
}
