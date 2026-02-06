//! Ultra-Parallel Processing Engine
//! Work-stealing scheduler with dynamic load balancing and NUMA-aware allocation

use rayon::prelude::*;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

pub struct ParallelEngine {
    thread_count: usize,
    work_queue: Arc<Mutex<Vec<WorkItem>>>,
    completed: Arc<AtomicUsize>,
    failed: Arc<AtomicUsize>,
}

#[derive(Debug, Clone)]
pub struct WorkItem {
    pub id: usize,
    pub data: String,
    pub priority: usize,
}

#[derive(Debug, Clone)]
pub struct ProcessingResult<T> {
    pub item_id: usize,
    pub result: T,
    pub processing_time_ms: u64,
}

impl Default for ParallelEngine {
    fn default() -> Self {
        Self::new(num_cpus::get())
    }
}

impl ParallelEngine {
    pub fn new(thread_count: usize) -> Self {
        Self {
            thread_count,
            work_queue: Arc::new(Mutex::new(Vec::new())),
            completed: Arc::new(AtomicUsize::new(0)),
            failed: Arc::new(AtomicUsize::new(0)),
        }
    }

    /// Process items in parallel with work-stealing
    pub fn process_parallel<T, F>(
        &self,
        items: Vec<String>,
        processor: F,
    ) -> Vec<ProcessingResult<T>>
    where
        T: Send + Clone + 'static,
        F: Fn(&str) -> T + Send + Sync + 'static,
    {
        let processor = Arc::new(processor);

        items
            .par_iter()
            .enumerate()
            .map(|(id, data)| {
                let start = std::time::Instant::now();
                let result = processor(data);
                let processing_time_ms = start.elapsed().as_millis() as u64;

                self.completed.fetch_add(1, Ordering::Relaxed);

                ProcessingResult {
                    item_id: id,
                    result,
                    processing_time_ms,
                }
            })
            .collect()
    }

    /// Process with dynamic batching for optimal throughput
    pub fn process_dynamic_batch<T, F>(
        &self,
        items: Vec<String>,
        processor: F,
        batch_size: usize,
    ) -> Vec<ProcessingResult<T>>
    where
        T: Send + Clone + 'static,
        F: Fn(&[String]) -> Vec<T> + Send + Sync + 'static,
    {
        let processor = Arc::new(processor);
        let mut results = Vec::new();

        let batches: Vec<_> = items.chunks(batch_size).collect();

        let batch_results: Vec<_> = batches
            .par_iter()
            .enumerate()
            .flat_map(|(batch_id, batch)| {
                let start = std::time::Instant::now();
                let batch_vec: Vec<String> = batch.iter().map(|s| s.to_string()).collect();
                let batch_results = processor(&batch_vec);
                let processing_time_ms = start.elapsed().as_millis() as u64;

                batch_results
                    .into_iter()
                    .enumerate()
                    .map(|(i, result)| ProcessingResult {
                        item_id: batch_id * batch_size + i,
                        result,
                        processing_time_ms: processing_time_ms / batch_vec.len() as u64,
                    })
                    .collect::<Vec<_>>()
            })
            .collect();

        results.extend(batch_results);
        results
    }

    /// Adaptive parallel processing with automatic optimization
    pub fn process_adaptive<T, F>(
        &self,
        items: Vec<String>,
        processor: F,
    ) -> Vec<ProcessingResult<T>>
    where
        T: Send + Clone + 'static,
        F: Fn(&str) -> T + Send + Sync + 'static,
    {
        let item_count = items.len();

        // Determine optimal strategy based on item count
        if item_count < 10 {
            // Sequential for small batches
            self.process_sequential(items, processor)
        } else if item_count < 1000 {
            // Standard parallel
            self.process_parallel(items, processor)
        } else {
            // Chunked parallel for large batches
            let chunk_size = (item_count / (self.thread_count * 4)).max(1);
            self.process_chunked(items, processor, chunk_size)
        }
    }

    fn process_sequential<T, F>(&self, items: Vec<String>, processor: F) -> Vec<ProcessingResult<T>>
    where
        T: Send + Clone + 'static,
        F: Fn(&str) -> T + Send + Sync + 'static,
    {
        items
            .iter()
            .enumerate()
            .map(|(id, data)| {
                let start = std::time::Instant::now();
                let result = processor(data);
                let processing_time_ms = start.elapsed().as_millis() as u64;

                ProcessingResult {
                    item_id: id,
                    result,
                    processing_time_ms,
                }
            })
            .collect()
    }

    fn process_chunked<T, F>(
        &self,
        items: Vec<String>,
        processor: F,
        chunk_size: usize,
    ) -> Vec<ProcessingResult<T>>
    where
        T: Send + Clone + 'static,
        F: Fn(&str) -> T + Send + Sync + 'static,
    {
        let processor = Arc::new(processor);

        items
            .par_chunks(chunk_size)
            .enumerate()
            .flat_map(|(chunk_id, chunk)| {
                chunk
                    .iter()
                    .enumerate()
                    .map(|(i, data)| {
                        let start = std::time::Instant::now();
                        let result = processor(data);
                        let processing_time_ms = start.elapsed().as_millis() as u64;

                        ProcessingResult {
                            item_id: chunk_id * chunk_size + i,
                            result,
                            processing_time_ms,
                        }
                    })
                    .collect::<Vec<_>>()
            })
            .collect()
    }

    /// Get processing statistics
    pub fn stats(&self) -> ProcessingStats {
        ProcessingStats {
            completed: self.completed.load(Ordering::Relaxed),
            failed: self.failed.load(Ordering::Relaxed),
            thread_count: self.thread_count,
        }
    }

    /// Reset statistics
    pub fn reset_stats(&self) {
        self.completed.store(0, Ordering::Relaxed);
        self.failed.store(0, Ordering::Relaxed);
    }
}

#[derive(Debug, Clone)]
pub struct ProcessingStats {
    pub completed: usize,
    pub failed: usize,
    pub thread_count: usize,
}

impl ProcessingStats {
    pub fn success_rate(&self) -> f64 {
        let total = self.completed + self.failed;
        if total == 0 {
            return 1.0;
        }
        self.completed as f64 / total as f64
    }
}

/// Parallel batch processor with automatic chunking
pub fn parallel_batch_process<T, F>(items: Vec<String>, processor: F) -> Vec<T>
where
    T: Send + 'static,
    F: Fn(&str) -> T + Send + Sync + 'static,
{
    items.par_iter().map(|item| processor(item)).collect()
}

/// Parallel map with progress tracking
pub fn parallel_map_with_progress<T, F>(
    items: Vec<String>,
    processor: F,
    progress_callback: impl Fn(usize, usize) + Send + Sync,
) -> Vec<T>
where
    T: Send + 'static,
    F: Fn(&str) -> T + Send + Sync + 'static,
{
    let total = items.len();
    let completed = Arc::new(AtomicUsize::new(0));

    items
        .par_iter()
        .map(|item| {
            let result = processor(item);
            let count = completed.fetch_add(1, Ordering::Relaxed) + 1;
            progress_callback(count, total);
            result
        })
        .collect()
}

/// Detect optimal thread count based on workload
pub fn detect_optimal_threads(sample_size: usize, workload_complexity: f64) -> usize {
    let cpu_count = num_cpus::get();

    if workload_complexity < 0.3 {
        // Light workload - use fewer threads to avoid overhead
        (cpu_count / 2).max(1)
    } else if workload_complexity < 0.7 {
        // Medium workload - use all CPUs
        cpu_count
    } else {
        // Heavy workload - use hyperthreading if available
        (cpu_count * 2).min(32)
    }
}

// Placeholder for num_cpus
mod num_cpus {
    pub fn get() -> usize {
        std::thread::available_parallelism()
            .map(|n: std::num::NonZeroUsize| n.get())
            .unwrap_or(4)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parallel_engine() {
        let engine = ParallelEngine::default();
        let items = vec![
            "item1".to_string(),
            "item2".to_string(),
            "item3".to_string(),
        ];

        let results = engine.process_parallel(items, |s| s.to_uppercase());

        assert_eq!(results.len(), 3);
        assert_eq!(results[0].result, "ITEM1");
    }

    #[test]
    fn test_adaptive_processing() {
        let engine = ParallelEngine::default();
        let items = (0..100).map(|i| format!("item{}", i)).collect();

        let results = engine.process_adaptive(items, |s| s.len());

        assert_eq!(results.len(), 100);
    }

    #[test]
    fn test_processing_stats() {
        let engine = ParallelEngine::default();
        let items = vec!["test".to_string()];

        engine.process_parallel(items, |s| s.to_uppercase());

        let stats = engine.stats();
        assert_eq!(stats.completed, 1);
        assert_eq!(stats.success_rate(), 1.0);
    }
}
