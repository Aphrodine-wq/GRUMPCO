/// Negation scope detection.
/// Detects negation cues and marks words within their scope window.
/// Uses PHF (Perfect Hash Function) for O(1) lookup of negation cues.
use phf::phf_set;
use smallvec::SmallVec;

/// Perfect hash set for single-word negation cues - O(1) lookup
static SINGLE_WORD_NEGATION_CUES: phf::Set<&'static str> = phf_set! {
    "don't",
    "dont",
    "doesn't",
    "doesnt",
    "not",
    "no",
    "never",
    "without",
    "avoid",
    "skip",
    "exclude",
    "remove",
    "drop",
    "disable",
    "won't",
    "wont",
    "shouldn't",
    "shouldnt",
    "can't",
    "cant",
    "cannot",
};

/// Perfect hash set for two-word negation cues - O(1) lookup
static TWO_WORD_NEGATION_CUES: phf::Set<&'static str> = phf_set! {
    "do not",
    "does not",
    "will not",
    "should not",
    "instead of",
    "rather than",
};

/// Window size: how many words after a negation cue are considered negated.
const NEGATION_WINDOW: usize = 4;

/// Stack-allocated vector for negation positions (typically few)
pub type NegationPositions = SmallVec<[usize; 8]>;

/// Pre-compute negation bitmap for a word list.
/// Returns a SmallVec of (cue_position, window_end) tuples.
/// This allows O(1) negation checks after the initial scan.
#[inline]
pub fn compute_negation_ranges(words: &[String]) -> NegationPositions {
    let mut ranges = NegationPositions::new();

    // Check single-word cues
    for (i, word) in words.iter().enumerate() {
        if SINGLE_WORD_NEGATION_CUES.contains(word.as_str()) {
            // Store the end position of the negation window
            ranges.push(i);
        }
    }

    // Check two-word cues
    if words.len() >= 2 {
        for i in 0..words.len() - 1 {
            // Build bigram efficiently
            let w0 = &words[i];
            let w1 = &words[i + 1];

            // Quick length check before allocation
            let bigram_len = w0.len() + 1 + w1.len();
            if bigram_len <= 12 {
                // Max two-word cue length
                let mut bigram = String::with_capacity(bigram_len);
                bigram.push_str(w0);
                bigram.push(' ');
                bigram.push_str(w1);

                if TWO_WORD_NEGATION_CUES.contains(bigram.as_str()) {
                    // Two-word cue ends at position i+1
                    ranges.push(i + 1);
                }
            }
        }
    }

    ranges
}

/// Check if a specific word position is within a negation scope.
/// `words` is the lowercased word list; `target_idx` is the index to check.
#[inline]
pub fn is_negated(words: &[String], target_idx: usize) -> bool {
    is_negated_with_ranges(words, target_idx, &compute_negation_ranges(words))
}

/// Check negation using pre-computed ranges (more efficient for multiple checks)
#[inline]
pub fn is_negated_with_ranges(
    _words: &[String],
    target_idx: usize,
    cue_positions: &NegationPositions,
) -> bool {
    for &cue_pos in cue_positions {
        // Target must be after the cue and within the window
        if target_idx > cue_pos && target_idx <= cue_pos + NEGATION_WINDOW {
            return true;
        }
    }
    false
}

/// Find all negated word indices in a word list.
pub fn negated_indices(words: &[String]) -> Vec<usize> {
    let ranges = compute_negation_ranges(words);
    (0..words.len())
        .filter(|&i| is_negated_with_ranges(words, i, &ranges))
        .collect()
}

/// Batch check multiple indices for negation (more efficient than individual checks)
pub fn batch_check_negation(words: &[String], indices: &[usize]) -> SmallVec<[bool; 16]> {
    let ranges = compute_negation_ranges(words);
    indices
        .iter()
        .map(|&idx| is_negated_with_ranges(words, idx, &ranges))
        .collect()
}

/// Check if a word is a negation cue (single-word only)
#[inline]
pub fn is_negation_cue(word: &str) -> bool {
    SINGLE_WORD_NEGATION_CUES.contains(word)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn words(s: &str) -> Vec<String> {
        s.split_whitespace().map(|w| w.to_lowercase()).collect()
    }

    #[test]
    fn test_dont_negate() {
        let w = words("don't use react build with vue");
        // "react" is at index 2, "don't" at 0, "use" at 1
        assert!(is_negated(&w, 2)); // react
        assert!(!is_negated(&w, 5)); // vue
    }

    #[test]
    fn test_without_negate() {
        let w = words("build an api without express");
        assert!(is_negated(&w, 4)); // express
        assert!(!is_negated(&w, 2)); // api
    }

    #[test]
    fn test_no_negation() {
        let w = words("build a react app with node");
        assert!(!is_negated(&w, 2)); // react
        assert!(!is_negated(&w, 5)); // node
    }

    #[test]
    fn test_do_not_two_word_cue() {
        let w = words("do not use angular but we prefer to use react instead");
        assert!(is_negated(&w, 3)); // angular
        assert!(!is_negated(&w, 8)); // react - outside window
    }

    #[test]
    fn test_negated_indices() {
        let w = words("avoid react and angular use vue");
        let neg = negated_indices(&w);
        assert!(neg.contains(&1)); // react
        assert!(neg.contains(&3)); // angular
        assert!(!neg.contains(&5)); // vue
    }

    #[test]
    fn test_phf_lookup_performance() {
        // PHF should be O(1)
        assert!(SINGLE_WORD_NEGATION_CUES.contains("don't"));
        assert!(SINGLE_WORD_NEGATION_CUES.contains("never"));
        assert!(!SINGLE_WORD_NEGATION_CUES.contains("maybe"));

        assert!(TWO_WORD_NEGATION_CUES.contains("do not"));
        assert!(TWO_WORD_NEGATION_CUES.contains("instead of"));
        assert!(!TWO_WORD_NEGATION_CUES.contains("yes please"));
    }

    #[test]
    fn test_batch_negation() {
        let w = words("don't use react or angular but prefer vue");
        let results = batch_check_negation(&w, &[2, 4, 6]);
        assert!(results[0]); // react - negated
        assert!(results[1]); // angular - negated
        assert!(!results[2]); // vue - not negated
    }

    #[test]
    fn test_is_negation_cue() {
        assert!(is_negation_cue("don't"));
        assert!(is_negation_cue("never"));
        assert!(is_negation_cue("avoid"));
        assert!(!is_negation_cue("use"));
        assert!(!is_negation_cue("build"));
    }

    #[test]
    fn test_precomputed_ranges() {
        // don't=0, use=1, react=2, build=3, with=4, avoid=5, angular=6, definitely=7, use=8, vue=9, later=10
        let w = words("don't use react build with avoid angular definitely use vue later");
        let ranges = compute_negation_ranges(&w);

        // Should have 2 cue positions: "don't" at 0 and "avoid" at 5
        assert_eq!(
            ranges.len(),
            2,
            "Expected 2 negation cues, got {:?}",
            ranges
        );

        // Use precomputed ranges for multiple checks
        // "react" at index 2 is within window of "don't" at 0 (range: 1-4)
        assert!(
            is_negated_with_ranges(&w, 2, &ranges),
            "react should be negated"
        );
        // "angular" at index 6 is within window of "avoid" at 5 (range: 6-9)
        assert!(
            is_negated_with_ranges(&w, 6, &ranges),
            "angular should be negated"
        );
        // "later" at index 10 is outside both windows
        assert!(
            !is_negated_with_ranges(&w, 10, &ranges),
            "later should not be negated"
        );
    }
}
