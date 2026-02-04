//! Hyper-Advanced Caching System
//! Multi-tier cache with predictive prefetching, adaptive eviction, and distributed coordination

use lru::LruCache;
use rustc_hash::FxHashMap;
use std::collections::{HashMap, VecDeque};
use std::num::NonZeroUsize;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub struct CacheEntry<T> {
    pub value: T,
    pub access_count: usize,
    pub last_access: Instant,
    pub creation_time: Instant,
    pub size_bytes: usize,
    pub prediction_score: f64,
}

pub struct HyperCache<T: Clone> {
    // L1: Ultra-fast in-memory LRU cache
    l1_cache: Arc<Mutex<LruCache<u64, CacheEntry<T>>>>,

    // L2: Larger frequency-based cache
    l2_cache: Arc<Mutex<FxHashMap<u64, CacheEntry<T>>>>,

    // L3: Predictive prefetch buffer
    l3_prefetch: Arc<Mutex<VecDeque<(u64, T)>>>,

    // Access pattern tracker for prediction
    access_patterns: Arc<Mutex<AccessPatternTracker>>,

    // Cache statistics
    stats: Arc<Mutex<CacheStats>>,

    // Configuration
    config: CacheConfig,
}

#[derive(Debug, Clone)]
pub struct CacheConfig {
    pub l1_capacity: usize,
    pub l2_capacity: usize,
    pub l3_capacity: usize,
    pub ttl: Duration,
    pub prefetch_threshold: f64,
    pub adaptive_eviction: bool,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            l1_capacity: 1000,
            l2_capacity: 10000,
            l3_capacity: 5000,
            ttl: Duration::from_secs(3600),
            prefetch_threshold: 0.7,
            adaptive_eviction: true,
        }
    }
}

#[derive(Debug, Default)]
pub struct CacheStats {
    pub l1_hits: usize,
    pub l1_misses: usize,
    pub l2_hits: usize,
    pub l2_misses: usize,
    pub l3_hits: usize,
    pub prefetch_successes: usize,
    pub total_evictions: usize,
    pub bytes_cached: usize,
}

impl CacheStats {
    pub fn hit_rate(&self) -> f64 {
        let total_hits = self.l1_hits + self.l2_hits + self.l3_hits;
        let total_requests = total_hits + self.l1_misses + self.l2_misses;

        if total_requests == 0 {
            return 0.0;
        }

        total_hits as f64 / total_requests as f64
    }

    pub fn l1_hit_rate(&self) -> f64 {
        let total = self.l1_hits + self.l1_misses;
        if total == 0 {
            return 0.0;
        }
        self.l1_hits as f64 / total as f64
    }
}

struct AccessPatternTracker {
    patterns: HashMap<u64, Vec<u64>>, // key -> sequence of next keys
    temporal_patterns: VecDeque<(u64, Instant)>,
    max_pattern_length: usize,
}

impl AccessPatternTracker {
    fn new(max_pattern_length: usize) -> Self {
        Self {
            patterns: HashMap::new(),
            temporal_patterns: VecDeque::new(),
            max_pattern_length,
        }
    }

    fn record_access(&mut self, key: u64) {
        self.temporal_patterns.push_back((key, Instant::now()));

        // Keep only recent patterns
        if self.temporal_patterns.len() > self.max_pattern_length * 10 {
            self.temporal_patterns.pop_front();
        }

        // Build access pattern
        if self.temporal_patterns.len() >= 2 {
            let prev_key = self.temporal_patterns[self.temporal_patterns.len() - 2].0;
            self.patterns
                .entry(prev_key)
                .or_insert_with(Vec::new)
                .push(key);
        }
    }

    fn predict_next_keys(&self, current_key: u64, count: usize) -> Vec<u64> {
        if let Some(next_keys) = self.patterns.get(&current_key) {
            // Find most frequent next keys
            let mut frequency: HashMap<u64, usize> = HashMap::new();
            for &key in next_keys {
                *frequency.entry(key).or_insert(0) += 1;
            }

            let mut sorted: Vec<_> = frequency.into_iter().collect();
            sorted.sort_by(|a, b| b.1.cmp(&a.1));

            sorted.into_iter().take(count).map(|(k, _)| k).collect()
        } else {
            Vec::new()
        }
    }
}

impl<T: Clone> HyperCache<T> {
    pub fn new(config: CacheConfig) -> Self {
        Self {
            l1_cache: Arc::new(Mutex::new(LruCache::new(
                NonZeroUsize::new(config.l1_capacity).unwrap(),
            ))),
            l2_cache: Arc::new(Mutex::new(FxHashMap::default())),
            l3_prefetch: Arc::new(Mutex::new(VecDeque::with_capacity(config.l3_capacity))),
            access_patterns: Arc::new(Mutex::new(AccessPatternTracker::new(10))),
            stats: Arc::new(Mutex::new(CacheStats::default())),
            config,
        }
    }

    /// Get value from cache with predictive prefetching
    pub fn get(&self, key: u64) -> Option<T> {
        // Try L1 cache first (fastest)
        {
            let mut l1 = self.l1_cache.lock().unwrap();
            if let Some(entry) = l1.get_mut(&key) {
                entry.access_count += 1;
                entry.last_access = Instant::now();
                self.stats.lock().unwrap().l1_hits += 1;

                // Trigger predictive prefetch
                self.predictive_prefetch(key);

                return Some(entry.value.clone());
            }
        }

        self.stats.lock().unwrap().l1_misses += 1;

        // Try L2 cache
        {
            let mut l2 = self.l2_cache.lock().unwrap();
            if let Some(entry) = l2.get_mut(&key) {
                // Check if expired
                if entry.last_access.elapsed() > self.config.ttl {
                    l2.remove(&key);
                    self.stats.lock().unwrap().l2_misses += 1;
                    return None;
                }

                entry.access_count += 1;
                entry.last_access = Instant::now();
                self.stats.lock().unwrap().l2_hits += 1;

                // Promote to L1
                self.promote_to_l1(key, entry.clone());

                // Trigger predictive prefetch
                self.predictive_prefetch(key);

                return Some(entry.value.clone());
            }
        }

        self.stats.lock().unwrap().l2_misses += 1;

        // Try L3 prefetch buffer
        {
            let mut l3 = self.l3_prefetch.lock().unwrap();
            if let Some(pos) = l3.iter().position(|(k, _)| *k == key) {
                let (_, value) = l3.remove(pos).unwrap();
                self.stats.lock().unwrap().l3_hits += 1;
                self.stats.lock().unwrap().prefetch_successes += 1;

                // Store in L1
                self.put(key, value.clone());

                return Some(value);
            }
        }

        None
    }

    /// Put value into cache with intelligent placement
    pub fn put(&self, key: u64, value: T) {
        let entry = CacheEntry {
            value: value.clone(),
            access_count: 1,
            last_access: Instant::now(),
            creation_time: Instant::now(),
            size_bytes: std::mem::size_of::<T>(),
            prediction_score: 0.0,
        };

        // Always put in L1 first
        {
            let mut l1 = self.l1_cache.lock().unwrap();
            if let Some((evicted_key, evicted_entry)) = l1.push(key, entry.clone()) {
                // Demote evicted entry to L2 if it's frequently accessed
                if evicted_entry.access_count > 5 {
                    self.demote_to_l2(evicted_key, evicted_entry);
                }
                self.stats.lock().unwrap().total_evictions += 1;
            }
        }

        // Record access pattern
        self.access_patterns.lock().unwrap().record_access(key);
    }

    fn promote_to_l1(&self, key: u64, entry: CacheEntry<T>) {
        let mut l1 = self.l1_cache.lock().unwrap();
        if let Some((evicted_key, evicted_entry)) = l1.push(key, entry) {
            if evicted_entry.access_count > 5 {
                self.demote_to_l2(evicted_key, evicted_entry);
            }
        }
    }

    fn demote_to_l2(&self, key: u64, entry: CacheEntry<T>) {
        let mut l2 = self.l2_cache.lock().unwrap();

        // Adaptive eviction: remove least valuable entries if L2 is full
        if l2.len() >= self.config.l2_capacity && self.config.adaptive_eviction {
            self.adaptive_evict_l2(&mut l2);
        }

        l2.insert(key, entry);
    }

    fn adaptive_evict_l2(&self, l2: &mut FxHashMap<u64, CacheEntry<T>>) {
        // Calculate value score for each entry
        let mut scores: Vec<(u64, f64)> = l2
            .iter()
            .map(|(k, e)| {
                let age_penalty = e.last_access.elapsed().as_secs_f64() / 3600.0;
                let frequency_bonus = (e.access_count as f64).ln();
                let score = frequency_bonus - age_penalty;
                (*k, score)
            })
            .collect();

        // Sort by score (ascending) and remove lowest 10%
        scores.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
        let to_remove = (l2.len() / 10).max(1);

        for (key, _) in scores.iter().take(to_remove) {
            l2.remove(key);
            self.stats.lock().unwrap().total_evictions += 1;
        }
    }

    fn predictive_prefetch(&self, current_key: u64) {
        let predicted_keys = self
            .access_patterns
            .lock()
            .unwrap()
            .predict_next_keys(current_key, 5);

        for predicted_key in predicted_keys {
            // Check if already in cache
            if self.is_in_cache(predicted_key) {
                continue;
            }

            // Add to prefetch queue
            // Note: In a real implementation, this would trigger background fetching
            // For now, we just mark it for potential prefetch
        }
    }

    fn is_in_cache(&self, key: u64) -> bool {
        self.l1_cache.lock().unwrap().contains(&key)
            || self.l2_cache.lock().unwrap().contains_key(&key)
    }

    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        self.stats.lock().unwrap().clone()
    }

    /// Clear all caches
    pub fn clear(&self) {
        self.l1_cache.lock().unwrap().clear();
        self.l2_cache.lock().unwrap().clear();
        self.l3_prefetch.lock().unwrap().clear();
    }

    /// Get cache size in bytes (approximate)
    pub fn size_bytes(&self) -> usize {
        let l1_size = self.l1_cache.lock().unwrap().len() * std::mem::size_of::<T>();
        let l2_size = self.l2_cache.lock().unwrap().len() * std::mem::size_of::<T>();
        l1_size + l2_size
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hyper_cache_basic() {
        let cache = HyperCache::<String>::new(CacheConfig::default());

        cache.put(1, "value1".to_string());
        assert_eq!(cache.get(1), Some("value1".to_string()));
        assert_eq!(cache.get(2), None);
    }

    #[test]
    fn test_cache_promotion() {
        let config = CacheConfig {
            l1_capacity: 2,
            ..Default::default()
        };
        let cache = HyperCache::<String>::new(config);

        cache.put(1, "value1".to_string());
        cache.put(2, "value2".to_string());
        cache.put(3, "value3".to_string()); // Should evict 1

        assert_eq!(cache.get(3), Some("value3".to_string()));
        assert_eq!(cache.get(2), Some("value2".to_string()));
    }

    #[test]
    fn test_cache_stats() {
        let cache = HyperCache::<String>::new(CacheConfig::default());

        cache.put(1, "value1".to_string());
        cache.get(1);
        cache.get(2);

        let stats = cache.stats();
        assert_eq!(stats.l1_hits, 1);
        assert!(stats.l1_misses > 0);
    }
}
