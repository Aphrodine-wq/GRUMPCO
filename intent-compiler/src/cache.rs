//! LRU Cache for parsed intents with metrics tracking

use crate::types::{CacheMetrics, IntentOutput};
use lru::LruCache;
use std::hash::{Hash, Hasher};
use std::num::NonZeroUsize;
use std::sync::{Arc, Mutex};

/// Cache key for intent parsing
#[derive(Clone, Debug)]
pub struct CacheKey {
    text_hash: u64,
}

impl CacheKey {
    pub fn new(text: &str, _constraints: &serde_json::Value) -> Self {
        let mut text_hasher = std::collections::hash_map::DefaultHasher::new();
        text.hash(&mut text_hasher);
        let text_hash = text_hasher.finish();

        Self { text_hash }
    }
}

impl PartialEq for CacheKey {
    fn eq(&self, other: &Self) -> bool {
        self.text_hash == other.text_hash
    }
}

impl Eq for CacheKey {}

impl Hash for CacheKey {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.text_hash.hash(state);
    }
}

/// Thread-safe LRU cache for intent parsing results
///
/// This cache stores parsed intent outputs keyed by the input text hash,
/// allowing fast retrieval of previously parsed intents without reprocessing.
pub struct IntentCache {
    state: Arc<Mutex<CacheState>>,
}

#[derive(Debug)]
struct CacheState {
    cache: LruCache<CacheKey, IntentOutput>,
    metrics: CacheMetrics,
}

impl IntentCache {
    /// Create a new cache with the given capacity
    ///
    /// # Arguments
    /// * `capacity` - Maximum number of entries to store in the cache.
    ///   If 0 is passed, defaults to 1000.
    ///
    /// # Example
    ///
    /// ```
    /// use grump_intent::cache::IntentCache;
    ///
    /// let cache = IntentCache::new(1000);
    /// assert_eq!(cache.capacity(), 1000);
    /// ```
    pub fn new(capacity: usize) -> Self {
        let capacity = NonZeroUsize::new(capacity).unwrap_or(NonZeroUsize::new(1000).unwrap());
        Self {
            state: Arc::new(Mutex::new(CacheState {
                cache: LruCache::new(capacity),
                metrics: CacheMetrics::default(),
            })),
        }
    }

    /// Get a parsed intent from the cache
    ///
    /// Returns `Some(IntentOutput)` if the text was previously cached,
    /// or `None` if not found. Updates hit/miss metrics automatically.
    ///
    /// # Arguments
    /// * `text` - The input text to look up
    /// * `constraints` - Optional constraints (currently not used in key computation)
    ///
    /// # Example
    ///
    /// ```no_run
    /// use grump_intent::cache::IntentCache;
    /// use grump_intent::types::{ConfidenceReport, IntentOutput};
    ///
    /// let cache = IntentCache::new(100);
    /// let output = IntentOutput {
    ///     actors: vec!["user".to_string()],
    ///     features: vec![],
    ///     data_flows: vec![],
    ///     tech_stack_hints: vec![],
    ///     constraints: serde_json::json!({}),
    ///     raw: "hello".to_string(),
    ///     enriched_features: vec![],
    ///     enriched_tech: vec![],
    ///     project_type: "unknown".to_string(),
    ///     architecture_pattern: "unknown".to_string(),
    ///     complexity_score: 0.0,
    ///     confidence: ConfidenceReport::default(),
    ///     dependency_graph: vec![],
    ///     sentences: vec![],
    ///     verification: None,
    /// };
    /// cache.put("hello", &serde_json::json!({}), output);
    ///
    /// if let Some(cached) = cache.get("hello", &serde_json::json!({})) {
    ///     println!("Cache hit: {}", cached.raw);
    /// }
    /// ```
    pub fn get(&self, text: &str, constraints: &serde_json::Value) -> Option<IntentOutput> {
        let key = CacheKey::new(text, constraints);
        let mut state = self.state.lock().unwrap();

        if let Some(output) = state.cache.get(&key).cloned() {
            state.metrics.record_hit();
            return Some(output);
        }

        state.metrics.record_miss();
        None
    }

    /// Store a parsed intent in the cache
    ///
    /// Inserts the parsed output into the cache. If the cache is at capacity,
    /// the least recently used entry is evicted. Updates insert/eviction metrics.
    ///
    /// # Arguments
    /// * `text` - The input text (used to compute cache key)
    /// * `constraints` - Optional constraints (currently not used in key computation)
    /// * `output` - The parsed intent output to store
    ///
    /// # Example
    ///
    /// ```no_run
    /// use grump_intent::cache::IntentCache;
    /// use grump_intent::types::{ConfidenceReport, IntentOutput};
    ///
    /// let cache = IntentCache::new(100);
    /// let output = IntentOutput {
    ///     actors: vec!["user".to_string()],
    ///     features: vec![],
    ///     data_flows: vec![],
    ///     tech_stack_hints: vec![],
    ///     constraints: serde_json::json!({}),
    ///     raw: "input text".to_string(),
    ///     enriched_features: vec![],
    ///     enriched_tech: vec![],
    ///     project_type: "unknown".to_string(),
    ///     architecture_pattern: "unknown".to_string(),
    ///     complexity_score: 0.0,
    ///     confidence: ConfidenceReport::default(),
    ///     dependency_graph: vec![],
    ///     sentences: vec![],
    ///     verification: None,
    /// };
    /// cache.put("input text", &serde_json::json!({}), output);
    /// ```
    pub fn put(&self, text: &str, constraints: &serde_json::Value, output: IntentOutput) {
        let key = CacheKey::new(text, constraints);
        let mut state = self.state.lock().unwrap();

        // Check if we're evicting
        let cache_cap: usize = state.cache.cap().into();
        if state.cache.len() == cache_cap && !state.cache.contains(&key) {
            state.metrics.record_eviction();
        }

        state.cache.put(key, output);
        state.metrics.record_insert();
    }

    /// Get current cache metrics
    pub fn get_metrics(&self) -> CacheMetrics {
        self.state.lock().unwrap().metrics.clone()
    }

    /// Reset all metrics
    pub fn reset_metrics(&self) {
        self.state.lock().unwrap().metrics = CacheMetrics::default();
    }

    /// Clear the cache
    pub fn clear(&self) {
        self.state.lock().unwrap().cache.clear();
    }

    /// Get current cache size
    pub fn len(&self) -> usize {
        self.state.lock().unwrap().cache.len()
    }

    /// Check if cache is empty
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Get cache capacity
    pub fn capacity(&self) -> usize {
        self.state.lock().unwrap().cache.cap().into()
    }
}

impl Default for IntentCache {
    fn default() -> Self {
        Self::new(1000)
    }
}

impl Clone for IntentCache {
    fn clone(&self) -> Self {
        Self {
            state: Arc::clone(&self.state),
        }
    }
}

// Global cache instance for convenience
static GLOBAL_CACHE: std::sync::OnceLock<IntentCache> = std::sync::OnceLock::new();

/// Initialize the global cache with the given capacity
///
/// Returns a reference to the global cache instance, initializing it
/// with the specified capacity if not already initialized.
///
/// # Arguments
/// * `capacity` - Maximum number of entries to store in the global cache
///
/// # Example
///
/// ```
/// use grump_intent::cache::init_cache;
///
/// let cache = init_cache(1000);
/// ```
pub fn init_cache(capacity: usize) -> &'static IntentCache {
    GLOBAL_CACHE.get_or_init(|| IntentCache::new(capacity))
}

/// Get the global cache instance (initializes with default if not already set)
pub fn get_cache() -> &'static IntentCache {
    init_cache(1000)
}

/// Get metrics from the global cache
pub fn get_cache_metrics() -> CacheMetrics {
    get_cache().get_metrics()
}

/// Reset the global cache and its metrics
pub fn reset_cache() {
    if let Some(cache) = GLOBAL_CACHE.get() {
        cache.clear();
        cache.reset_metrics();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_key_equality() {
        let key1 = CacheKey::new("test", &serde_json::json!({}));
        let key2 = CacheKey::new("test", &serde_json::json!({}));
        assert_eq!(key1, key2);
    }

    #[test]
    fn test_cache_key_inequality() {
        let key1 = CacheKey::new("test1", &serde_json::json!({}));
        let key2 = CacheKey::new("test2", &serde_json::json!({}));
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_cache_operations() {
        let cache = IntentCache::new(10);
        
        // Test empty cache
        assert!(cache.is_empty());
        assert_eq!(cache.len(), 0);
        
        // Test put and get
        let output = IntentOutput {
            actors: vec!["user".to_string()],
            features: vec![],
            data_flows: vec![],
            tech_stack_hints: vec![],
            constraints: serde_json::json!({}),
            raw: "test".to_string(),
            enriched_features: vec![],
            enriched_tech: vec![],
            project_type: "unknown".to_string(),
            architecture_pattern: "unknown".to_string(),
            complexity_score: 0.0,
            confidence: Default::default(),
            dependency_graph: vec![],
            sentences: vec![],
            verification: None,
        };
        
        cache.put("test", &serde_json::json!({}), output.clone());
        assert_eq!(cache.len(), 1);
        
        let retrieved = cache.get("test", &serde_json::json!({}));
        assert!(retrieved.is_some());
        
        // Test miss
        let miss = cache.get("nonexistent", &serde_json::json!({}));
        assert!(miss.is_none());
    }

    #[test]
    fn test_cache_metrics() {
        let cache = IntentCache::new(10);
        
        let output = IntentOutput {
            actors: vec!["user".to_string()],
            features: vec![],
            data_flows: vec![],
            tech_stack_hints: vec![],
            constraints: serde_json::json!({}),
            raw: "test".to_string(),
            enriched_features: vec![],
            enriched_tech: vec![],
            project_type: "unknown".to_string(),
            architecture_pattern: "unknown".to_string(),
            complexity_score: 0.0,
            confidence: Default::default(),
            dependency_graph: vec![],
            sentences: vec![],
            verification: None,
        };
        
        // First put
        cache.put("test", &serde_json::json!({}), output.clone());
        
        // Get (hit)
        let _ = cache.get("test", &serde_json::json!({}));
        
        // Get (miss)
        let _ = cache.get("missing", &serde_json::json!({}));
        
        let metrics = cache.get_metrics();
        assert_eq!(metrics.hits, 1);
        assert_eq!(metrics.misses, 1);
        assert_eq!(metrics.inserts, 1);
    }

    
}

// Already imported at top of file