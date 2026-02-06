//! JIT (Just-In-Time) Compilation Engine
//! Profiles hot code paths, memoizes results for pure functions,
//! and provides adaptive optimization based on runtime statistics.
//!
//! Since we cannot actually emit native code from Rust closures at runtime
//! without an LLVM/Cranelift backend, the JIT engine instead:
//! 1. Profiles execution frequency and latency per function_id.
//! 2. "Compiles" a hot path by recording a baseline latency so we can
//!    detect regressions.
//! 3. Exposes statistics that upstream callers (ultimate_parse, lib.rs)
//!    use to make caching/parallelism decisions.

use rustc_hash::FxHashMap;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone)]
pub struct JitConfig {
    pub optimization_level: u8, // 0-3
    pub enable_inlining: bool,
    pub enable_vectorization: bool,
    pub code_cache_size: usize,
    /// How many executions before a function is "compiled" (baseline captured).
    pub compilation_threshold: usize,
}

impl Default for JitConfig {
    fn default() -> Self {
        Self {
            optimization_level: 3,
            enable_inlining: true,
            enable_vectorization: true,
            code_cache_size: 1000,
            compilation_threshold: 100,
        }
    }
}

pub struct JitEngine {
    config: JitConfig,
    /// Compiled functions: function_id → baseline profile + execution stats
    code_cache: Arc<Mutex<FxHashMap<u64, CompiledFunction>>>,
    /// Pre-compilation profiling data
    hot_paths: Arc<Mutex<FxHashMap<u64, HotPathStats>>>,
}

#[derive(Debug, Clone)]
struct CompiledFunction {
    /// Baseline average execution time (ns) captured at compilation time
    baseline_avg_ns: u64,
    /// Total executions since compilation
    execution_count: usize,
    /// Running average execution time (ns) post-compilation
    avg_execution_time_ns: u64,
    /// Minimum observed execution time (ns)
    min_execution_time_ns: u64,
    /// Maximum observed execution time (ns)
    max_execution_time_ns: u64,
    /// Number of times execution was >2x the baseline (regression count)
    regression_count: usize,
}

#[derive(Debug, Clone)]
struct HotPathStats {
    execution_count: usize,
    total_time_ns: u64,
    min_time_ns: u64,
    max_time_ns: u64,
    is_compiled: bool,
}

impl Default for JitEngine {
    fn default() -> Self {
        Self::new(JitConfig::default())
    }
}

impl JitEngine {
    pub fn new(config: JitConfig) -> Self {
        Self {
            code_cache: Arc::new(Mutex::new(FxHashMap::default())),
            hot_paths: Arc::new(Mutex::new(FxHashMap::default())),
            config,
        }
    }

    /// Profile function execution and trigger JIT compilation for hot paths.
    ///
    /// Always calls `f()` — the "compilation" benefit is latency tracking
    /// and regression detection, not result memoization (closures may be
    /// impure / carry different captured state).
    pub fn profile_and_execute<F, R>(&self, function_id: u64, f: F) -> R
    where
        F: FnOnce() -> R,
    {
        let start = std::time::Instant::now();

        // Check if already compiled (has baseline)
        if self.is_compiled(function_id) {
            let result = f();
            let elapsed_ns = start.elapsed().as_nanos() as u64;
            self.update_compiled_stats(function_id, elapsed_ns);
            return result;
        }

        // Execute and profile
        let result = f();
        let elapsed_ns = start.elapsed().as_nanos() as u64;

        // Update pre-compilation profiling
        self.record_execution(function_id, elapsed_ns);

        // Check if threshold reached → compile
        if self.should_compile(function_id) {
            self.compile_function(function_id);
        }

        result
    }

    /// Check whether a function has been compiled
    fn is_compiled(&self, function_id: u64) -> bool {
        self.code_cache.lock().unwrap().contains_key(&function_id)
    }

    /// Record a pre-compilation execution
    fn record_execution(&self, function_id: u64, execution_time_ns: u64) {
        let mut hot_paths = self.hot_paths.lock().unwrap();
        let stats = hot_paths.entry(function_id).or_insert(HotPathStats {
            execution_count: 0,
            total_time_ns: 0,
            min_time_ns: u64::MAX,
            max_time_ns: 0,
            is_compiled: false,
        });

        stats.execution_count += 1;
        stats.total_time_ns += execution_time_ns;
        stats.min_time_ns = stats.min_time_ns.min(execution_time_ns);
        stats.max_time_ns = stats.max_time_ns.max(execution_time_ns);
    }

    /// Determine whether a function should be compiled
    fn should_compile(&self, function_id: u64) -> bool {
        let hot_paths = self.hot_paths.lock().unwrap();
        if let Some(stats) = hot_paths.get(&function_id) {
            !stats.is_compiled && stats.execution_count >= self.config.compilation_threshold
        } else {
            false
        }
    }

    /// "Compile" a hot path: capture baseline latency statistics.
    fn compile_function(&self, function_id: u64) {
        let baseline_avg_ns = {
            let mut hot_paths = self.hot_paths.lock().unwrap();
            if let Some(stats) = hot_paths.get_mut(&function_id) {
                stats.is_compiled = true;
                if stats.execution_count > 0 {
                    stats.total_time_ns / stats.execution_count as u64
                } else {
                    0
                }
            } else {
                return;
            }
        };

        let compiled = CompiledFunction {
            baseline_avg_ns,
            execution_count: 0,
            avg_execution_time_ns: 0,
            min_execution_time_ns: u64::MAX,
            max_execution_time_ns: 0,
            regression_count: 0,
        };

        self.code_cache
            .lock()
            .unwrap()
            .insert(function_id, compiled);
    }

    /// Update statistics for an already-compiled function
    fn update_compiled_stats(&self, function_id: u64, execution_time_ns: u64) {
        if let Some(compiled) = self.code_cache.lock().unwrap().get_mut(&function_id) {
            compiled.execution_count += 1;

            // Incremental average
            let prev_total = compiled.avg_execution_time_ns * (compiled.execution_count - 1) as u64;
            compiled.avg_execution_time_ns =
                (prev_total + execution_time_ns) / compiled.execution_count as u64;

            compiled.min_execution_time_ns = compiled.min_execution_time_ns.min(execution_time_ns);
            compiled.max_execution_time_ns = compiled.max_execution_time_ns.max(execution_time_ns);

            // Regression detection: execution > 2x baseline
            if compiled.baseline_avg_ns > 0 && execution_time_ns > compiled.baseline_avg_ns * 2 {
                compiled.regression_count += 1;
            }
        }
    }

    /// Get JIT statistics
    pub fn get_stats(&self) -> JitStats {
        let code_cache = self.code_cache.lock().unwrap();
        let hot_paths = self.hot_paths.lock().unwrap();

        let compiled_functions = code_cache.len();

        // Total executions = pre-compile (hot_paths) + post-compile (code_cache)
        let pre_compile_executions: usize = hot_paths.values().map(|s| s.execution_count).sum();
        let post_compile_executions: usize = code_cache.values().map(|c| c.execution_count).sum();
        let total_executions = pre_compile_executions + post_compile_executions;

        let compiled_executions: usize = hot_paths
            .values()
            .filter(|s| s.is_compiled)
            .map(|s| s.execution_count)
            .sum::<usize>()
            + post_compile_executions;

        let total_regressions: usize = code_cache.values().map(|c| c.regression_count).sum();
        let total_compiled_execs: usize = post_compile_executions;

        JitStats {
            compiled_functions,
            total_executions,
            compiled_executions,
            compilation_ratio: if total_executions > 0 {
                compiled_executions as f64 / total_executions as f64
            } else {
                0.0
            },
            cache_size: code_cache.len(),
            total_regressions,
            regression_rate: if total_compiled_execs > 0 {
                total_regressions as f64 / total_compiled_execs as f64
            } else {
                0.0
            },
        }
    }

    /// Get detailed profile for a specific function
    pub fn get_function_profile(&self, function_id: u64) -> Option<FunctionProfile> {
        let hot_paths = self.hot_paths.lock().unwrap();
        let code_cache = self.code_cache.lock().unwrap();

        let hot = hot_paths.get(&function_id)?;

        let compiled = code_cache.get(&function_id);

        Some(FunctionProfile {
            function_id,
            pre_compile_executions: hot.execution_count,
            pre_compile_avg_ns: if hot.execution_count > 0 {
                hot.total_time_ns / hot.execution_count as u64
            } else {
                0
            },
            is_compiled: hot.is_compiled,
            baseline_avg_ns: compiled.map(|c| c.baseline_avg_ns),
            post_compile_executions: compiled.map(|c| c.execution_count),
            post_compile_avg_ns: compiled.map(|c| c.avg_execution_time_ns),
            post_compile_min_ns: compiled.map(|c| c.min_execution_time_ns),
            post_compile_max_ns: compiled.map(|c| c.max_execution_time_ns),
            regression_count: compiled.map(|c| c.regression_count).unwrap_or(0),
        })
    }

    /// Clear JIT cache and all profiling data
    pub fn clear_cache(&self) {
        self.code_cache.lock().unwrap().clear();
        self.hot_paths.lock().unwrap().clear();
    }

    /// Reset only post-compilation stats (keep baselines)
    pub fn reset_compiled_stats(&self) {
        for compiled in self.code_cache.lock().unwrap().values_mut() {
            compiled.execution_count = 0;
            compiled.avg_execution_time_ns = 0;
            compiled.min_execution_time_ns = u64::MAX;
            compiled.max_execution_time_ns = 0;
            compiled.regression_count = 0;
        }
    }
}

#[derive(Debug, Clone)]
pub struct JitStats {
    pub compiled_functions: usize,
    pub total_executions: usize,
    pub compiled_executions: usize,
    pub compilation_ratio: f64,
    pub cache_size: usize,
    pub total_regressions: usize,
    pub regression_rate: f64,
}

#[derive(Debug, Clone)]
pub struct FunctionProfile {
    pub function_id: u64,
    pub pre_compile_executions: usize,
    pub pre_compile_avg_ns: u64,
    pub is_compiled: bool,
    pub baseline_avg_ns: Option<u64>,
    pub post_compile_executions: Option<usize>,
    pub post_compile_avg_ns: Option<u64>,
    pub post_compile_min_ns: Option<u64>,
    pub post_compile_max_ns: Option<u64>,
    pub regression_count: usize,
}

/// Inline optimization for frequently called functions.
/// Tracks a call graph and decides whether a callee should be inlined
/// based on how often it is called by each caller.
pub struct InlineOptimizer {
    inline_threshold: usize,
    /// caller → list of callees (one entry per call site invocation)
    call_graph: FxHashMap<u64, Vec<u64>>,
}

impl InlineOptimizer {
    pub fn new(inline_threshold: usize) -> Self {
        Self {
            inline_threshold,
            call_graph: FxHashMap::default(),
        }
    }

    /// Should `function_id` be inlined given its observed `call_count`?
    pub fn should_inline(&self, _function_id: u64, call_count: usize) -> bool {
        call_count >= self.inline_threshold
    }

    /// Record a call edge: caller invoked callee
    pub fn record_call(&mut self, caller: u64, callee: u64) {
        self.call_graph
            .entry(caller)
            .or_insert_with(Vec::new)
            .push(callee);
    }

    /// Get the top-N most frequently called callees from a given caller
    pub fn top_callees(&self, caller: u64, n: usize) -> Vec<(u64, usize)> {
        let Some(callees) = self.call_graph.get(&caller) else {
            return vec![];
        };
        let mut freq: FxHashMap<u64, usize> = FxHashMap::default();
        for &callee in callees {
            *freq.entry(callee).or_insert(0) += 1;
        }
        let mut ranked: Vec<(u64, usize)> = freq.into_iter().collect();
        ranked.sort_by(|a, b| b.1.cmp(&a.1));
        ranked.truncate(n);
        ranked
    }
}

/// Vectorization optimizer for SIMD-style batch float operations.
/// Provides real batch math operations that process data in chunks
/// matching the configured vector width.
pub struct VectorizationOptimizer {
    vector_width: usize,
}

impl VectorizationOptimizer {
    pub fn new(vector_width: usize) -> Self {
        Self { vector_width }
    }

    /// Can this loop be vectorized? (requires alignment to vector_width)
    pub fn can_vectorize(&self, loop_size: usize) -> bool {
        loop_size >= self.vector_width && loop_size % self.vector_width == 0
    }

    /// Batch multiply: element-wise multiply of two slices.
    /// Processes in chunks of `vector_width` for cache-friendly access.
    pub fn batch_multiply(&self, a: &[f32], b: &[f32]) -> Vec<f32> {
        let len = a.len().min(b.len());
        let mut result = Vec::with_capacity(len);

        // Process in vector_width chunks
        let chunks = len / self.vector_width;
        for chunk_idx in 0..chunks {
            let base = chunk_idx * self.vector_width;
            for offset in 0..self.vector_width {
                result.push(a[base + offset] * b[base + offset]);
            }
        }

        // Handle remainder
        let remainder_start = chunks * self.vector_width;
        for i in remainder_start..len {
            result.push(a[i] * b[i]);
        }

        result
    }

    /// Batch scale: multiply every element by a scalar.
    pub fn batch_scale(&self, data: &[f32], scalar: f32) -> Vec<f32> {
        let mut result = Vec::with_capacity(data.len());

        let chunks = data.len() / self.vector_width;
        for chunk_idx in 0..chunks {
            let base = chunk_idx * self.vector_width;
            for offset in 0..self.vector_width {
                result.push(data[base + offset] * scalar);
            }
        }

        let remainder_start = chunks * self.vector_width;
        for i in remainder_start..data.len() {
            result.push(data[i] * scalar);
        }

        result
    }

    /// Batch sum: sum all elements, processing in vector_width chunks
    /// to exploit cache-line locality.
    pub fn batch_sum(&self, data: &[f32]) -> f32 {
        let mut partial_sums = vec![0.0f32; self.vector_width];

        let chunks = data.len() / self.vector_width;
        for chunk_idx in 0..chunks {
            let base = chunk_idx * self.vector_width;
            for offset in 0..self.vector_width {
                partial_sums[offset] += data[base + offset];
            }
        }

        let mut total: f32 = partial_sums.iter().sum();

        // Remainder
        let remainder_start = chunks * self.vector_width;
        for i in remainder_start..data.len() {
            total += data[i];
        }

        total
    }

    /// Batch dot product of two vectors.
    pub fn dot_product(&self, a: &[f32], b: &[f32]) -> f32 {
        let product = self.batch_multiply(a, b);
        self.batch_sum(&product)
    }
}

/// Speculative execution engine.
/// Tracks transition frequencies between function_ids and predicts
/// the most likely next function based on observed history.
pub struct SpeculativeExecutor {
    /// from → list of observed destinations (frequency tracking)
    transitions: FxHashMap<u64, FxHashMap<u64, usize>>,
}

impl SpeculativeExecutor {
    pub fn new() -> Self {
        Self {
            transitions: FxHashMap::default(),
        }
    }

    /// Predict the most likely next function after `current`,
    /// based on observed transition frequencies.
    pub fn predict_next(&self, current: u64) -> Option<u64> {
        let dest_map = self.transitions.get(&current)?;
        dest_map
            .iter()
            .max_by_key(|&(_, &count)| count)
            .map(|(&dest, _)| dest)
    }

    /// Get the top-N predictions for what follows `current`.
    pub fn predict_top_n(&self, current: u64, n: usize) -> Vec<(u64, usize)> {
        let Some(dest_map) = self.transitions.get(&current) else {
            return vec![];
        };
        let mut ranked: Vec<(u64, usize)> = dest_map.iter().map(|(&k, &v)| (k, v)).collect();
        ranked.sort_by(|a, b| b.1.cmp(&a.1));
        ranked.truncate(n);
        ranked
    }

    /// Record that execution transitioned from `from` to `to`.
    pub fn record_transition(&mut self, from: u64, to: u64) {
        *self
            .transitions
            .entry(from)
            .or_insert_with(FxHashMap::default)
            .entry(to)
            .or_insert(0) += 1;
    }

    /// Get the total number of transitions observed from a given source.
    pub fn transition_count(&self, from: u64) -> usize {
        self.transitions
            .get(&from)
            .map(|m| m.values().sum())
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jit_engine_compilation_threshold() {
        let jit = JitEngine::default();

        // Execute function multiple times to trigger JIT compilation
        for _ in 0..150 {
            jit.profile_and_execute(1, || {
                let mut sum = 0u64;
                for i in 0..100 {
                    sum += i;
                }
                sum
            });
        }

        let stats = jit.get_stats();
        assert!(
            stats.compiled_functions > 0,
            "function should be compiled after 150 executions"
        );
        assert!(
            stats.total_executions >= 150,
            "should record all executions"
        );
    }

    #[test]
    fn test_jit_function_profile() {
        let config = JitConfig {
            compilation_threshold: 5,
            ..Default::default()
        };
        let jit = JitEngine::new(config);

        // Not yet profiled
        assert!(jit.get_function_profile(42).is_none());

        // Execute a few times (below threshold)
        for _ in 0..3 {
            jit.profile_and_execute(42, || 1 + 1);
        }

        let profile = jit.get_function_profile(42).unwrap();
        assert_eq!(profile.pre_compile_executions, 3);
        assert!(!profile.is_compiled);
        assert!(profile.baseline_avg_ns.is_none());

        // Push past threshold
        for _ in 0..5 {
            jit.profile_and_execute(42, || 1 + 1);
        }

        let profile = jit.get_function_profile(42).unwrap();
        assert!(profile.is_compiled, "should be compiled after 8 executions");
        assert!(profile.baseline_avg_ns.is_some());

        // Execute more to populate post-compilation stats
        for _ in 0..10 {
            jit.profile_and_execute(42, || 1 + 1);
        }

        let profile = jit.get_function_profile(42).unwrap();
        assert!(
            profile.post_compile_executions.unwrap() >= 10,
            "should have at least 10 post-compile executions, got {:?}",
            profile.post_compile_executions
        );
    }

    #[test]
    fn test_jit_clear_cache() {
        let config = JitConfig {
            compilation_threshold: 2,
            ..Default::default()
        };
        let jit = JitEngine::new(config);

        for _ in 0..5 {
            jit.profile_and_execute(1, || 42);
        }

        assert!(jit.get_stats().compiled_functions > 0);

        jit.clear_cache();

        assert_eq!(jit.get_stats().compiled_functions, 0);
        assert_eq!(jit.get_stats().total_executions, 0);
    }

    #[test]
    fn test_jit_regression_stats() {
        let config = JitConfig {
            compilation_threshold: 2,
            ..Default::default()
        };
        let jit = JitEngine::new(config);

        // Quick executions to compile
        for _ in 0..3 {
            jit.profile_and_execute(1, || 42);
        }

        let stats = jit.get_stats();
        // Regression rate should be low for uniform workload
        assert!(stats.regression_rate <= 1.0);
    }

    #[test]
    fn test_inline_optimizer() {
        let mut optimizer = InlineOptimizer::new(10);
        assert!(optimizer.should_inline(1, 15));
        assert!(!optimizer.should_inline(1, 5));

        // Record some calls
        for _ in 0..5 {
            optimizer.record_call(100, 200);
        }
        for _ in 0..3 {
            optimizer.record_call(100, 300);
        }
        optimizer.record_call(100, 400);

        let top = optimizer.top_callees(100, 2);
        assert_eq!(top.len(), 2);
        assert_eq!(top[0], (200, 5)); // Most frequent
        assert_eq!(top[1], (300, 3));
    }

    #[test]
    fn test_vectorization_can_vectorize() {
        let optimizer = VectorizationOptimizer::new(4);
        assert!(optimizer.can_vectorize(16));
        assert!(optimizer.can_vectorize(4));
        assert!(!optimizer.can_vectorize(15));
        assert!(!optimizer.can_vectorize(3));
    }

    #[test]
    fn test_vectorization_batch_multiply() {
        let optimizer = VectorizationOptimizer::new(4);
        let a = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let b = vec![2.0, 3.0, 4.0, 5.0, 6.0];
        let result = optimizer.batch_multiply(&a, &b);
        assert_eq!(result, vec![2.0, 6.0, 12.0, 20.0, 30.0]);
    }

    #[test]
    fn test_vectorization_batch_scale() {
        let optimizer = VectorizationOptimizer::new(4);
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let result = optimizer.batch_scale(&data, 3.0);
        assert_eq!(result, vec![3.0, 6.0, 9.0, 12.0, 15.0]);
    }

    #[test]
    fn test_vectorization_batch_sum() {
        let optimizer = VectorizationOptimizer::new(4);
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let sum = optimizer.batch_sum(&data);
        assert!((sum - 15.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_vectorization_dot_product() {
        let optimizer = VectorizationOptimizer::new(4);
        let a = vec![1.0, 2.0, 3.0, 4.0];
        let b = vec![5.0, 6.0, 7.0, 8.0];
        // dot = 5 + 12 + 21 + 32 = 70
        let dot = optimizer.dot_product(&a, &b);
        assert!((dot - 70.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_speculative_executor_prediction() {
        let mut spec = SpeculativeExecutor::new();

        // Record transitions: 1 → 2 (3x), 1 → 3 (1x), 1 → 4 (2x)
        for _ in 0..3 {
            spec.record_transition(1, 2);
        }
        spec.record_transition(1, 3);
        for _ in 0..2 {
            spec.record_transition(1, 4);
        }

        // Most likely after 1 is 2 (3 observations)
        assert_eq!(spec.predict_next(1), Some(2));

        // Top-2 should be [2, 4]
        let top = spec.predict_top_n(1, 2);
        assert_eq!(top.len(), 2);
        assert_eq!(top[0], (2, 3));
        assert_eq!(top[1], (4, 2));

        // Total transitions from 1
        assert_eq!(spec.transition_count(1), 6);

        // Unknown source returns None
        assert_eq!(spec.predict_next(999), None);
        assert_eq!(spec.transition_count(999), 0);
    }
}
