use crate::types::SentenceInfo;
use smallvec::SmallVec;

/// Stack-allocated vector for typical sentence counts (up to 16 on stack)
pub type SentenceVec = SmallVec<[SentenceInfo; 16]>;

/// Stack-allocated vector for typical word counts (up to 64 on stack)
pub type WordVec = SmallVec<[String; 64]>;

/// Stack-allocated vector for bigrams (up to 32 on stack)
pub type BigramVec = SmallVec<[String; 32]>;

/// Split text into sentences on '.', '!', '?', ';', and newlines.
/// Preserves sentence order and trims whitespace.
/// Uses SmallVec for stack allocation when sentence count is small.
pub fn segment_sentences(text: &str) -> Vec<SentenceInfo> {
    segment_sentences_smallvec(text).into_vec()
}

/// SmallVec version - avoids heap allocation for up to 16 sentences
pub fn segment_sentences_smallvec(text: &str) -> SentenceVec {
    let mut sentences = SentenceVec::new();
    let mut current_start = 0;
    let mut idx = 0;
    let bytes = text.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        let ch = bytes[i];
        match ch {
            b'.' | b'!' | b'?' | b';' | b'\n' => {
                // Include the terminator in the slice
                let end = i + 1;
                let slice = &text[current_start..end];
                let trimmed = slice.trim();
                if !trimmed.is_empty() && trimmed.len() > 1 {
                    sentences.push(SentenceInfo {
                        text: trimmed.to_string(),
                        index: idx,
                        features_found: Vec::new(),
                        tech_found: Vec::new(),
                    });
                    idx += 1;
                }
                current_start = end;
            }
            _ => {}
        }
        i += 1;
    }

    // Remaining text without terminator
    if current_start < len {
        let trimmed = text[current_start..].trim();
        if !trimmed.is_empty() {
            sentences.push(SentenceInfo {
                text: trimmed.to_string(),
                index: idx,
                features_found: Vec::new(),
                tech_found: Vec::new(),
            });
        }
    }

    sentences
}

/// Tokenize a sentence into lowercase words, stripping punctuation.
/// Uses SmallVec for stack allocation when word count is small.
pub fn tokenize_words(text: &str) -> Vec<String> {
    tokenize_words_smallvec(text).into_vec()
}

/// SmallVec version - avoids heap allocation for up to 64 words
pub fn tokenize_words_smallvec(text: &str) -> WordVec {
    let mut words = WordVec::new();

    for word in text.split_whitespace() {
        let cleaned: String = word
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .flat_map(|c| c.to_lowercase())
            .collect();

        if !cleaned.is_empty() {
            words.push(cleaned);
        }
    }

    words
}

/// Zero-copy word iterator - returns string slices instead of owned Strings
/// Use this for read-only operations to avoid allocations entirely
pub struct WordIterator<'a> {
    text: &'a str,
    pos: usize,
}

impl<'a> WordIterator<'a> {
    pub fn new(text: &'a str) -> Self {
        Self { text, pos: 0 }
    }
}

impl<'a> Iterator for WordIterator<'a> {
    type Item = &'a str;

    fn next(&mut self) -> Option<Self::Item> {
        let bytes = self.text.as_bytes();

        // Skip whitespace
        while self.pos < bytes.len() && bytes[self.pos].is_ascii_whitespace() {
            self.pos += 1;
        }

        if self.pos >= bytes.len() {
            return None;
        }

        let start = self.pos;

        // Find end of word
        while self.pos < bytes.len() && !bytes[self.pos].is_ascii_whitespace() {
            self.pos += 1;
        }

        Some(&self.text[start..self.pos])
    }
}

/// Create a zero-copy word iterator
pub fn iter_words(text: &str) -> WordIterator<'_> {
    WordIterator::new(text)
}

/// Generate bi-grams from a word list.
/// Uses SmallVec for stack allocation.
pub fn bigrams(words: &[String]) -> Vec<String> {
    bigrams_smallvec(words).into_vec()
}

/// SmallVec version - avoids heap allocation for up to 32 bigrams
pub fn bigrams_smallvec(words: &[String]) -> BigramVec {
    if words.len() < 2 {
        return BigramVec::new();
    }

    let mut result = BigramVec::with_capacity(words.len() - 1);

    for window in words.windows(2) {
        // Pre-allocate capacity for the combined string
        let mut bigram = String::with_capacity(window[0].len() + 1 + window[1].len());
        bigram.push_str(&window[0]);
        bigram.push(' ');
        bigram.push_str(&window[1]);
        result.push(bigram);
    }

    result
}

/// Zero-copy bigram iterator - yields pairs of word slices
pub struct BigramIterator<'a, T: AsRef<str>> {
    words: &'a [T],
    pos: usize,
}

impl<'a, T: AsRef<str>> BigramIterator<'a, T> {
    pub fn new(words: &'a [T]) -> Self {
        Self { words, pos: 0 }
    }
}

impl<'a, T: AsRef<str>> Iterator for BigramIterator<'a, T> {
    type Item = (&'a str, &'a str);

    fn next(&mut self) -> Option<Self::Item> {
        if self.pos + 1 >= self.words.len() {
            return None;
        }

        let result = (
            self.words[self.pos].as_ref(),
            self.words[self.pos + 1].as_ref(),
        );
        self.pos += 1;
        Some(result)
    }
}

/// Create a zero-copy bigram iterator
pub fn iter_bigrams<T: AsRef<str>>(words: &[T]) -> BigramIterator<'_, T> {
    BigramIterator::new(words)
}

/// Count words without allocation
pub fn word_count(text: &str) -> usize {
    text.split_whitespace().count()
}

/// Check if text contains a keyword (case-insensitive, zero-copy)
pub fn contains_keyword_ci(text: &str, keyword: &str) -> bool {
    let text_lower = text.as_bytes();
    let keyword_lower: Vec<u8> = keyword.bytes().map(|b| b.to_ascii_lowercase()).collect();
    let kw_len = keyword_lower.len();

    if kw_len > text_lower.len() {
        return false;
    }

    for i in 0..=(text_lower.len() - kw_len) {
        let mut matches = true;
        for j in 0..kw_len {
            if text_lower[i + j].to_ascii_lowercase() != keyword_lower[j] {
                matches = false;
                break;
            }
        }
        if matches {
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_segment_sentences() {
        let s = segment_sentences("Build an app. Deploy it! Why not?");
        assert_eq!(s.len(), 3);
        assert!(s[0].text.starts_with("Build"));
        assert!(s[1].text.starts_with("Deploy"));
    }

    #[test]
    fn test_segment_no_terminator() {
        let s = segment_sentences("Build an app with React and Node");
        assert_eq!(s.len(), 1);
    }

    #[test]
    fn test_tokenize_words() {
        let w = tokenize_words("Build a React app, with Node.");
        assert!(w.contains(&"build".to_string()));
        assert!(w.contains(&"react".to_string()));
        assert!(w.contains(&"node".to_string()));
    }

    #[test]
    fn test_bigrams() {
        let words: Vec<String> = vec!["log".into(), "in".into(), "page".into()];
        let bg = bigrams(&words);
        assert_eq!(bg, vec!["log in", "in page"]);
    }

    #[test]
    fn test_word_iterator() {
        let text = "Build a React app";
        let words: Vec<&str> = iter_words(text).collect();
        assert_eq!(words, vec!["Build", "a", "React", "app"]);
    }

    #[test]
    fn test_bigram_iterator() {
        let words = vec!["log", "in", "page"];
        let bigrams: Vec<_> = iter_bigrams(&words).collect();
        assert_eq!(bigrams, vec![("log", "in"), ("in", "page")]);
    }

    #[test]
    fn test_word_count() {
        assert_eq!(word_count("Build a React app with Node"), 6);
        assert_eq!(word_count(""), 0);
        assert_eq!(word_count("single"), 1);
    }

    #[test]
    fn test_contains_keyword_ci() {
        assert!(contains_keyword_ci("Build a React app", "react"));
        assert!(contains_keyword_ci("Build a React app", "REACT"));
        assert!(contains_keyword_ci("Build a React app", "React"));
        assert!(!contains_keyword_ci("Build a Vue app", "react"));
    }

    #[test]
    fn test_smallvec_stack_allocation() {
        // These should stay on the stack for small inputs
        let sentences = segment_sentences_smallvec("One. Two. Three.");
        assert_eq!(sentences.len(), 3);
        assert!(!sentences.spilled()); // Still on stack

        let words = tokenize_words_smallvec("Build a React app");
        assert_eq!(words.len(), 4);
        assert!(!words.spilled()); // Still on stack
    }
}
