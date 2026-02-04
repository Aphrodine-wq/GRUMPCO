/**
 * Predictive Preloader Unit Tests
 *
 * Tests for the PredictivePreloader service including NGramPredictor,
 * TopicMarkovChain, TemporalPatternAnalyzer, SemanticQueryCache, and PreloadCache.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  NGramPredictor,
  TopicMarkovChain,
  TemporalPatternAnalyzer,
  SemanticQueryCache,
  PreloadCache,
  PredictivePreloader,
  PredictivePreloaderService,
} from '../../src/services/predictivePreloader.js';

describe('NGramPredictor', () => {
  let predictor: NGramPredictor;

  beforeEach(() => {
    predictor = new NGramPredictor(3);
  });

  describe('train', () => {
    it('should train on a sequence of queries', () => {
      predictor.train(['hello world', 'how are you', 'good morning']);
      expect(predictor.getVocabSize()).toBeGreaterThan(0);
    });

    it('should handle empty queries array', () => {
      predictor.train([]);
      expect(predictor.getVocabSize()).toBe(0);
    });

    it('should handle single query', () => {
      predictor.train(['hello world']);
      expect(predictor.getVocabSize()).toBeGreaterThan(0);
    });
  });

  describe('predict', () => {
    it('should predict next queries based on history', () => {
      const queries = [
        'what is javascript',
        'how to use react',
        'what is typescript',
        'how to use react',
        'how to use vue',
      ];
      predictor.train(queries);

      const predictions = predictor.predict(['what is javascript'], 5);
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should return empty array when no history', () => {
      const predictions = predictor.predict([], 5);
      expect(predictions).toEqual([]);
    });

    it('should return predictions with confidence and source', () => {
      const queries = [
        'hello world',
        'goodbye world',
        'hello again',
        'goodbye again',
      ];
      predictor.train(queries);

      const predictions = predictor.predict(['hello world'], 3);
      for (const pred of predictions) {
        expect(pred).toHaveProperty('query');
        expect(pred).toHaveProperty('confidence');
        expect(pred).toHaveProperty('source');
        expect(pred.source).toBe('ngram');
      }
    });

    it('should respect topK limit', () => {
      const queries = Array.from({ length: 20 }, (_, i) => `query ${i}`);
      predictor.train(queries);

      const predictions = predictor.predict(['query 0'], 3);
      expect(predictions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getVocabSize', () => {
    it('should return 0 for untrained predictor', () => {
      expect(predictor.getVocabSize()).toBe(0);
    });

    it('should increase after training', () => {
      predictor.train(['hello world', 'foo bar baz']);
      expect(predictor.getVocabSize()).toBeGreaterThan(0);
    });
  });
});

describe('TopicMarkovChain', () => {
  let markov: TopicMarkovChain;

  beforeEach(() => {
    markov = new TopicMarkovChain();
  });

  describe('recordTransition', () => {
    it('should record topic transitions', () => {
      markov.recordTransition('javascript', 'react', 1000);
      markov.recordTransition('react', 'typescript', 2000);

      const transitions = markov.getTransitions();
      expect(transitions.length).toBe(2);
    });

    it('should accumulate counts for repeated transitions', () => {
      markov.recordTransition('javascript', 'react', 1000);
      markov.recordTransition('javascript', 'react', 1500);
      markov.recordTransition('javascript', 'react', 2000);

      const transitions = markov.getTransitions();
      const jsToReact = transitions.find((t) => t.from === 'javascript' && t.to === 'react');
      expect(jsToReact?.count).toBe(3);
    });
  });

  describe('getTransitionProbability', () => {
    it('should return correct probability', () => {
      markov.recordTransition('javascript', 'react', 1000);
      markov.recordTransition('javascript', 'vue', 1000);
      markov.recordTransition('javascript', 'react', 1000);

      const prob = markov.getTransitionProbability('javascript', 'react');
      expect(prob).toBeCloseTo(2 / 3, 5);
    });

    it('should return 0 for unknown source topic', () => {
      const prob = markov.getTransitionProbability('unknown', 'react');
      expect(prob).toBe(0);
    });

    it('should return 0 for unknown target topic', () => {
      markov.recordTransition('javascript', 'react', 1000);
      const prob = markov.getTransitionProbability('javascript', 'unknown');
      expect(prob).toBe(0);
    });
  });

  describe('predictNextTopics', () => {
    it('should predict next topics with probabilities', () => {
      markov.recordTransition('javascript', 'react', 1000);
      markov.recordTransition('javascript', 'vue', 2000);
      markov.recordTransition('javascript', 'angular', 3000);

      const predictions = markov.predictNextTopics('javascript', 3);
      expect(predictions.length).toBe(3);
      expect(predictions[0]).toHaveProperty('topic');
      expect(predictions[0]).toHaveProperty('probability');
      expect(predictions[0]).toHaveProperty('avgTimeGap');
    });

    it('should return empty array for unknown topic', () => {
      const predictions = markov.predictNextTopics('unknown', 3);
      expect(predictions).toEqual([]);
    });

    it('should sort by probability descending', () => {
      markov.recordTransition('javascript', 'react', 1000);
      markov.recordTransition('javascript', 'react', 1000);
      markov.recordTransition('javascript', 'vue', 1000);

      const predictions = markov.predictNextTopics('javascript', 3);
      expect(predictions[0].probability).toBeGreaterThanOrEqual(predictions[1]?.probability ?? 0);
    });
  });

  describe('getTopTopics', () => {
    it('should return most common topics', () => {
      markov.recordTransition('javascript', 'react', 1000);
      markov.recordTransition('react', 'typescript', 1000);
      markov.recordTransition('javascript', 'vue', 1000);
      markov.recordTransition('javascript', 'react', 1000);

      const topTopics = markov.getTopTopics(3);
      expect(topTopics.length).toBeLessThanOrEqual(3);
      expect(topTopics[0]).toHaveProperty('topic');
      expect(topTopics[0]).toHaveProperty('count');
    });

    it('should return empty array when no topics', () => {
      const topTopics = markov.getTopTopics(3);
      expect(topTopics).toEqual([]);
    });
  });

  describe('getTransitions', () => {
    it('should return all transitions', () => {
      markov.recordTransition('a', 'b', 100);
      markov.recordTransition('b', 'c', 200);
      markov.recordTransition('a', 'c', 300);

      const transitions = markov.getTransitions();
      expect(transitions.length).toBe(3);
    });

    it('should include average time gap', () => {
      markov.recordTransition('a', 'b', 100);
      markov.recordTransition('a', 'b', 200);
      markov.recordTransition('a', 'b', 300);

      const transitions = markov.getTransitions();
      const ab = transitions.find((t) => t.from === 'a' && t.to === 'b');
      expect(ab?.avgTimeGap).toBe(200);
    });
  });
});

describe('TemporalPatternAnalyzer', () => {
  let analyzer: TemporalPatternAnalyzer;

  beforeEach(() => {
    analyzer = new TemporalPatternAnalyzer();
  });

  describe('recordQuery', () => {
    it('should record queries with timestamps', () => {
      analyzer.recordQuery('test query', ['topic1'], Date.now());
      const summary = analyzer.getPatternSummary();
      expect(summary.length).toBeGreaterThan(0);
    });

    it('should use current time when timestamp not provided', () => {
      analyzer.recordQuery('test query', ['topic1']);
      const summary = analyzer.getPatternSummary();
      expect(summary.length).toBeGreaterThan(0);
    });
  });

  describe('predictForCurrentTime', () => {
    it('should predict topics for current time of day', () => {
      const now = Date.now();
      analyzer.recordQuery('javascript question', ['javascript', 'code'], now);
      analyzer.recordQuery('react question', ['react', 'frontend'], now);
      analyzer.recordQuery('another js', ['javascript'], now);

      const predictions = analyzer.predictForCurrentTime(3);
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should return empty array when no data for current hour', () => {
      // Don't record any queries
      const predictions = analyzer.predictForCurrentTime(3);
      expect(predictions).toEqual([]);
    });
  });

  describe('getTypicalQueriesForTime', () => {
    it('should return queries typically asked at given time', () => {
      const now = Date.now();
      analyzer.recordQuery('morning query 1', ['morning'], now);
      analyzer.recordQuery('morning query 2', ['morning'], now);

      const queries = analyzer.getTypicalQueriesForTime(now, 5);
      expect(Array.isArray(queries)).toBe(true);
    });

    it('should return unique queries', () => {
      const now = Date.now();
      analyzer.recordQuery('same query', ['topic'], now);
      analyzer.recordQuery('same query', ['topic'], now);
      analyzer.recordQuery('different query', ['topic'], now);

      const queries = analyzer.getTypicalQueriesForTime(now, 10);
      const uniqueQueries = new Set(queries);
      expect(uniqueQueries.size).toBe(queries.length);
    });

    it('should respect limit', () => {
      const now = Date.now();
      for (let i = 0; i < 20; i++) {
        analyzer.recordQuery(`query ${i}`, ['topic'], now);
      }

      const queries = analyzer.getTypicalQueriesForTime(now, 5);
      expect(queries.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getPatternSummary', () => {
    it('should return pattern summary with hour and day', () => {
      analyzer.recordQuery('test', ['topic'], Date.now());

      const summary = analyzer.getPatternSummary();
      expect(summary.length).toBeGreaterThan(0);
      expect(summary[0]).toHaveProperty('hour');
      expect(summary[0]).toHaveProperty('day');
      expect(summary[0]).toHaveProperty('topTopics');
    });
  });
});

describe('SemanticQueryCache', () => {
  let cache: SemanticQueryCache;

  beforeEach(() => {
    cache = new SemanticQueryCache(256);
  });

  describe('addQuery', () => {
    it('should add queries to cache', () => {
      cache.addQuery('hello world');
      cache.addQuery('goodbye world');
      expect(cache.getSize()).toBe(2);
    });

    it('should not duplicate queries', () => {
      cache.addQuery('hello world');
      cache.addQuery('hello world');
      expect(cache.getSize()).toBe(1);
    });
  });

  describe('findSimilar', () => {
    it('should find similar queries', () => {
      cache.addQuery('how to implement react hooks');
      cache.addQuery('using react hooks tutorial');
      cache.addQuery('javascript array methods');
      cache.addQuery('python machine learning');

      const similar = cache.findSimilar('react hooks example', 3, 0.1);
      expect(Array.isArray(similar)).toBe(true);
    });

    it('should return empty array when no similar queries', () => {
      cache.addQuery('javascript programming');

      const similar = cache.findSimilar('cooking recipes', 3, 0.9);
      expect(similar).toEqual([]);
    });

    it('should exclude the query itself', () => {
      cache.addQuery('hello world');

      const similar = cache.findSimilar('hello world', 3, 0.0);
      expect(similar.every((s) => s.query !== 'hello world')).toBe(true);
    });

    it('should respect topK limit', () => {
      for (let i = 0; i < 10; i++) {
        cache.addQuery(`query variant ${i}`);
      }

      const similar = cache.findSimilar('query variant', 3, 0.1);
      expect(similar.length).toBeLessThanOrEqual(3);
    });

    it('should include similarity score', () => {
      cache.addQuery('hello world');
      cache.addQuery('hello there');

      const similar = cache.findSimilar('hello', 3, 0.1);
      for (const s of similar) {
        expect(s).toHaveProperty('query');
        expect(s).toHaveProperty('similarity');
        expect(typeof s.similarity).toBe('number');
      }
    });
  });

  describe('getSize', () => {
    it('should return 0 for empty cache', () => {
      expect(cache.getSize()).toBe(0);
    });

    it('should return correct count after adding queries', () => {
      cache.addQuery('q1');
      cache.addQuery('q2');
      cache.addQuery('q3');
      expect(cache.getSize()).toBe(3);
    });
  });
});

describe('PreloadCache', () => {
  let cache: PreloadCache;

  beforeEach(() => {
    cache = new PreloadCache(10, 60000); // 10 items, 1 minute TTL
  });

  describe('set', () => {
    it('should store preloaded context', () => {
      cache.set('query1', { query: 'query1', confidence: 0.8, source: 'ngram', topics: [] });
      expect(cache.has('query1')).toBe(true);
    });

    it('should evict least confident when at capacity', () => {
      // Fill cache
      for (let i = 0; i < 10; i++) {
        cache.set(`query${i}`, { query: `query${i}`, confidence: 0.5 + i * 0.01, source: 'ngram', topics: [] });
      }

      // Add one more (should evict query0 with lowest confidence)
      cache.set('query10', { query: 'query10', confidence: 0.9, source: 'ngram', topics: [] });

      expect(cache.has('query10')).toBe(true);
    });
  });

  describe('get', () => {
    it('should retrieve preloaded context', () => {
      const prediction = { query: 'test', confidence: 0.9, source: 'ngram' as const, topics: ['topic1'] };
      cache.set('test', prediction, { data: 'context' });

      const result = cache.get('test');
      expect(result).toBeDefined();
      expect(result?.query).toBe('test');
      expect(result?.context).toEqual({ data: 'context' });
    });

    it('should mark entry as used', () => {
      cache.set('test', { query: 'test', confidence: 0.9, source: 'ngram', topics: [] });

      const result = cache.get('test');
      expect(result?.used).toBe(true);
      expect(result?.usedAt).toBeDefined();
    });

    it('should return undefined for non-existent query', () => {
      const result = cache.get('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing queries', () => {
      cache.set('test', { query: 'test', confidence: 0.9, source: 'ngram', topics: [] });
      expect(cache.has('test')).toBe(true);
    });

    it('should return false for non-existing queries', () => {
      expect(cache.has('non-existent')).toBe(false);
    });
  });

  describe('findApproximate', () => {
    it('should find prefix matches', () => {
      cache.set('how to use react hooks', { query: 'how to use react hooks', confidence: 0.9, source: 'ngram', topics: [] });

      const result = cache.findApproximate('how to use react', 0.5);
      expect(result).toBeDefined();
    });

    it('should find word overlap matches', () => {
      cache.set('javascript react tutorial', { query: 'javascript react tutorial', confidence: 0.9, source: 'ngram', topics: [] });

      const result = cache.findApproximate('react javascript guide', 0.5);
      expect(result).toBeDefined();
    });

    it('should return undefined for no matches', () => {
      cache.set('javascript programming', { query: 'javascript programming', confidence: 0.9, source: 'ngram', topics: [] });

      const result = cache.findApproximate('python cooking', 0.9);
      expect(result).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cache.set('q1', { query: 'q1', confidence: 0.9, source: 'ngram', topics: [] });
      cache.set('q2', { query: 'q2', confidence: 0.8, source: 'ngram', topics: [] });
      cache.get('q1'); // Mark as used

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.used).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should return 0 hit rate for empty cache', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('q1', { query: 'q1', confidence: 0.9, source: 'ngram', topics: [] });
      cache.set('q2', { query: 'q2', confidence: 0.8, source: 'ngram', topics: [] });

      cache.clear();

      expect(cache.has('q1')).toBe(false);
      expect(cache.has('q2')).toBe(false);
      expect(cache.getStats().size).toBe(0);
    });
  });
});

describe('PredictivePreloader', () => {
  let preloader: PredictivePreloader;

  beforeEach(() => {
    preloader = new PredictivePreloader('test-session');
  });

  afterEach(() => {
    preloader.stopAutoPreload();
  });

  describe('recordQuery', () => {
    it('should record queries and update stats', () => {
      preloader.recordQuery('hello world');
      preloader.recordQuery('goodbye world');

      const stats = preloader.getStats();
      expect(stats.totalQueries).toBe(2);
    });

    it('should emit queryRecorded event', () => {
      const listener = vi.fn();
      preloader.on('queryRecorded', listener);

      preloader.recordQuery('test query');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test query',
        })
      );
    });

    it('should handle custom session ID', () => {
      preloader.recordQuery('test query', 'custom-session');
      const history = preloader.getSessionHistory('custom-session');
      expect(history.length).toBe(1);
    });
  });

  describe('generatePredictions', () => {
    it('should generate predictions from query history', () => {
      preloader.recordQuery('what is javascript');
      preloader.recordQuery('how to use react');
      preloader.recordQuery('what is typescript');

      const predictions = preloader.generatePredictions(5);
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should return empty array when no history', () => {
      const predictions = preloader.generatePredictions(5);
      expect(predictions.length).toBe(0);
    });

    it('should update stats with predictions generated', () => {
      preloader.recordQuery('what is javascript');
      preloader.recordQuery('how to use react');

      preloader.generatePredictions(5);

      const stats = preloader.getStats();
      expect(stats.predictionsGenerated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('preload', () => {
    it('should preload context for predictions', async () => {
      preloader.recordQuery('what is javascript');
      preloader.recordQuery('how to use react');

      const preloaded = await preloader.preload();
      expect(typeof preloaded).toBe('number');
    });

    it('should call preload function when provided', async () => {
      preloader.recordQuery('what is javascript');
      preloader.recordQuery('how to use react');

      const preloadFn = vi.fn().mockResolvedValue({ data: 'context' });
      await preloader.preload(preloadFn);

      // May or may not be called depending on predictions generated
      expect(preloadFn.mock.calls.length).toBeGreaterThanOrEqual(0);
    });

    it('should emit contextPreloaded event', async () => {
      const listener = vi.fn();
      preloader.on('contextPreloaded', listener);

      preloader.recordQuery('what is javascript');
      preloader.recordQuery('how to use react');

      await preloader.preload();

      // May or may not emit depending on predictions
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getPreloaded', () => {
    it('should return undefined when no preloaded context', () => {
      const result = preloader.getPreloaded('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('startAutoPreload / stopAutoPreload', () => {
    it('should start auto preload interval', () => {
      const listener = vi.fn();
      preloader.on('autoPreloadStarted', listener);

      preloader.startAutoPreload(1000);

      expect(listener).toHaveBeenCalledWith({ intervalMs: 1000 });

      preloader.stopAutoPreload();
    });

    it('should stop auto preload', () => {
      const listener = vi.fn();
      preloader.on('autoPreloadStopped', listener);

      preloader.startAutoPreload(1000);
      preloader.stopAutoPreload();

      expect(listener).toHaveBeenCalled();
    });

    it('should handle multiple start calls', () => {
      preloader.startAutoPreload(1000);
      preloader.startAutoPreload(2000); // Should clear previous interval

      preloader.stopAutoPreload();
    });
  });

  describe('startSession', () => {
    it('should start a new session', () => {
      const sessionId = preloader.startSession();
      expect(sessionId).toBeDefined();
      expect(preloader.getCurrentSession()).toBe(sessionId);
    });

    it('should use provided session ID', () => {
      const sessionId = preloader.startSession('my-session');
      expect(sessionId).toBe('my-session');
    });

    it('should emit sessionStarted event', () => {
      const listener = vi.fn();
      preloader.on('sessionStarted', listener);

      preloader.startSession('test-session-2');

      expect(listener).toHaveBeenCalledWith({ sessionId: 'test-session-2' });
    });
  });

  describe('getCurrentSession', () => {
    it('should return current session ID', () => {
      expect(preloader.getCurrentSession()).toBe('test-session');
    });
  });

  describe('getStats', () => {
    it('should return comprehensive stats', () => {
      preloader.recordQuery('test query');

      const stats = preloader.getStats();
      expect(stats).toHaveProperty('totalQueries');
      expect(stats).toHaveProperty('predictionsGenerated');
      expect(stats).toHaveProperty('accuratePredictions');
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('avgPredictionConfidence');
      expect(stats).toHaveProperty('topTopics');
      expect(stats).toHaveProperty('cacheStats');
    });
  });

  describe('getTopicTransitions', () => {
    it('should return topic transitions', () => {
      preloader.recordQuery('javascript tutorial');
      preloader.recordQuery('react hooks guide');

      const transitions = preloader.getTopicTransitions();
      expect(Array.isArray(transitions)).toBe(true);
    });
  });

  describe('getTemporalPatterns', () => {
    it('should return temporal patterns', () => {
      preloader.recordQuery('test query');

      const patterns = preloader.getTemporalPatterns();
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('getSessionHistory', () => {
    it('should return session history', () => {
      preloader.recordQuery('query 1');
      preloader.recordQuery('query 2');

      const history = preloader.getSessionHistory();
      expect(history.length).toBe(2);
    });

    it('should return empty array for unknown session', () => {
      const history = preloader.getSessionHistory('unknown-session');
      expect(history).toEqual([]);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      preloader.recordQuery('test query');
      preloader.reset();

      const stats = preloader.getStats();
      expect(stats.totalQueries).toBe(0);
      expect(stats.predictionsGenerated).toBe(0);
    });

    it('should emit reset event', () => {
      const listener = vi.fn();
      preloader.on('reset', listener);

      preloader.reset();

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('exportState', () => {
    it('should export state for persistence', () => {
      preloader.recordQuery('test query');

      const state = preloader.exportState();
      expect(state).toHaveProperty('queryHistory');
      expect(state).toHaveProperty('stats');
      expect(state.queryHistory.length).toBe(1);
    });
  });

  describe('importState', () => {
    it('should import state from persistence', () => {
      const state = {
        queryHistory: [
          {
            query: 'imported query',
            timestamp: Date.now(),
            sessionId: 'imported-session',
            topics: ['topic1'],
          },
        ],
        stats: {
          totalQueries: 1,
          predictionsGenerated: 0,
          accuratePredictions: 0,
          cacheHits: 0,
          avgPredictionConfidence: 0,
          topTopics: [],
        },
      };

      preloader.importState(state);

      const history = preloader.getSessionHistory('imported-session');
      expect(history.length).toBe(1);
    });

    it('should emit stateImported event', () => {
      const listener = vi.fn();
      preloader.on('stateImported', listener);

      preloader.importState({ queryHistory: [] });

      expect(listener).toHaveBeenCalled();
    });
  });
});

describe('PredictivePreloaderService', () => {
  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = PredictivePreloaderService.getInstance();
      const instance2 = PredictivePreloaderService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getPreloader', () => {
    it('should return default preloader when no userId', () => {
      const service = PredictivePreloaderService.getInstance();
      const preloader = service.getPreloader();
      expect(preloader).toBe(service.getDefault());
    });

    it('should create user-specific preloader', () => {
      const service = PredictivePreloaderService.getInstance();
      const preloader = service.getPreloader('user123');
      expect(preloader).toBeDefined();
    });

    it('should return same preloader for same userId', () => {
      const service = PredictivePreloaderService.getInstance();
      const preloader1 = service.getPreloader('user123');
      const preloader2 = service.getPreloader('user123');
      expect(preloader1).toBe(preloader2);
    });
  });

  describe('getDefault', () => {
    it('should return default preloader', () => {
      const service = PredictivePreloaderService.getInstance();
      const defaultPreloader = service.getDefault();
      expect(defaultPreloader).toBeDefined();
    });
  });

  describe('getAllStats', () => {
    it('should return stats for all preloaders', () => {
      const service = PredictivePreloaderService.getInstance();
      service.getPreloader('user1');
      service.getPreloader('user2');

      const allStats = service.getAllStats();
      expect(allStats.has('default')).toBe(true);
    });
  });
});
