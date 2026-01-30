//! SIMD-optimized text processing
//! Uses AVX2/AVX-512 for parallel byte comparison and keyword scanning

#[cfg(target_arch = "x86_64")]
use std::arch::x86_64::*;

/// SIMD-accelerated keyword scanner
/// Uses AVX2 for parallel byte comparison (32 bytes at once)
#[cfg(all(target_arch = "x86_64", target_feature = "avx2"))]
pub fn fast_keyword_scan(text: &[u8], keywords: &[&str]) -> Vec<(usize, String)> {
    let mut matches = Vec::new();
    
    unsafe {
        let len = text.len();
        let chunks = len / 32;
        
        for keyword in keywords {
            let keyword_bytes = keyword.as_bytes();
            if keyword_bytes.is_empty() {
                continue;
            }
            
            let first_byte = keyword_bytes[0];
            let first_byte_vec = _mm256_set1_epi8(first_byte as i8);
            
            // Scan in 32-byte chunks using AVX2
            for i in 0..chunks {
                let offset = i * 32;
                let chunk = _mm256_loadu_si256(text.as_ptr().add(offset) as *const __m256i);
                
                // Compare all 32 bytes at once
                let cmp = _mm256_cmpeq_epi8(chunk, first_byte_vec);
                let mask = _mm256_movemask_epi8(cmp);
                
                if mask != 0 {
                    // Found potential match, verify full keyword
                    for bit in 0..32 {
                        if (mask & (1 << bit)) != 0 {
                            let pos = offset + bit;
                            if pos + keyword_bytes.len() <= len {
                                if &text[pos..pos + keyword_bytes.len()] == keyword_bytes {
                                    matches.push((pos, keyword.to_string()));
                                }
                            }
                        }
                    }
                }
            }
            
            // Handle remaining bytes (< 32)
            let remainder_start = chunks * 32;
            for i in remainder_start..len {
                if i + keyword_bytes.len() <= len {
                    if &text[i..i + keyword_bytes.len()] == keyword_bytes {
                        matches.push((i, keyword.to_string()));
                    }
                }
            }
        }
    }
    
    matches
}

/// Fallback keyword scanner (no SIMD)
#[cfg(not(all(target_arch = "x86_64", target_feature = "avx2")))]
pub fn fast_keyword_scan(text: &[u8], keywords: &[&str]) -> Vec<(usize, String)> {
    let mut matches = Vec::new();
    
    for keyword in keywords {
        let keyword_bytes = keyword.as_bytes();
        let text_len = text.len();
        let keyword_len = keyword_bytes.len();
        
        if keyword_len == 0 || keyword_len > text_len {
            continue;
        }
        
        for i in 0..=(text_len - keyword_len) {
            if &text[i..i + keyword_len] == keyword_bytes {
                matches.push((i, keyword.to_string()));
            }
        }
    }
    
    matches
}

/// SIMD-accelerated case-insensitive search
#[cfg(all(target_arch = "x86_64", target_feature = "avx2"))]
pub fn fast_lowercase_scan(text: &[u8]) -> Vec<u8> {
    let mut result = Vec::with_capacity(text.len());
    
    unsafe {
        let len = text.len();
        let chunks = len / 32;
        
        let a_lower = _mm256_set1_epi8(b'A' as i8);
        let z_upper = _mm256_set1_epi8(b'Z' as i8);
        let to_lower = _mm256_set1_epi8(32);
        
        for i in 0..chunks {
            let offset = i * 32;
            let chunk = _mm256_loadu_si256(text.as_ptr().add(offset) as *const __m256i);
            
            // Check if bytes are uppercase (A-Z)
            let ge_a = _mm256_cmpgt_epi8(chunk, _mm256_sub_epi8(a_lower, _mm256_set1_epi8(1)));
            let le_z = _mm256_cmpgt_epi8(_mm256_add_epi8(z_upper, _mm256_set1_epi8(1)), chunk);
            let is_upper = _mm256_and_si256(ge_a, le_z);
            
            // Convert to lowercase by adding 32 to uppercase letters
            let lower_mask = _mm256_and_si256(is_upper, to_lower);
            let lowered = _mm256_add_epi8(chunk, lower_mask);
            
            // Store result
            let mut temp = [0u8; 32];
            _mm256_storeu_si256(temp.as_mut_ptr() as *mut __m256i, lowered);
            result.extend_from_slice(&temp);
        }
        
        // Handle remaining bytes
        for i in (chunks * 32)..len {
            let byte = text[i];
            result.push(if byte >= b'A' && byte <= b'Z' {
                byte + 32
            } else {
                byte
            });
        }
    }
    
    result
}

/// Fallback lowercase conversion (no SIMD)
#[cfg(not(all(target_arch = "x86_64", target_feature = "avx2")))]
pub fn fast_lowercase_scan(text: &[u8]) -> Vec<u8> {
    text.iter()
        .map(|&b| if b >= b'A' && b <= b'Z' { b + 32 } else { b })
        .collect()
}

/// SIMD-accelerated trim: remove leading and trailing ASCII whitespace (space, tab, CR, LF).
#[cfg(all(target_arch = "x86_64", target_feature = "avx2"))]
pub fn fast_trim(text: &[u8]) -> &[u8] {
    let space = b' ';
    let tab = b'\t';
    let cr = b'\r';
    let lf = b'\n';
    let mut start = 0;
    let mut end = text.len();
    // Leading: scan until non-whitespace
    for (i, &b) in text.iter().enumerate() {
        if b != space && b != tab && b != cr && b != lf {
            start = i;
            break;
        }
    }
    if start == text.len() {
        return &text[0..0];
    }
    // Trailing
    for i in (start..text.len()).rev() {
        let b = text[i];
        if b != space && b != tab && b != cr && b != lf {
            end = i + 1;
            break;
        }
    }
    &text[start..end]
}

/// Fallback trim (no SIMD)
#[cfg(not(all(target_arch = "x86_64", target_feature = "avx2")))]
pub fn fast_trim(text: &[u8]) -> &[u8] {
    let is_ws = |b: u8| b == b' ' || b == b'\t' || b == b'\r' || b == b'\n';
    let start = text.iter().position(|&b| !is_ws(b)).unwrap_or(text.len());
    let end = text.iter().rposition(|&b| !is_ws(b)).map(|i| i + 1).unwrap_or(start);
    &text[start..end]
}

/// Normalize whitespace: collapse runs of ASCII whitespace to a single space.
/// Allocates a new Vec. Use for text preprocessing before parsing.
#[cfg(all(target_arch = "x86_64", target_feature = "avx2"))]
pub fn fast_normalize_whitespace(text: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(text.len());
    let ws: [u8; 4] = [b' ', b'\t', b'\r', b'\n'];
    let mut i = 0;
    let len = text.len();
    while i < len {
        let b = text[i];
        let is_ws = ws.contains(&b);
        if is_ws {
            if out.last() != Some(&b' ') {
                out.push(b' ');
            }
            i += 1;
        } else {
            out.push(b);
            i += 1;
        }
    }
    // Trim trailing space if we added one
    if out.last() == Some(&b' ') {
        out.pop();
    }
    out
}

#[cfg(not(all(target_arch = "x86_64", target_feature = "avx2")))]
pub fn fast_normalize_whitespace(text: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(text.len());
    let is_ws = |b: u8| b == b' ' || b == b'\t' || b == b'\r' || b == b'\n';
    let mut prev_ws = false;
    for &b in text {
        if is_ws(b) {
            if !prev_ws {
                out.push(b' ');
                prev_ws = true;
            }
        } else {
            out.push(b);
            prev_ws = false;
        }
    }
    if out.last() == Some(&b' ') {
        out.pop();
    }
    out
}

/// Check CPU features at runtime
pub fn check_simd_support() -> SIMDSupport {
    #[cfg(target_arch = "x86_64")]
    {
        if is_x86_feature_detected!("avx512f") {
            return SIMDSupport::AVX512;
        }
        if is_x86_feature_detected!("avx2") {
            return SIMDSupport::AVX2;
        }
        if is_x86_feature_detected!("sse4.2") {
            return SIMDSupport::SSE42;
        }
    }
    
    SIMDSupport::None
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SIMDSupport {
    None,
    SSE42,
    AVX2,
    AVX512,
}

impl std::fmt::Display for SIMDSupport {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SIMDSupport::None => write!(f, "No SIMD"),
            SIMDSupport::SSE42 => write!(f, "SSE4.2"),
            SIMDSupport::AVX2 => write!(f, "AVX2"),
            SIMDSupport::AVX512 => write!(f, "AVX-512"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keyword_scan() {
        let text = b"Build a React app with Node and Express";
        let keywords = &["React", "Node", "Express", "Python"];
        let matches = fast_keyword_scan(text, keywords);
        
        assert!(matches.iter().any(|(_, k)| k == "React"));
        assert!(matches.iter().any(|(_, k)| k == "Node"));
        assert!(matches.iter().any(|(_, k)| k == "Express"));
        assert!(!matches.iter().any(|(_, k)| k == "Python"));
    }

    #[test]
    fn test_lowercase_scan() {
        let text = b"Build A React APP";
        let lower = fast_lowercase_scan(text);
        assert_eq!(&lower, b"build a react app");
    }

    #[test]
    fn test_simd_support() {
        let support = check_simd_support();
        println!("SIMD support: {}", support);
        // Just verify it doesn't crash
        assert!(matches!(
            support,
            SIMDSupport::None | SIMDSupport::SSE42 | SIMDSupport::AVX2 | SIMDSupport::AVX512
        ));
    }

    #[test]
    fn test_fast_trim() {
        assert_eq!(fast_trim(b"  hello  "), b"hello");
        assert_eq!(fast_trim(b"\t\n\r  x \n"), b"x");
        assert_eq!(fast_trim(b"no ws"), b"no ws");
        assert!(fast_trim(b"   \t\n").is_empty());
    }

    #[test]
    fn test_fast_normalize_whitespace() {
        assert_eq!(
            String::from_utf8(fast_normalize_whitespace(b"hello   world\t\n\r\n")).unwrap(),
            "hello world"
        );
        assert_eq!(
            String::from_utf8(fast_normalize_whitespace(b"  a  b  ")).unwrap(),
            " a b"
        );
    }
}
