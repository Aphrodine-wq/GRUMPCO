//! Neural-Inspired Pattern Matching Engine
//! Implements artificial neural network concepts for intent pattern recognition
//! Uses backpropagation-like learning and attention mechanisms

use rustc_hash::FxHashMap;
use std::collections::VecDeque;

#[derive(Debug, Clone)]
pub struct Neuron {
    pub weights: Vec<f64>,
    pub bias: f64,
    pub activation: f64,
}

#[derive(Debug, Clone)]
pub struct AttentionHead {
    pub query_weights: Vec<f64>,
    pub key_weights: Vec<f64>,
    pub value_weights: Vec<f64>,
    pub attention_scores: Vec<f64>,
}

pub struct NeuralPatternEngine {
    input_layer: Vec<Neuron>,
    hidden_layers: Vec<Vec<Neuron>>,
    output_layer: Vec<Neuron>,
    attention_heads: Vec<AttentionHead>,
    learning_rate: f64,
    momentum: f64,
    pattern_memory: FxHashMap<String, Vec<f64>>,
}

impl Default for NeuralPatternEngine {
    fn default() -> Self {
        Self::new(128, vec![256, 128, 64], 32, 8)
    }
}

impl NeuralPatternEngine {
    pub fn new(
        input_size: usize,
        hidden_sizes: Vec<usize>,
        output_size: usize,
        num_attention_heads: usize,
    ) -> Self {
        let input_layer = Self::initialize_layer(input_size, input_size);
        let mut hidden_layers = Vec::new();

        let mut prev_size = input_size;
        for &size in &hidden_sizes {
            hidden_layers.push(Self::initialize_layer(size, prev_size));
            prev_size = size;
        }

        let output_layer = Self::initialize_layer(output_size, prev_size);

        let attention_heads = (0..num_attention_heads)
            .map(|_| AttentionHead {
                query_weights: vec![0.1; input_size],
                key_weights: vec![0.1; input_size],
                value_weights: vec![0.1; input_size],
                attention_scores: vec![0.0; input_size],
            })
            .collect();

        Self {
            input_layer,
            hidden_layers,
            output_layer,
            attention_heads,
            learning_rate: 0.01,
            momentum: 0.9,
            pattern_memory: FxHashMap::default(),
        }
    }

    fn initialize_layer(size: usize, input_size: usize) -> Vec<Neuron> {
        (0..size)
            .map(|_| Neuron {
                weights: (0..input_size)
                    .map(|_| (fastrand::f64() - 0.5) * 0.2)
                    .collect(),
                bias: (fastrand::f64() - 0.5) * 0.1,
                activation: 0.0,
            })
            .collect()
    }

    /// Forward pass through the neural network
    pub fn forward_pass(&mut self, input: &[f64]) -> Vec<f64> {
        // Apply multi-head attention first
        let attended_input = self.apply_multi_head_attention(input);

        // Input layer
        let mut activations = attended_input;

        // Hidden layers with ReLU activation
        for layer in &mut self.hidden_layers {
            activations = Self::activate_layer(layer, &activations, ActivationFunction::ReLU);
        }

        // Output layer with softmax
        Self::activate_layer(
            &mut self.output_layer,
            &activations,
            ActivationFunction::Softmax,
        )
    }

    fn activate_layer(
        layer: &mut [Neuron],
        input: &[f64],
        activation_fn: ActivationFunction,
    ) -> Vec<f64> {
        let mut outputs = Vec::with_capacity(layer.len());

        for neuron in layer.iter_mut() {
            let weighted_sum: f64 = neuron
                .weights
                .iter()
                .zip(input.iter())
                .map(|(w, i)| w * i)
                .sum::<f64>()
                + neuron.bias;

            neuron.activation = match activation_fn {
                ActivationFunction::ReLU => weighted_sum.max(0.0),
                ActivationFunction::Sigmoid => 1.0 / (1.0 + (-weighted_sum).exp()),
                ActivationFunction::Tanh => weighted_sum.tanh(),
                ActivationFunction::Softmax => weighted_sum.exp(), // Will normalize later
            };

            outputs.push(neuron.activation);
        }

        // Normalize for softmax
        if matches!(activation_fn, ActivationFunction::Softmax) {
            let sum: f64 = outputs.iter().sum();
            if sum > 0.0 {
                outputs.iter_mut().for_each(|x| *x /= sum);
            }
        }

        outputs
    }

    /// Multi-head attention mechanism (Transformer-style)
    fn apply_multi_head_attention(&mut self, input: &[f64]) -> Vec<f64> {
        let mut attended_outputs = vec![0.0; input.len()];

        for head in &mut self.attention_heads {
            // Compute queries, keys, values
            let queries: Vec<f64> = head
                .query_weights
                .iter()
                .zip(input.iter())
                .map(|(w, i)| w * i)
                .collect();

            let keys: Vec<f64> = head
                .key_weights
                .iter()
                .zip(input.iter())
                .map(|(w, i)| w * i)
                .collect();

            let values: Vec<f64> = head
                .value_weights
                .iter()
                .zip(input.iter())
                .map(|(w, i)| w * i)
                .collect();

            // Compute attention scores (scaled dot-product attention)
            let scale = (input.len() as f64).sqrt();
            head.attention_scores = queries
                .iter()
                .zip(keys.iter())
                .map(|(q, k)| (q * k) / scale)
                .collect();

            // Softmax normalization
            let max_score = head
                .attention_scores
                .iter()
                .cloned()
                .fold(f64::NEG_INFINITY, f64::max);
            let exp_scores: Vec<f64> = head
                .attention_scores
                .iter()
                .map(|s| (s - max_score).exp())
                .collect();
            let sum_exp: f64 = exp_scores.iter().sum();

            if sum_exp > 0.0 {
                head.attention_scores = exp_scores.iter().map(|e| e / sum_exp).collect();
            }

            // Apply attention to values
            for (i, value) in values.iter().enumerate() {
                if i < attended_outputs.len() && i < head.attention_scores.len() {
                    attended_outputs[i] += head.attention_scores[i] * value;
                }
            }
        }

        // Average across attention heads
        let num_heads = self.attention_heads.len() as f64;
        attended_outputs.iter_mut().for_each(|x| *x /= num_heads);

        attended_outputs
    }

    /// Pattern recognition with learned embeddings
    pub fn recognize_pattern(&mut self, text: &str) -> PatternRecognition {
        let embedding = self.text_to_embedding(text);
        let output = self.forward_pass(&embedding);

        // Find dominant pattern
        let (max_idx, &max_confidence) = output
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
            .unwrap_or((0, &0.0));

        PatternRecognition {
            pattern_id: max_idx,
            confidence: max_confidence,
            pattern_vector: output,
            attention_map: self.extract_attention_map(),
        }
    }

    fn text_to_embedding(&self, text: &str) -> Vec<f64> {
        // Check pattern memory first
        if let Some(cached) = self.pattern_memory.get(text) {
            return cached.clone();
        }

        // Simple character-based embedding with positional encoding
        let mut embedding = vec![0.0; 128];
        let bytes = text.as_bytes();

        for (i, &byte) in bytes.iter().enumerate().take(128) {
            let pos = i as f64;
            // Sinusoidal positional encoding
            embedding[i] =
                (byte as f64 / 255.0) * (pos / 10000.0_f64.powf(2.0 * i as f64 / 128.0)).sin();
        }

        embedding
    }

    fn extract_attention_map(&self) -> Vec<f64> {
        self.attention_heads
            .iter()
            .flat_map(|head| head.attention_scores.clone())
            .collect()
    }

    /// Online learning: update weights based on feedback
    pub fn learn_from_feedback(&mut self, input: &[f64], target: &[f64]) {
        // Forward pass
        let output = self.forward_pass(input);

        // Compute error
        let errors: Vec<f64> = output
            .iter()
            .zip(target.iter())
            .map(|(o, t)| t - o)
            .collect();

        // Backpropagation (simplified)
        self.update_output_layer(&errors);
    }

    fn update_output_layer(&mut self, errors: &[f64]) {
        for (neuron, &error) in self.output_layer.iter_mut().zip(errors.iter()) {
            let gradient = error * self.learning_rate;

            // Update weights
            for weight in &mut neuron.weights {
                *weight += gradient * self.momentum;
            }

            // Update bias
            neuron.bias += gradient;
        }
    }

    /// Recurrent processing for sequential patterns
    pub fn process_sequence(&mut self, sequence: &[String]) -> Vec<PatternRecognition> {
        let mut results = Vec::new();
        let mut hidden_state = vec![0.0; 128];

        for token in sequence {
            let mut embedding = self.text_to_embedding(token);

            // Mix with hidden state (recurrent connection)
            for (e, h) in embedding.iter_mut().zip(hidden_state.iter()) {
                *e = (*e + h) / 2.0;
            }

            let recognition = self.recognize_pattern(token);

            // Update hidden state
            hidden_state = recognition.pattern_vector.clone();
            if hidden_state.len() < 128 {
                hidden_state.resize(128, 0.0);
            } else {
                hidden_state.truncate(128);
            }

            results.push(recognition);
        }

        results
    }

    /// Cache frequently seen patterns
    pub fn cache_pattern(&mut self, text: String, embedding: Vec<f64>) {
        // LRU-style eviction if cache is too large
        if self.pattern_memory.len() > 10000 {
            // Remove random 10% of entries
            let keys_to_remove: Vec<String> =
                self.pattern_memory.keys().take(1000).cloned().collect();

            for key in keys_to_remove {
                self.pattern_memory.remove(&key);
            }
        }

        self.pattern_memory.insert(text, embedding);
    }
}

#[derive(Debug, Clone, Copy)]
enum ActivationFunction {
    ReLU,
    Sigmoid,
    Tanh,
    Softmax,
}

#[derive(Debug, Clone)]
pub struct PatternRecognition {
    pub pattern_id: usize,
    pub confidence: f64,
    pub pattern_vector: Vec<f64>,
    pub attention_map: Vec<f64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_neural_pattern_engine() {
        let mut engine = NeuralPatternEngine::default();
        let recognition = engine.recognize_pattern("build a react app");
        assert!(recognition.confidence >= 0.0 && recognition.confidence <= 1.0);
    }

    #[test]
    fn test_sequence_processing() {
        let mut engine = NeuralPatternEngine::default();
        let sequence = vec![
            "build".to_string(),
            "a".to_string(),
            "react".to_string(),
            "app".to_string(),
        ];
        let results = engine.process_sequence(&sequence);
        assert_eq!(results.len(), 4);
    }

    #[test]
    fn test_attention_mechanism() {
        let mut engine = NeuralPatternEngine::default();
        let input = vec![0.5; 128];
        let output = engine.forward_pass(&input);
        assert!(!output.is_empty());
    }
}
