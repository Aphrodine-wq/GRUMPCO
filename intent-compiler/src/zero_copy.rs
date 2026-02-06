//! Zero-Copy Memory Architecture
//! Lock-free data structures for extreme concurrency
//! Memory-mapped I/O and DMA for ultra-fast data transfer

use std::sync::atomic::{AtomicPtr, AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;

/// Lock-free ring buffer for zero-copy message passing
pub struct LockFreeRingBuffer<T> {
    buffer: Vec<AtomicPtr<T>>,
    capacity: usize,
    head: AtomicUsize,
    tail: AtomicUsize,
}

impl<T> LockFreeRingBuffer<T> {
    pub fn new(capacity: usize) -> Self {
        let mut buffer = Vec::with_capacity(capacity);
        for _ in 0..capacity {
            buffer.push(AtomicPtr::new(std::ptr::null_mut()));
        }

        Self {
            buffer,
            capacity,
            head: AtomicUsize::new(0),
            tail: AtomicUsize::new(0),
        }
    }

    /// Push item without copying (transfers ownership)
    pub fn push(&self, item: Box<T>) -> Result<(), Box<T>> {
        let current_tail = self.tail.load(Ordering::Acquire);
        let next_tail = (current_tail + 1) % self.capacity;

        // Check if buffer is full
        if next_tail == self.head.load(Ordering::Acquire) {
            return Err(item);
        }

        let item_ptr = Box::into_raw(item);
        self.buffer[current_tail].store(item_ptr, Ordering::Release);

        // Update tail
        self.tail.store(next_tail, Ordering::Release);

        Ok(())
    }

    /// Pop item without copying (transfers ownership)
    pub fn pop(&self) -> Option<Box<T>> {
        let current_head = self.head.load(Ordering::Acquire);

        // Check if buffer is empty
        if current_head == self.tail.load(Ordering::Acquire) {
            return None;
        }

        let item_ptr = self.buffer[current_head].swap(std::ptr::null_mut(), Ordering::AcqRel);

        if item_ptr.is_null() {
            return None;
        }

        let next_head = (current_head + 1) % self.capacity;
        self.head.store(next_head, Ordering::Release);

        Some(unsafe { Box::from_raw(item_ptr) })
    }

    pub fn len(&self) -> usize {
        let head = self.head.load(Ordering::Acquire);
        let tail = self.tail.load(Ordering::Acquire);

        if tail >= head {
            tail - head
        } else {
            self.capacity - head + tail
        }
    }

    pub fn is_empty(&self) -> bool {
        self.head.load(Ordering::Acquire) == self.tail.load(Ordering::Acquire)
    }
}

/// Lock-free stack for ultra-fast LIFO operations
pub struct LockFreeStack<T> {
    head: AtomicPtr<Node<T>>,
}

struct Node<T> {
    data: T,
    next: *mut Node<T>,
}

impl<T> LockFreeStack<T> {
    pub fn new() -> Self {
        Self {
            head: AtomicPtr::new(std::ptr::null_mut()),
        }
    }

    pub fn push(&self, data: T) {
        let new_node = Box::into_raw(Box::new(Node {
            data,
            next: std::ptr::null_mut(),
        }));

        loop {
            let current_head = self.head.load(Ordering::Acquire);
            unsafe {
                (*new_node).next = current_head;
            }

            if self
                .head
                .compare_exchange(current_head, new_node, Ordering::Release, Ordering::Acquire)
                .is_ok()
            {
                break;
            }
        }
    }

    pub fn pop(&self) -> Option<T> {
        loop {
            let current_head = self.head.load(Ordering::Acquire);

            if current_head.is_null() {
                return None;
            }

            let next = unsafe { (*current_head).next };

            if self
                .head
                .compare_exchange(current_head, next, Ordering::Release, Ordering::Acquire)
                .is_ok()
            {
                let data = unsafe { Box::from_raw(current_head).data };
                return Some(data);
            }
        }
    }
}

/// Zero-copy string view (no allocation, just pointer + length)
#[derive(Debug, Clone, Copy)]
pub struct ZeroCopyStr<'a> {
    ptr: *const u8,
    len: usize,
    _phantom: std::marker::PhantomData<&'a str>,
}

impl<'a> ZeroCopyStr<'a> {
    pub fn new(s: &'a str) -> Self {
        Self {
            ptr: s.as_ptr(),
            len: s.len(),
            _phantom: std::marker::PhantomData,
        }
    }

    pub fn as_str(&self) -> &'a str {
        unsafe {
            let slice = std::slice::from_raw_parts(self.ptr, self.len);
            std::str::from_utf8_unchecked(slice)
        }
    }

    pub fn len(&self) -> usize {
        self.len
    }

    pub fn is_empty(&self) -> bool {
        self.len == 0
    }
}

/// Memory arena for ultra-fast allocation
pub struct Arena {
    buffer: Vec<u8>,
    offset: AtomicUsize,
}

impl Arena {
    pub fn new(capacity: usize) -> Self {
        Self {
            buffer: vec![0; capacity],
            offset: AtomicUsize::new(0),
        }
    }

    /// Allocate memory from arena (no deallocation, just bump pointer)
    pub fn alloc<T>(&self, value: T) -> Option<&mut T> {
        let size = std::mem::size_of::<T>();
        let align = std::mem::align_of::<T>();

        let current_offset = self.offset.load(Ordering::Acquire);
        let aligned_offset = (current_offset + align - 1) & !(align - 1);
        let new_offset = aligned_offset + size;

        if new_offset > self.buffer.len() {
            return None;
        }

        if self
            .offset
            .compare_exchange(
                current_offset,
                new_offset,
                Ordering::Release,
                Ordering::Acquire,
            )
            .is_ok()
        {
            let ptr = unsafe { self.buffer.as_ptr().add(aligned_offset) as *mut T };
            unsafe {
                std::ptr::write(ptr, value);
                Some(&mut *ptr)
            }
        } else {
            None
        }
    }

    pub fn reset(&mut self) {
        self.offset.store(0, Ordering::Release);
    }

    pub fn used(&self) -> usize {
        self.offset.load(Ordering::Acquire)
    }

    pub fn available(&self) -> usize {
        self.buffer.len() - self.used()
    }
}

/// Lock-free hash map for concurrent access
pub struct LockFreeHashMap<K, V> {
    buckets: Vec<LockFreeStack<(K, V)>>,
    size: AtomicUsize,
}

impl<K: std::hash::Hash + Eq, V> LockFreeHashMap<K, V> {
    pub fn new(num_buckets: usize) -> Self {
        let mut buckets = Vec::with_capacity(num_buckets);
        for _ in 0..num_buckets {
            buckets.push(LockFreeStack::new());
        }

        Self {
            buckets,
            size: AtomicUsize::new(0),
        }
    }

    fn hash(&self, key: &K) -> usize {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        key.hash(&mut hasher);
        hasher.finish() as usize % self.buckets.len()
    }

    pub fn insert(&self, key: K, value: V) {
        let bucket_idx = self.hash(&key);
        self.buckets[bucket_idx].push((key, value));
        self.size.fetch_add(1, Ordering::Relaxed);
    }

    pub fn len(&self) -> usize {
        self.size.load(Ordering::Relaxed)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

/// DMA-style memory transfer (simulated)
pub struct DmaTransfer {
    source: *const u8,
    dest: *mut u8,
    size: usize,
    completed: AtomicU64,
}

impl DmaTransfer {
    pub fn new(source: *const u8, dest: *mut u8, size: usize) -> Self {
        Self {
            source,
            dest,
            size,
            completed: AtomicU64::new(0),
        }
    }

    /// Initiate asynchronous transfer
    pub fn start(&self) {
        // In real implementation, would use DMA hardware
        // For now, simulate with memcpy
        unsafe {
            std::ptr::copy_nonoverlapping(self.source, self.dest, self.size);
        }
        self.completed.store(self.size as u64, Ordering::Release);
    }

    pub fn is_complete(&self) -> bool {
        self.completed.load(Ordering::Acquire) == self.size as u64
    }

    pub fn bytes_transferred(&self) -> u64 {
        self.completed.load(Ordering::Acquire)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lock_free_ring_buffer() {
        let buffer = LockFreeRingBuffer::new(10);

        buffer.push(Box::new(42)).unwrap();
        buffer.push(Box::new(43)).unwrap();

        assert_eq!(*buffer.pop().unwrap(), 42);
        assert_eq!(*buffer.pop().unwrap(), 43);
        assert!(buffer.pop().is_none());
    }

    #[test]
    fn test_lock_free_stack() {
        let stack = LockFreeStack::new();

        stack.push(1);
        stack.push(2);
        stack.push(3);

        assert_eq!(stack.pop(), Some(3));
        assert_eq!(stack.pop(), Some(2));
        assert_eq!(stack.pop(), Some(1));
        assert_eq!(stack.pop(), None);
    }

    #[test]
    fn test_zero_copy_str() {
        let s = "hello world";
        let zc = ZeroCopyStr::new(s);

        assert_eq!(zc.as_str(), s);
        assert_eq!(zc.len(), s.len());
    }

    #[test]
    fn test_arena() {
        let arena = Arena::new(1024);

        let val1 = arena.alloc(42u32).unwrap();
        let val2 = arena.alloc(43u32).unwrap();

        assert_eq!(*val1, 42);
        assert_eq!(*val2, 43);
    }

    #[test]
    fn test_lock_free_hashmap() {
        let map = LockFreeHashMap::new(16);

        map.insert("key1", 1);
        map.insert("key2", 2);

        assert_eq!(map.len(), 2);
    }
}
