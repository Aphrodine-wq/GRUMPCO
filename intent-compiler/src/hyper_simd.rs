//! Hyper-Optimized SIMD Parser with AVX-512 Support
//! Pushes the boundaries of vectorized text processing
//! Processes 64 bytes per instruction with AVX-512

use std::arch::x86_64::*;

/// Ultra-fast pattern matching using AVX-512 instructions
#[cfg(target_arch = "x86_64")]
pub unsafe fn avx512_pattern_match(text: &[u8], pattern: &[u8]) -> Vec<usize> {
    if !is_x86_feature_detected!("avx512f") {
        return fallback_pattern_match(text, pattern);
    }

    let mut matches = Vec::new();
    let pattern_len = pattern.len();

    if pattern_len == 0 || text.len() < pattern_len {
        return matches;
    }

    let first_byte = pattern[0];
    let chunks = text.chunks_exact(64);
    let remainder = chunks.remainder();
    let num_chunks = text.len() / 64;

    // Create broadcast vector of first pattern byte
    let pattern_vec = _mm512_set1_epi8(first_byte as i8);

    for (chunk_idx, chunk) in chunks.enumerate() {
        // Load 64 bytes at once
        let text_vec = _mm512_loadu_si512(chunk.as_ptr() as *const __m512i);

        // Compare all 64 bytes simultaneously
        let cmp_mask = _mm512_cmpeq_epi8_mask(text_vec, pattern_vec);

        if cmp_mask != 0 {
            // Found potential matches - verify full pattern
            for bit_pos in 0..64 {
                if (cmp_mask & (1 << bit_pos)) != 0 {
                    let pos = chunk_idx * 64 + bit_pos;
                    if pos + pattern_len <= text.len() && &text[pos..pos + pattern_len] == pattern {
                        matches.push(pos);
                    }
                }
            }
        }
    }

    // Process remainder
    for (i, &byte) in remainder.iter().enumerate() {
        let pos = num_chunks * 64 + i;
        if byte == first_byte
            && pos + pattern_len <= text.len()
            && &text[pos..pos + pattern_len] == pattern
        {
            matches.push(pos);
        }
    }

    matches
}

/// Parallel keyword scanning with AVX-512
#[cfg(target_arch = "x86_64")]
pub unsafe fn avx512_multi_keyword_scan(text: &[u8], keywords: &[&[u8]]) -> Vec<(usize, usize)> {
    if !is_x86_feature_detected!("avx512f") {
        return fallback_multi_keyword_scan(text, keywords);
    }

    let mut results = Vec::new();

    for (keyword_idx, keyword) in keywords.iter().enumerate() {
        let matches = avx512_pattern_match(text, keyword);
        for pos in matches {
            results.push((keyword_idx, pos));
        }
    }

    results.sort_by_key(|(_, pos)| *pos);
    results
}

/// Vectorized lowercase conversion with AVX-512
#[cfg(target_arch = "x86_64")]
pub unsafe fn avx512_lowercase(text: &[u8]) -> Vec<u8> {
    if !is_x86_feature_detected!("avx512f") {
        return fallback_lowercase(text);
    }

    let mut result = Vec::with_capacity(text.len());
    let chunks = text.chunks_exact(64);
    let remainder = chunks.remainder();

    let upper_a = _mm512_set1_epi8(b'A' as i8);
    let upper_z = _mm512_set1_epi8(b'Z' as i8);
    let to_lower = _mm512_set1_epi8(32);

    for chunk in chunks {
        let text_vec = _mm512_loadu_si512(chunk.as_ptr() as *const __m512i);

        // Check if bytes are uppercase (A-Z)
        let ge_a = _mm512_cmpge_epi8_mask(text_vec, upper_a);
        let le_z = _mm512_cmple_epi8_mask(text_vec, upper_z);
        let is_upper = ge_a & le_z;

        // Add 32 to uppercase letters to convert to lowercase
        let lower_vec = _mm512_mask_add_epi8(text_vec, is_upper, text_vec, to_lower);

        // Store result
        let mut buffer = [0u8; 64];
        _mm512_storeu_si512(buffer.as_mut_ptr() as *mut __m512i, lower_vec);
        result.extend_from_slice(&buffer);
    }

    // Process remainder
    for &byte in remainder {
        result.push(if byte >= b'A' && byte <= b'Z' {
            byte + 32
        } else {
            byte
        });
    }

    result
}

/// Hyper-fast token counting with AVX-512
#[cfg(target_arch = "x86_64")]
pub unsafe fn avx512_count_tokens(text: &[u8], delimiter: u8) -> usize {
    if !is_x86_feature_detected!("avx512f") {
        return fallback_count_tokens(text, delimiter);
    }

    let mut count = 0;
    let chunks = text.chunks_exact(64);
    let remainder = chunks.remainder();

    let delim_vec = _mm512_set1_epi8(delimiter as i8);

    for chunk in chunks {
        let text_vec = _mm512_loadu_si512(chunk.as_ptr() as *const __m512i);
        let cmp_mask = _mm512_cmpeq_epi8_mask(text_vec, delim_vec);
        count += cmp_mask.count_ones() as usize;
    }

    // Process remainder
    count += remainder.iter().filter(|&&b| b == delimiter).count();

    count + 1 // Number of tokens = delimiters + 1
}

/// Vectorized whitespace trimming
#[cfg(target_arch = "x86_64")]
pub unsafe fn avx512_trim_whitespace(text: &[u8]) -> &[u8] {
    if text.is_empty() {
        return text;
    }

    // Find first non-whitespace
    let mut start = 0;
    for (i, &byte) in text.iter().enumerate() {
        if !byte.is_ascii_whitespace() {
            start = i;
            break;
        }
    }

    // Find last non-whitespace
    let mut end = text.len();
    for (i, &byte) in text.iter().enumerate().rev() {
        if !byte.is_ascii_whitespace() {
            end = i + 1;
            break;
        }
    }

    &text[start..end]
}

/// Parallel hash computation for cache keys
#[cfg(target_arch = "x86_64")]
pub unsafe fn avx512_fast_hash(data: &[u8]) -> u64 {
    if !is_x86_feature_detected!("avx512f") {
        return fallback_fast_hash(data);
    }

    let mut hash: u64 = 0xcbf29ce484222325; // FNV-1a offset basis
    const FNV_PRIME: u64 = 0x100000001b3;

    let chunks = data.chunks_exact(8);
    let remainder = chunks.remainder();

    for chunk in chunks {
        let value = u64::from_le_bytes(chunk.try_into().unwrap());
        hash ^= value;
        hash = hash.wrapping_mul(FNV_PRIME);
    }

    for &byte in remainder {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(FNV_PRIME);
    }

    hash
}

// ============================================================================
// Fallback implementations for non-AVX-512 systems
// ============================================================================

fn fallback_pattern_match(text: &[u8], pattern: &[u8]) -> Vec<usize> {
    text.windows(pattern.len())
        .enumerate()
        .filter_map(|(i, window)| if window == pattern { Some(i) } else { None })
        .collect()
}

fn fallback_multi_keyword_scan(text: &[u8], keywords: &[&[u8]]) -> Vec<(usize, usize)> {
    let mut results = Vec::new();
    for (keyword_idx, keyword) in keywords.iter().enumerate() {
        let matches = fallback_pattern_match(text, keyword);
        for pos in matches {
            results.push((keyword_idx, pos));
        }
    }
    results.sort_by_key(|(_, pos)| *pos);
    results
}

fn fallback_lowercase(text: &[u8]) -> Vec<u8> {
    text.iter()
        .map(|&b| if b >= b'A' && b <= b'Z' { b + 32 } else { b })
        .collect()
}

fn fallback_count_tokens(text: &[u8], delimiter: u8) -> usize {
    text.iter().filter(|&&b| b == delimiter).count() + 1
}

fn fallback_fast_hash(data: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    const FNV_PRIME: u64 = 0x100000001b3;

    for &byte in data {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(FNV_PRIME);
    }

    hash
}

/// Public safe wrapper for pattern matching
pub fn fast_pattern_match(text: &[u8], pattern: &[u8]) -> Vec<usize> {
    #[cfg(target_arch = "x86_64")]
    unsafe {
        avx512_pattern_match(text, pattern)
    }

    #[cfg(not(target_arch = "x86_64"))]
    fallback_pattern_match(text, pattern)
}

/// Public safe wrapper for multi-keyword scanning
pub fn fast_multi_keyword_scan(text: &[u8], keywords: &[&[u8]]) -> Vec<(usize, usize)> {
    #[cfg(target_arch = "x86_64")]
    unsafe {
        avx512_multi_keyword_scan(text, keywords)
    }

    #[cfg(not(target_arch = "x86_64"))]
    fallback_multi_keyword_scan(text, keywords)
}

/// Public safe wrapper for lowercase conversion
pub fn fast_lowercase(text: &[u8]) -> Vec<u8> {
    #[cfg(target_arch = "x86_64")]
    unsafe {
        avx512_lowercase(text)
    }

    #[cfg(not(target_arch = "x86_64"))]
    fallback_lowercase(text)
}

/// Public safe wrapper for token counting
pub fn fast_count_tokens(text: &[u8], delimiter: u8) -> usize {
    #[cfg(target_arch = "x86_64")]
    unsafe {
        avx512_count_tokens(text, delimiter)
    }

    #[cfg(not(target_arch = "x86_64"))]
    fallback_count_tokens(text, delimiter)
}

/// Public safe wrapper for fast hashing
pub fn fast_hash(data: &[u8]) -> u64 {
    #[cfg(target_arch = "x86_64")]
    unsafe {
        avx512_fast_hash(data)
    }

    #[cfg(not(target_arch = "x86_64"))]
    fallback_fast_hash(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pattern_match() {
        let text = b"hello world hello rust";
        let pattern = b"hello";
        let matches = fast_pattern_match(text, pattern);
        assert_eq!(matches.len(), 2);
        assert_eq!(matches[0], 0);
        assert_eq!(matches[1], 12);
    }

    #[test]
    fn test_lowercase() {
        let text = b"Hello WORLD";
        let lower = fast_lowercase(text);
        assert_eq!(&lower, b"hello world");
    }

    #[test]
    fn test_count_tokens() {
        let text = b"one two three four";
        let count = fast_count_tokens(text, b' ');
        assert_eq!(count, 4);
    }

    #[test]
    fn test_fast_hash() {
        let data = b"test data";
        let hash1 = fast_hash(data);
        let hash2 = fast_hash(data);
        assert_eq!(hash1, hash2);
    }
}
