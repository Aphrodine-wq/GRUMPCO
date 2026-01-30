<script setup>
import DefaultTheme from 'vitepress/theme'
const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #nav-bar-content-after>
      <a 
        href="https://www.nvidia.com" 
        target="_blank" 
        rel="noopener noreferrer"
        class="nvidia-badge"
        title="Powered by NVIDIA"
      >
        <svg class="nvidia-logo" viewBox="0 0 351.5 66.3" xmlns="http://www.w3.org/2000/svg">
          <path fill="currentColor" d="M150.3 13.5h8.4l14.9 31.6 15-31.6h8.2l-20.3 40.8h-5.8l-20.4-40.8zM201.5 13.5h7.7v40.6h-7.7V13.5zM219 13.5h14.7c14.1 0 22.4 8.8 22.4 20.2 0 11.9-8.6 20.4-22.2 20.4H219V13.5zm7.7 33.8h6.1c9.7 0 15.3-5.6 15.3-13.5 0-7.6-5.2-13.5-15.2-13.5h-6.2v27zM263.9 13.5h7.7v40.6h-7.7V13.5zM302.2 13.5h7.5l19.4 40.6h-8.3l-4.3-9.3h-21.3l-4.4 9.3H283l19.2-40.6zm11.5 24.7l-7.8-16.9-8 16.9h15.8zM56.9 20.4v-5.5c1.8-.2 3.7-.3 5.6-.3 22.9 0 35.6 17.5 35.6 17.5s-14.8 20.4-35.3 20.4c-2 0-4-.2-5.9-.6V31.8c8.3.9 10 3.9 15 10.6l11.2-9.7s-8-12.3-23.3-12.3c-1.1 0-2.2 0-2.9.1M56.9 5.7v7.5c-1.6.1-3.1.3-4.7.6V5.3c1.5-.1 3-.2 4.7-.2 28 0 43 20.2 43 20.2s-17.2 23.3-38.7 23.3c-1.5 0-2.9-.1-4.3-.2v6.3c1.3.1 2.6.1 4 .1 20.2 0 34.9-10.6 49-23.6 2.3 1.8 11.8 6.4 13.7 8.4-13.5 11.8-45.1 22.2-62.4 22.2-1.5 0-2.9-.1-4.3-.2v5.5H0V5.7h56.9zM56.9 31.8v20.1c-17.9-2.8-22.8-23.3-22.8-23.3s8.5-8.8 22.8-7.7v7.1c-7.7-1.5-13.5 5.4-13.5 5.4s3.1 11.4 13.5 11.4v-13zM130.3 13.5h7.6v40.6H131L108.1 23v31.1h-7.6V13.5h7.7l22.1 30v-30z"/>
        </svg>
        <span class="nvidia-text">Powered by</span>
      </a>
    </template>
  </Layout>
</template>

<style scoped>
.nvidia-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: linear-gradient(135deg, #76B900 0%, #5a8f00 100%);
  border-radius: 6px;
  text-decoration: none;
  color: white;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all 0.2s ease;
  margin-left: 16px;
  flex-shrink: 0;
}

.nvidia-badge:hover {
  background: linear-gradient(135deg, #8ad100 0%, #76B900 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(118, 185, 0, 0.3);
}

.nvidia-logo {
  width: 60px;
  height: auto;
  color: white;
}

.nvidia-text {
  color: white;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .nvidia-badge {
    padding: 3px 8px;
    margin-left: 8px;
  }
  
  .nvidia-logo {
    width: 45px;
  }
  
  .nvidia-text {
    display: none;
  }
}
</style>
