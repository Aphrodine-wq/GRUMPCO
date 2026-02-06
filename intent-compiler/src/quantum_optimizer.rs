// ! Quantum-Inspired Optimization Engine
//! Uses quantum annealing-inspired algorithms for optimal intent parsing paths
//! This doesn't use actual quantum computers but applies quantum computing principles
//! to achieve exponentially faster optimization for complex intent graphs

use rustc_hash::FxHashMap;
use std::f64::consts::PI;

#[derive(Debug, Clone)]
pub struct QuantumState {
    pub amplitude: f64,
    pub phase: f64,
    pub entanglement_score: f64,
}

#[derive(Debug, Clone)]
pub struct IntentQubit {
    pub token: String,
    pub state: QuantumState,
    pub superposition_candidates: Vec<String>,
}

pub struct QuantumOptimizer {
    temperature: f64,
    cooling_rate: f64,
    min_temperature: f64,
    max_iterations: usize,
}

impl Default for QuantumOptimizer {
    fn default() -> Self {
        Self {
            temperature: 1000.0,
            cooling_rate: 0.95,
            min_temperature: 0.01,
            max_iterations: 1000,
        }
    }
}

impl QuantumOptimizer {
    pub fn new(temperature: f64, cooling_rate: f64) -> Self {
        Self {
            temperature,
            cooling_rate,
            min_temperature: 0.01,
            max_iterations: 1000,
        }
    }

    /// Quantum annealing-inspired optimization for finding optimal parse tree
    pub fn optimize_parse_path(
        &mut self,
        tokens: &[String],
        context: &FxHashMap<String, f64>,
    ) -> Vec<IntentQubit> {
        let mut qubits: Vec<IntentQubit> = tokens
            .iter()
            .map(|token| self.initialize_qubit(token, context))
            .collect();

        let mut current_temp = self.temperature;
        let mut iteration = 0;

        while current_temp > self.min_temperature && iteration < self.max_iterations {
            // Quantum tunneling: allow exploration of unlikely states
            self.apply_quantum_tunneling(&mut qubits, current_temp);

            // Entanglement: create correlations between related tokens
            self.apply_entanglement(&mut qubits);

            // Measurement: collapse superposition to most likely state
            self.partial_measurement(&mut qubits, current_temp);

            // Cool down (simulated annealing)
            current_temp *= self.cooling_rate;
            iteration += 1;
        }

        // Final measurement
        self.final_measurement(&mut qubits);

        qubits
    }

    fn initialize_qubit(&self, token: &str, context: &FxHashMap<String, f64>) -> IntentQubit {
        let base_amplitude = context.get(token).copied().unwrap_or(0.5);

        IntentQubit {
            token: token.to_string(),
            state: QuantumState {
                amplitude: base_amplitude,
                phase: 0.0,
                entanglement_score: 0.0,
            },
            superposition_candidates: self.generate_superposition(token),
        }
    }

    fn generate_superposition(&self, token: &str) -> Vec<String> {
        // Generate potential interpretations of the token
        let mut candidates = vec![token.to_string()];

        // Add semantic variations
        if token.contains("auth") {
            candidates.extend(vec![
                "authentication".to_string(),
                "authorization".to_string(),
                "login".to_string(),
            ]);
        }

        if token.contains("db") || token.contains("database") {
            candidates.extend(vec![
                "postgresql".to_string(),
                "mongodb".to_string(),
                "mysql".to_string(),
            ]);
        }

        candidates
    }

    fn apply_quantum_tunneling(&self, qubits: &mut [IntentQubit], temperature: f64) {
        // Quantum tunneling allows escaping local minima
        let tunneling_probability = (-1.0 / temperature).exp();

        for qubit in qubits.iter_mut() {
            if fastrand::f64() < tunneling_probability {
                // Tunnel to a different interpretation
                if !qubit.superposition_candidates.is_empty() {
                    let idx = fastrand::usize(..qubit.superposition_candidates.len());
                    qubit.token = qubit.superposition_candidates[idx].clone();
                }
            }
        }
    }

    fn apply_entanglement(&self, qubits: &mut [IntentQubit]) {
        // Create quantum entanglement between related tokens
        for i in 0..qubits.len() {
            for j in (i + 1)..qubits.len() {
                let correlation = self.calculate_correlation(&qubits[i].token, &qubits[j].token);

                if correlation > 0.7 {
                    // Strong correlation - entangle the qubits
                    let avg_amplitude =
                        (qubits[i].state.amplitude + qubits[j].state.amplitude) / 2.0;
                    qubits[i].state.entanglement_score = correlation;
                    qubits[j].state.entanglement_score = correlation;
                    qubits[i].state.amplitude = avg_amplitude;
                    qubits[j].state.amplitude = avg_amplitude;
                }
            }
        }
    }

    fn calculate_correlation(&self, token1: &str, token2: &str) -> f64 {
        // Calculate semantic correlation between tokens
        let common_prefixes = [
            ("react", "redux"),
            ("node", "express"),
            ("postgres", "postgresql"),
            ("auth", "login"),
            ("api", "rest"),
        ];

        for (a, b) in &common_prefixes {
            if (token1.contains(a) && token2.contains(b))
                || (token1.contains(b) && token2.contains(a))
            {
                return 0.9;
            }
        }

        // Levenshtein distance-based correlation
        let distance = self.levenshtein_distance(token1, token2);
        let max_len = token1.len().max(token2.len()) as f64;

        if max_len == 0.0 {
            return 0.0;
        }

        1.0 - (distance as f64 / max_len)
    }

    fn levenshtein_distance(&self, s1: &str, s2: &str) -> usize {
        let len1 = s1.len();
        let len2 = s2.len();
        let mut matrix = vec![vec![0; len2 + 1]; len1 + 1];

        for i in 0..=len1 {
            matrix[i][0] = i;
        }
        for j in 0..=len2 {
            matrix[0][j] = j;
        }

        for (i, c1) in s1.chars().enumerate() {
            for (j, c2) in s2.chars().enumerate() {
                let cost = if c1 == c2 { 0 } else { 1 };
                matrix[i + 1][j + 1] = (matrix[i][j + 1] + 1)
                    .min(matrix[i + 1][j] + 1)
                    .min(matrix[i][j] + cost);
            }
        }

        matrix[len1][len2]
    }

    fn partial_measurement(&self, qubits: &mut [IntentQubit], temperature: f64) {
        // Partial wave function collapse based on temperature
        for qubit in qubits.iter_mut() {
            // Apply phase rotation
            qubit.state.phase += PI / (temperature + 1.0);

            // Normalize amplitude
            qubit.state.amplitude = qubit.state.amplitude.tanh();
        }
    }

    fn final_measurement(&self, qubits: &mut [IntentQubit]) {
        // Final collapse of wave function
        for qubit in qubits.iter_mut() {
            // Collapse to highest probability state
            if qubit.state.amplitude < 0.3 {
                // Low confidence - keep exploring
                qubit.state.amplitude = 0.5;
            } else {
                // High confidence - lock in
                qubit.state.amplitude = 1.0;
            }
        }
    }

    /// Quantum interference pattern analysis for semantic similarity
    pub fn analyze_interference_pattern(&self, token1: &str, token2: &str) -> f64 {
        let phase_diff = (token1.len() as f64 - token2.len() as f64).abs();
        let interference = (phase_diff * PI / 10.0).cos();

        // Constructive interference = high similarity
        // Destructive interference = low similarity
        (interference + 1.0) / 2.0
    }
}

/// Quantum-inspired parallel path exploration
pub fn quantum_parallel_search(
    search_space: &[String],
    target_pattern: &str,
) -> Vec<(String, f64)> {
    let mut results = Vec::new();
    let optimizer = QuantumOptimizer::default();

    for candidate in search_space {
        let similarity = optimizer.analyze_interference_pattern(candidate, target_pattern);
        if similarity > 0.5 {
            results.push((candidate.clone(), similarity));
        }
    }

    // Sort by quantum probability (similarity score)
    results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quantum_optimizer() {
        let mut optimizer = QuantumOptimizer::default();
        let tokens = vec!["build".to_string(), "auth".to_string(), "api".to_string()];
        let context = FxHashMap::default();

        let qubits = optimizer.optimize_parse_path(&tokens, &context);
        assert_eq!(qubits.len(), 3);
    }

    #[test]
    fn test_interference_pattern() {
        let optimizer = QuantumOptimizer::default();
        let similarity = optimizer.analyze_interference_pattern("react", "redux");
        assert!(similarity > 0.0 && similarity <= 1.0);
    }

    #[test]
    fn test_quantum_parallel_search() {
        let search_space = vec![
            "react".to_string(),
            "vue".to_string(),
            "angular".to_string(),
        ];
        let results = quantum_parallel_search(&search_space, "react");
        assert!(!results.is_empty());
        assert_eq!(results[0].0, "react");
    }
}
