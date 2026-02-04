<div class="bg-decoration">
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>
</div>

<style>
  /* Background decoration */
  .bg-decoration {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 0;
  }

  .blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    opacity: 0.4;
  }

  .blob-1 {
    width: 300px;
    height: 300px;
    background: #7c3aed;
    top: -100px;
    right: -50px;
    animation: blobFloat1 8s ease-in-out infinite;
  }

  .blob-2 {
    width: 200px;
    height: 200px;
    background: #a855f7;
    bottom: -50px;
    left: -50px;
    animation: blobFloat2 10s ease-in-out infinite;
  }

  .blob-3 {
    width: 150px;
    height: 150px;
    background: #6d28d9;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation: blobFloat3 12s ease-in-out infinite;
  }

  @keyframes blobFloat1 {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    50% {
      transform: translate(-20px, 20px) scale(1.1);
    }
  }

  @keyframes blobFloat2 {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    50% {
      transform: translate(30px, -20px) scale(1.15);
    }
  }

  @keyframes blobFloat3 {
    0%,
    100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0.3;
    }
    50% {
      transform: translate(-50%, -50%) scale(1.2);
      opacity: 0.5;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .blob {
      animation: none;
    }
  }
</style>
