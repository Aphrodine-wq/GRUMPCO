//! Comprehensive Integration Tests for Intent Compiler
//! Tests all features with real workloads

use grump_intent::*;

#[cfg(test)]
mod cache_tests {
    use super::*;

    #[test]
    fn test_cache_hit_rate() {
        let cache = hyper_cache::HyperCache::new(hyper_cache::CacheConfig::default());

        // Insert items
        for i in 0..100 {
            cache.put(i, format!("value_{}", i));
        }

        // Test hits
        let mut hits = 0;
        for i in 0..100 {
            if cache.get(i).is_some() {
                hits += 1;
            }
        }

        assert_eq!(hits, 100, "All items should be in cache");

        let stats = cache.stats();
        assert!(stats.hit_rate() > 0.9, "Hit rate should be >90%");
    }

    #[test]
    fn test_cache_eviction() {
        let cache = hyper_cache::HyperCache::new(hyper_cache::CacheConfig {
            l1_capacity: 10,
            l2_capacity: 20,
            l3_capacity: 30,
        });

        // Fill beyond capacity
        for i in 0..100 {
            cache.put(i, format!("value_{}", i));
        }

        // Recent items should still be there
        for i in 90..100 {
            assert!(
                cache.get(i).is_some(),
                "Recent item {} should be in cache",
                i
            );
        }
    }
}

#[cfg(test)]
mod simd_tests {
    use super::*;

    #[test]
    fn test_simd_lowercase() {
        let input = b"HELLO WORLD 123!";
        let output = hyper_simd::fast_lowercase(input);
        let expected = b"hello world 123!";

        assert_eq!(output, expected, "SIMD lowercase should work correctly");
    }

    #[test]
    fn test_simd_hash_consistency() {
        let input = b"test string";

        let hash1 = hyper_simd::fast_hash(input);
        let hash2 = hyper_simd::fast_hash(input);

        assert_eq!(hash1, hash2, "Hash should be deterministic");
    }

    #[test]
    fn test_simd_pattern_match() {
        let text = b"find the needle in the haystack";
        let pattern = b"needle";

        let result = hyper_simd::fast_pattern_match(text, pattern);
        assert!(result, "Should find pattern in text");
    }

    #[test]
    fn test_simd_large_input() {
        let input = vec![b'A'; 10_000];
        let output = hyper_simd::fast_lowercase(&input);

        assert_eq!(output.len(), input.len());
        assert!(output.iter().all(|&b| b == b'a'));
    }
}

#[cfg(test)]
mod parallel_tests {
    use super::*;

    #[test]
    fn test_parallel_processing() {
        let engine = parallel_engine::ParallelEngine::default();

        let items: Vec<i32> = (0..1000).collect();
        let results = engine.process_parallel(items, |x| x * 2);

        assert_eq!(results.len(), 1000);
        for (i, result) in results.iter().enumerate() {
            assert_eq!(result.result, (i as i32) * 2);
        }
    }

    #[test]
    fn test_parallel_error_handling() {
        let engine = parallel_engine::ParallelEngine::default();

        let items: Vec<i32> = (0..100).collect();
        let results = engine.process_parallel(items, |x| {
            if x == 50 {
                panic!("Simulated error");
            }
            x * 2
        });

        // Should handle error gracefully
        let success_count = results.iter().filter(|r| r.success).count();
        assert_eq!(success_count, 99, "Should have 99 successful results");
    }

    #[test]
    fn test_adaptive_strategy() {
        let engine = parallel_engine::ParallelEngine::default();

        // Small batch - should use sequential
        let small: Vec<i32> = (0..5).collect();
        let results = engine.process_adaptive(small, |x| x * 2);
        assert_eq!(results.len(), 5);

        // Large batch - should use parallel
        let large: Vec<i32> = (0..1000).collect();
        let results = engine.process_adaptive(large, |x| x * 2);
        assert_eq!(results.len(), 1000);
    }
}

#[cfg(test)]
mod lock_free_tests {
    use super::*;

    #[test]
    fn test_lock_free_ring_buffer() {
        let buffer = zero_copy::LockFreeRingBuffer::new(100);

        // Push items
        for i in 0..50 {
            assert!(buffer.push(Box::new(i)).is_ok());
        }

        assert_eq!(buffer.len(), 50);

        // Pop items
        for i in 0..50 {
            let item = buffer.pop().expect("Should pop item");
            assert_eq!(*item, i);
        }

        assert!(buffer.is_empty());
    }

    #[test]
    fn test_lock_free_stack() {
        let stack = zero_copy::LockFreeStack::new();

        for i in 0..100 {
            stack.push(i);
        }

        // LIFO order
        for i in (0..100).rev() {
            assert_eq!(stack.pop(), Some(i));
        }

        assert_eq!(stack.pop(), None);
    }

    #[test]
    fn test_arena_allocator() {
        let arena = zero_copy::Arena::new(1024 * 1024); // 1MB

        // Allocate many small objects
        for i in 0..1000 {
            let val = arena.alloc(i).expect("Should allocate");
            assert_eq!(*val, i);
        }

        assert!(arena.used() > 0);
        assert!(arena.available() < 1024 * 1024);
    }
}

#[cfg(test)]
mod compression_tests {
    use super::*;

    #[test]
    fn test_int8_quantization() {
        let compressor = model_compression::ModelCompressor::new(
            model_compression::QuantizationType::INT8,
        );

        let weights = vec![0.5, -0.3, 0.8, -0.1, 0.2, -0.7, 0.1, -0.9];
        let compressed = compressor.compress_weights(&weights);

        assert!(compressed.compression_ratio() >= 4.0);

        let decompressed = compressor.decompress_weights(&compressed);
        assert_eq!(decompressed.len(), weights.len());

        // Check accuracy (should be close)
        for (orig, decomp) in weights.iter().zip(decompressed.iter()) {
            let error = (orig - decomp).abs();
            assert!(error < 0.1, "Quantization error too large: {}", error);
        }
    }

    #[test]
    fn test_binary_quantization() {
        let compressor = model_compression::ModelCompressor::new(
            model_compression::QuantizationType::BINARY,
        );

        let weights = vec![0.5, -0.3, 0.8, -0.1, 0.2, -0.7, 0.1, -0.9];
        let compressed = compressor.compress_weights(&weights);

        assert!(compressed.compression_ratio() >= 32.0);

        let decompressed = compressor.decompress_weights(&compressed);
        assert_eq!(decompressed.len(), weights.len());

        // Binary should be +1 or -1
        for val in decompressed.iter() {
            assert!(val.abs() == 1.0);
        }
    }

    #[test]
    fn test_weight_pruning() {
        let compressor = model_compression::ModelCompressor::default();
        let mut weights = vec![0.5, 0.001, 0.8, 0.002, 0.3, 0.0001, 0.7];

        let stats = compressor.prune_weights(&mut weights);

        assert!(stats.pruned_weights > 0);
        assert!(stats.sparsity > 0.0);

        // Small weights should be zero
        assert_eq!(weights[1], 0.0);
        assert_eq!(weights[3], 0.0);
        assert_eq!(weights[5], 0.0);
    }
}

#[cfg(test)]
mod jit_tests {
    use super::*;

    #[test]
    fn test_jit_profiling() {
        let jit = jit_engine::JitEngine::default();

        // Execute function multiple times
        for _ in 0..150 {
            jit.profile_and_execute(1, || {
                let mut sum = 0;
                for i in 0..100 {
                    sum += i;
                }
                sum
            });
        }

        let stats = jit.get_stats();
        assert!(stats.compiled_functions > 0, "Should have compiled functions");
        assert!(
            stats.compilation_ratio > 0.0,
            "Should have some compiled executions"
        );
    }

    #[test]
    fn test_jit_cache_clearing() {
        let jit = jit_engine::JitEngine::default();

        // Execute and compile
        for _ in 0..150 {
            jit.profile_and_execute(1, || 42);
        }

        let stats_before = jit.get_stats();
        assert!(stats_before.compiled_functions > 0);

        // Clear cache
        jit.clear_cache();

        let stats_after = jit.get_stats();
        assert_eq!(stats_after.compiled_functions, 0);
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;

    #[test]
    fn test_full_pipeline() {
        // This tests the entire pipeline
        let text = "Build a React application with authentication and real-time features";
        let constraints = serde_json::json!({});

        let output = parse_intent(text, constraints);

        assert!(!output.features.is_empty(), "Should extract features");
        assert!(output.confidence > 0.0, "Should have confidence score");
        assert!(!output.raw.is_empty(), "Should have raw text");
    }

    #[test]
    fn test_batch_processing() {
        let texts = vec![
            "Build a React app".to_string(),
            "Create a Node.js API".to_string(),
            "Make a Vue.js dashboard".to_string(),
            "Develop a Python backend".to_string(),
        ];

        let results: Vec<_> = texts
            .iter()
            .map(|text| parse_intent(text, serde_json::json!({})))
            .collect();

        assert_eq!(results.len(), 4);
        for result in results {
            assert!(!result.features.is_empty());
        }
    }

    #[test]
    fn test_error_handling() {
        // Test with empty input
        let output = parse_intent("", serde_json::json!({}));
        // Should handle gracefully, not panic
        assert!(output.confidence >= 0.0);
    }

    #[test]
    fn test_large_input() {
        // Test with large input
        let large_text = "Build a web application ".repeat(1000);
        let output = parse_intent(&large_text, serde_json::json!({}));

        assert!(!output.features.is_empty());
        assert!(output.confidence > 0.0);
    }
}

#[cfg(test)]
mod benchmark_tests {
    use super::*;
    use std::time::Instant;

    #[test]
    fn benchmark_single_parse() {
        let text = "Build a React application with authentication";
        let iterations = 1000;

        let start = Instant::now();
        for _ in 0..iterations {
            let _ = parse_intent(text, serde_json::json!({}));
        }
        let elapsed = start.elapsed();

        let avg_time_us = elapsed.as_micros() / iterations;
        println!("Average parse time: {}μs", avg_time_us);

        // Should be reasonably fast
        assert!(avg_time_us < 10_000, "Parse should be under 10ms");
    }

    #[test]
    fn benchmark_cache_performance() {
        let cache = hyper_cache::HyperCache::new(hyper_cache::CacheConfig::default());

        // Warm up cache
        for i in 0..100 {
            cache.put(i, format!("value_{}", i));
        }

        let iterations = 10_000;
        let start = Instant::now();

        for _ in 0..iterations {
            for i in 0..100 {
                let _ = cache.get(i);
            }
        }

        let elapsed = start.elapsed();
        let ops_per_sec = (iterations * 100) as f64 / elapsed.as_secs_f64();

        println!("Cache ops/sec: {:.0}", ops_per_sec);
        assert!(ops_per_sec > 1_000_000.0, "Cache should be fast");
    }

    #[test]
    fn benchmark_simd_vs_scalar() {
        let input = vec![b'A'; 10_000];
        let iterations = 1000;

        // SIMD version
        let start = Instant::now();
        for _ in 0..iterations {
            let _ = hyper_simd::fast_lowercase(&input);
        }
        let simd_time = start.elapsed();

        // Scalar version
        let start = Instant::now();
        for _ in 0..iterations {
            let _: Vec<u8> = input.iter().map(|b| b.to_ascii_lowercase()).collect();
        }
        let scalar_time = start.elapsed();

        println!("SIMD time: {:?}", simd_time);
        println!("Scalar time: {:?}", scalar_time);

        let speedup = scalar_time.as_secs_f64() / simd_time.as_secs_f64();
        println!("SIMD speedup: {:.2}x", speedup);

        // SIMD should be faster (if AVX-512 is available)
        // If not available, they should be similar (fallback to scalar)
    }
}
